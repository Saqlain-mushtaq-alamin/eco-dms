// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "./RewardToken.sol";

/**
 * @title CommunityVoting
 * @dev Hybrid on-chain settlement for community eco-verification.
 *
 * Flow:
 *   1. Off-chain: users sign EIP-712 vote messages (free, no gas)
 *   2. Backend collects votes for 24h, computes settlement
 *   3. Backend calls settlePost() with merkle root of correct voters
 *   4. Correct voters call claimVoterReward() with merkle proof
 *   5. Wrong voters' reputation is slashed on-chain
 *
 * Reward formula:
 *   posterReward = BASE_REWARD × (ML_confidence × 0.7 + community_weight × 0.3)
 *   voterReward  = posterReward × VOTER_REWARD_PERCENT / 100 / numCorrectVoters
 */
contract CommunityVoting is Ownable {
    // ─── State ────────────────────────────────────────────────────────────────

    RewardToken public rewardToken;

    /// @dev On-chain reputation score per wallet (can go negative)
    mapping(address => int256) public reputation;

    struct Settlement {
        address poster;
        bool isEco;
        uint64 mlConfidencePct; // 0-100
        uint64 communityWeightPct; // 0-100 (% that voted eco)
        uint256 posterReward; // ECO tokens minted to poster
        uint256 totalVoterPool; // ECO tokens available for correct voters
        bytes32 voterMerkleRoot; // root: keccak256(voter, share)
        uint64 settledAt;
        bool settled;
    }

    /// postCid (keccak256 hashed for gas) => Settlement
    mapping(bytes32 => Settlement) public settlements;

    /// postCidHash => voter => claimed
    mapping(bytes32 => mapping(address => bool)) public hasClaimed;

    // ─── Constants ────────────────────────────────────────────────────────────

    uint256 public constant BASE_REWARD = 10 * 10 ** 18; // 10 ECO
    uint256 public constant VOTER_REWARD_PERCENT = 5; // 5% of poster reward

    // ─── Events ───────────────────────────────────────────────────────────────

    event PostSettled(
        bytes32 indexed postCidHash,
        string postCid,
        address indexed poster,
        bool isEco,
        uint256 posterReward,
        uint256 voterPool,
        bytes32 merkleRoot
    );

    event VoterRewardClaimed(
        bytes32 indexed postCidHash,
        address indexed voter,
        uint256 amount
    );

    event ReputationUpdated(
        address indexed user,
        int256 newReputation,
        bool wasCorrect
    );

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(
        address _rewardToken,
        address initialOwner
    ) Ownable(initialOwner) {
        require(
            _rewardToken != address(0),
            "CommunityVoting: zero token address"
        );
        rewardToken = RewardToken(_rewardToken);
    }

    // ─── Settler (backend only) ───────────────────────────────────────────────

    /**
     * @notice Settle a post after its voting window closes.
     * @dev    Only callable by contract owner (backend hot-wallet).
     *
     * @param postCid           Raw IPFS CID string (for event indexing)
     * @param poster            Post author's wallet
     * @param isEco             Final combined verdict
     * @param mlConfidencePct   ML confidence 0-100
     * @param communityWeightPct % of community votes that were ECO (0-100)
     * @param voterMerkleRoot   Merkle root of (voter, share) leaves
     */
    function settlePost(
        string calldata postCid,
        address poster,
        bool isEco,
        uint64 mlConfidencePct,
        uint64 communityWeightPct,
        bytes32 voterMerkleRoot
    ) external onlyOwner {
        bytes32 cidHash = keccak256(bytes(postCid));
        require(
            !settlements[cidHash].settled,
            "CommunityVoting: already settled"
        );
        require(poster != address(0), "CommunityVoting: zero poster");
        require(mlConfidencePct <= 100, "CommunityVoting: ml > 100");
        require(communityWeightPct <= 100, "CommunityVoting: community > 100");

        uint256 posterReward = 0;
        uint256 totalVoterPool = 0;

        if (isEco) {
            // Weighted score: ML×0.7 + community×0.3  (integer math, ×100 precision)
            uint256 weightedScore = (uint256(mlConfidencePct) *
                70 +
                uint256(communityWeightPct) *
                30) / 100;
            posterReward = (BASE_REWARD * weightedScore) / 100;
            totalVoterPool = (posterReward * VOTER_REWARD_PERCENT) / 100;

            rewardToken.mint(poster, posterReward);
        }

        settlements[cidHash] = Settlement({
            poster: poster,
            isEco: isEco,
            mlConfidencePct: mlConfidencePct,
            communityWeightPct: communityWeightPct,
            posterReward: posterReward,
            totalVoterPool: totalVoterPool,
            voterMerkleRoot: voterMerkleRoot,
            settledAt: uint64(block.timestamp),
            settled: true
        });

        emit PostSettled(
            cidHash,
            postCid,
            poster,
            isEco,
            posterReward,
            totalVoterPool,
            voterMerkleRoot
        );
    }

    /**
     * @notice Bulk-update on-chain reputation after settlement.
     * @dev    Correct voters get +1, wrong voters get -1.
     */
    function updateReputation(
        address[] calldata voters,
        bool[] calldata wasCorrect
    ) external onlyOwner {
        require(
            voters.length == wasCorrect.length,
            "CommunityVoting: length mismatch"
        );
        for (uint256 i = 0; i < voters.length; i++) {
            if (wasCorrect[i]) {
                reputation[voters[i]] += 1;
            } else {
                if (reputation[voters[i]] > type(int256).min) {
                    reputation[voters[i]] -= 1;
                }
            }
            emit ReputationUpdated(
                voters[i],
                reputation[voters[i]],
                wasCorrect[i]
            );
        }
    }

    // ─── Claimable by voters ──────────────────────────────────────────────────

    /**
     * @notice Correct voters claim their share of the voter pool.
     *         Leaf = keccak256(abi.encodePacked(voter, voterShare))
     *
     * @param postCid    Raw IPFS CID string
     * @param voterShare This voter's allocated share (in wei)
     * @param proof      Merkle proof
     */
    function claimVoterReward(
        string calldata postCid,
        uint256 voterShare,
        bytes32[] calldata proof
    ) external {
        bytes32 cidHash = keccak256(bytes(postCid));
        Settlement storage s = settlements[cidHash];
        require(s.settled, "CommunityVoting: not settled");
        require(
            !hasClaimed[cidHash][msg.sender],
            "CommunityVoting: already claimed"
        );
        require(voterShare > 0, "CommunityVoting: zero share");
        require(
            voterShare <= s.totalVoterPool,
            "CommunityVoting: share exceeds pool"
        );

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, voterShare));
        require(
            MerkleProof.verify(proof, s.voterMerkleRoot, leaf),
            "CommunityVoting: invalid proof"
        );

        hasClaimed[cidHash][msg.sender] = true;
        rewardToken.mint(msg.sender, voterShare);

        emit VoterRewardClaimed(cidHash, msg.sender, voterShare);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getSettlement(
        string calldata postCid
    ) external view returns (Settlement memory) {
        return settlements[keccak256(bytes(postCid))];
    }

    function isSettled(string calldata postCid) external view returns (bool) {
        return settlements[keccak256(bytes(postCid))].settled;
    }

    function getReputation(address user) external view returns (int256) {
        return reputation[user];
    }
}
