// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./RewardToken.sol";

/**
 * @title DynamicVerification
 * @dev Replaces flat-rate Verification.sol with engagement-scaled rewards.
 *
 * Reward formula:
 *   baseReward = 5 ECO
 *   engagementMultiplier = 1.0 + min(likeScore + commentScore + viewScore + shareScore, 2.0)
 *   totalReward = baseReward × engagementMultiplier × (1 + reputationBonus)
 *   Max reward: ~18 ECO per post
 *
 * Two-phase verification:
 *   Phase 1: ML verifies → base reward minted immediately
 *   Phase 2: After 24h engagement period → bonus reward minted
 */
contract DynamicVerification is Ownable, EIP712 {
    using ECDSA for bytes32;

    // ─── Constants ──────────────────────────────────────────
    uint256 public constant BASE_REWARD = 5 * 10**18;           // 5 ECO
    uint256 public constant MAX_BONUS_MULTIPLIER = 200;         // 2.0x bonus (so max total = 3.0x = 15 ECO)
    uint256 public constant MIN_CONFIDENCE = 80;
    uint256 public constant ENGAGEMENT_WINDOW = 24 hours;
    uint256 public constant COOLDOWN_PERIOD = 24 hours;

    // Engagement weight percentages
    uint256 public constant LIKE_WEIGHT = 30;
    uint256 public constant COMMENT_WEIGHT = 50;
    uint256 public constant VIEW_WEIGHT = 10;
    uint256 public constant SHARE_WEIGHT = 40;

    // Reputation bonus cap (20% = 20)
    uint256 public constant MAX_REP_BONUS_PCT = 20;

    // ─── Type Hashes ────────────────────────────────────────
    bytes32 public constant VERDICT_TYPEHASH = keccak256(
        "Verdict(string postCid,bool isEco,uint256 confidence,uint256 timestamp,uint256 nonce,address wallet)"
    );

    bytes32 public constant ENGAGEMENT_TYPEHASH = keccak256(
        "Engagement(string postCid,uint256 likes,uint256 comments,uint256 views,uint256 shares,uint256 timestamp,uint256 nonce)"
    );

    // ─── State ──────────────────────────────────────────────
    RewardToken public rewardToken;

    mapping(address => bool) public authorizedVerifiers;
    mapping(uint256 => bool) public usedNonces;
    mapping(address => uint256) public lastRewardTime;

    struct PostReward {
        address author;
        uint256 baseRewardMinted;
        uint256 bonusRewardMinted;
        uint64 verifiedAt;
        uint64 bonusClaimedAt;
        bool verified;
        bool bonusClaimed;
    }

    mapping(bytes32 => PostReward) public postRewards; // keccak256(postCid) => PostReward

    // User eco-level (set by backend based on portfolio data)
    mapping(address => uint256) public userLevel;

    // ─── Events ─────────────────────────────────────────────
    event PostVerified(
        string postCid, address indexed wallet, uint256 confidence,
        uint256 baseReward, uint256 timestamp
    );
    event BonusRewardMinted(
        string postCid, address indexed wallet, uint256 bonusReward,
        uint256 likes, uint256 comments, uint256 views, uint256 shares
    );
    event VerifierAdded(address indexed verifier);
    event VerifierRemoved(address indexed verifier);

    // ─── Constructor ────────────────────────────────────────
    constructor(
        address _rewardToken,
        address initialOwner
    ) EIP712("EcoDMS DynamicVerification", "2") Ownable(initialOwner) {
        require(_rewardToken != address(0), "DV: zero token");
        rewardToken = RewardToken(_rewardToken);
    }

    // ─── Phase 1: ML Verification (base reward) ────────────
    function verifyAndReward(
        string calldata postCid,
        bool isEco,
        uint256 confidence,
        uint256 timestamp,
        uint256 nonce,
        address wallet,
        bytes calldata signature
    ) external {
        // Verify signature
        bytes32 structHash = keccak256(abi.encode(
            VERDICT_TYPEHASH,
            keccak256(bytes(postCid)),
            isEco, confidence, timestamp, nonce, wallet
        ));
        address signer = _hashTypedDataV4(structHash).recover(signature);
        require(authorizedVerifiers[signer], "DV: unauthorized signer");

        // Validations
        require(isEco, "DV: not eco");
        require(confidence >= MIN_CONFIDENCE, "DV: low confidence");
        require(!usedNonces[nonce], "DV: nonce used");
        usedNonces[nonce] = true;

        bytes32 cidHash = keccak256(bytes(postCid));
        require(!postRewards[cidHash].verified, "DV: already verified");

        require(
            block.timestamp >= lastRewardTime[wallet] + COOLDOWN_PERIOD,
            "DV: cooldown"
        );
        lastRewardTime[wallet] = block.timestamp;

        // Mint base reward
        rewardToken.mint(wallet, BASE_REWARD);

        postRewards[cidHash] = PostReward({
            author: wallet,
            baseRewardMinted: BASE_REWARD,
            bonusRewardMinted: 0,
            verifiedAt: uint64(block.timestamp),
            bonusClaimedAt: 0,
            verified: true,
            bonusClaimed: false
        });

        emit PostVerified(postCid, wallet, confidence, BASE_REWARD, block.timestamp);
    }

    // ─── Phase 2: Engagement Bonus (after 24h) ─────────────
    function claimEngagementBonus(
        string calldata postCid,
        uint256 likes,
        uint256 comments,
        uint256 views,
        uint256 shares,
        uint256 timestamp,
        uint256 nonce,
        bytes calldata signature
    ) external {
        // Verify signature from authorized backend
        bytes32 structHash = keccak256(abi.encode(
            ENGAGEMENT_TYPEHASH,
            keccak256(bytes(postCid)),
            likes, comments, views, shares, timestamp, nonce
        ));
        address signer = _hashTypedDataV4(structHash).recover(signature);
        require(authorizedVerifiers[signer], "DV: unauthorized signer");
        require(!usedNonces[nonce], "DV: nonce used");
        usedNonces[nonce] = true;

        bytes32 cidHash = keccak256(bytes(postCid));
        PostReward storage pr = postRewards[cidHash];
        require(pr.verified, "DV: not verified");
        require(!pr.bonusClaimed, "DV: bonus claimed");
        require(
            block.timestamp >= pr.verifiedAt + ENGAGEMENT_WINDOW,
            "DV: engagement window open"
        );

        // Calculate engagement bonus
        uint256 bonus = _calculateBonus(likes, comments, views, shares, pr.author);

        if (bonus > 0) {
            rewardToken.mint(pr.author, bonus);
        }

        pr.bonusRewardMinted = bonus;
        pr.bonusClaimed = true;
        pr.bonusClaimedAt = uint64(block.timestamp);

        emit BonusRewardMinted(postCid, pr.author, bonus, likes, comments, views, shares);
    }

    // ─── Internal: Bonus Calculation ────────────────────────
    function _calculateBonus(
        uint256 likes, uint256 comments, uint256 views, uint256 shares,
        address author
    ) internal view returns (uint256) {
        uint256 likeScore = _log2Approx(1 + likes) * LIKE_WEIGHT;
        uint256 commentScore = _log2Approx(1 + comments) * COMMENT_WEIGHT;
        uint256 viewScore = _log2Approx(1 + views) * VIEW_WEIGHT;
        uint256 shareScore = _log2Approx(1 + shares) * SHARE_WEIGHT;

        uint256 engagementScore = likeScore + commentScore + viewScore + shareScore;
        if (engagementScore > MAX_BONUS_MULTIPLIER * 10) {
            engagementScore = MAX_BONUS_MULTIPLIER * 10;
        }

        // Reputation bonus (up to 20%)
        uint256 level = userLevel[author];
        uint256 repBonus = Math.min(level * 2, MAX_REP_BONUS_PCT);

        // Final bonus = BASE_REWARD × (engagementScore/1000) × (1 + repBonus/100)
        uint256 bonus = (BASE_REWARD * engagementScore * (100 + repBonus)) / (1000 * 100);

        return bonus;
    }

    function _log2Approx(uint256 x) internal pure returns (uint256) {
        if (x <= 1) return 0;
        uint256 result = 0;
        while (x > 1) {
            x >>= 1;
            result++;
        }
        return result;
    }

    // ─── Admin ──────────────────────────────────────────────
    function addVerifier(address v) external onlyOwner {
        authorizedVerifiers[v] = true;
        emit VerifierAdded(v);
    }

    function removeVerifier(address v) external onlyOwner {
        authorizedVerifiers[v] = false;
        emit VerifierRemoved(v);
    }

    function setUserLevel(address user, uint256 level) external onlyOwner {
        userLevel[user] = level;
    }

    function batchSetUserLevels(
        address[] calldata users, uint256[] calldata levels
    ) external onlyOwner {
        require(users.length == levels.length, "DV: length mismatch");
        for (uint256 i = 0; i < users.length; i++) {
            userLevel[users[i]] = levels[i];
        }
    }

    // ─── Views ──────────────────────────────────────────────
    function getPostReward(string calldata postCid) external view returns (PostReward memory) {
        return postRewards[keccak256(bytes(postCid))];
    }
}
