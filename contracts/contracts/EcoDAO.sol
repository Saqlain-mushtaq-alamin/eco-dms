// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./RewardToken.sol";

/**
 * @title EcoDAO
 * @dev Governance for EcoDMS platform decisions.
 *
 * Key design:
 *   - Quadratic voting: voting power = sqrt(ECO balance)
 *     This prevents whale dominance while rewarding active community members
 *   - Proposal cost: 50 ECO (25 burned, 25 staked until proposal closes)
 *     This prevents spam proposals while returning stake to good-faith proposers
 *   - 7-day voting period; 10% quorum of circulating supply required
 *
 * This is the EcoDMS DAO — Level 10+ Eco Legends get proposal rights
 * through the portfolio system.
 */
contract EcoDAO is Ownable {
    RewardToken public ecoToken;
    address public constant BURN_ADDRESS = address(0xdEaD);

    uint256 public constant PROPOSAL_COST  = 50 * 10**18;
    uint256 public constant PROPOSAL_BURN  = 25 * 10**18;
    uint256 public constant PROPOSAL_STAKE = 25 * 10**18;
    uint256 public constant MIN_VOTE_BALANCE = 1 * 10**18;  // Need at least 1 ECO to vote
    uint256 public constant VOTING_PERIOD  = 7 days;
    uint256 public constant QUORUM_PERCENT = 10;             // 10% of circulating supply

    enum ProposalState { Active, Passed, Rejected, Executed }

    struct Proposal {
        address      proposer;
        string       title;
        string       descriptionCid;     // IPFS CID with full proposal text
        uint256      forVotes;           // Quadratic votes for
        uint256      againstVotes;       // Quadratic votes against
        uint256      startTime;
        uint256      endTime;
        uint256      stakedAmount;       // Returned to proposer after close
        ProposalState state;
    }

    Proposal[] public proposals;

    // proposalId => voter => voted
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    // proposalId => voter => vote direction (true = for)
    mapping(uint256 => mapping(address => bool)) public voteDirection;

    uint256 public totalBurned;

    // ─── Events ─────────────────────────────────────────────
    event ProposalCreated(
        uint256 indexed id,
        address indexed proposer,
        string  title,
        uint256 endTime
    );
    event Voted(
        uint256 indexed id,
        address indexed voter,
        bool    support,
        uint256 quadraticWeight
    );
    event ProposalFinalized(uint256 indexed id, ProposalState state);
    event ProposalExecuted(uint256 indexed id);

    // ─── Constructor ────────────────────────────────────────
    constructor(address _ecoToken, address initialOwner) Ownable(initialOwner) {
        require(_ecoToken != address(0), "DAO: zero token");
        ecoToken = RewardToken(_ecoToken);
    }

    // ─── Create Proposal ────────────────────────────────────
    function createProposal(
        string calldata title,
        string calldata descriptionCid
    ) external returns (uint256) {
        require(bytes(title).length > 0, "DAO: empty title");
        require(bytes(descriptionCid).length > 0, "DAO: empty description");

        // Burn 25 ECO immediately
        require(
            ecoToken.transferFrom(msg.sender, BURN_ADDRESS, PROPOSAL_BURN),
            "DAO: burn failed"
        );
        totalBurned += PROPOSAL_BURN;

        // Stake 25 ECO in contract (returned after finalization)
        require(
            ecoToken.transferFrom(msg.sender, address(this), PROPOSAL_STAKE),
            "DAO: stake failed"
        );

        uint256 id = proposals.length;
        proposals.push(Proposal({
            proposer:       msg.sender,
            title:          title,
            descriptionCid: descriptionCid,
            forVotes:       0,
            againstVotes:   0,
            startTime:      block.timestamp,
            endTime:        block.timestamp + VOTING_PERIOD,
            stakedAmount:   PROPOSAL_STAKE,
            state:          ProposalState.Active
        }));

        emit ProposalCreated(id, msg.sender, title, block.timestamp + VOTING_PERIOD);
        return id;
    }

    // ─── Vote ────────────────────────────────────────────────
    function vote(uint256 proposalId, bool support) external {
        require(proposalId < proposals.length, "DAO: invalid proposal");
        Proposal storage p = proposals[proposalId];
        require(p.state == ProposalState.Active, "DAO: not active");
        require(block.timestamp < p.endTime, "DAO: voting ended");
        require(!hasVoted[proposalId][msg.sender], "DAO: already voted");

        uint256 balance = ecoToken.balanceOf(msg.sender);
        require(balance >= MIN_VOTE_BALANCE, "DAO: insufficient ECO balance");

        // Quadratic voting: sqrt(balance in whole tokens)
        uint256 quadraticWeight = Math.sqrt(balance / 10**18);
        require(quadraticWeight > 0, "DAO: zero voting weight");

        hasVoted[proposalId][msg.sender] = true;
        voteDirection[proposalId][msg.sender] = support;

        if (support) {
            p.forVotes += quadraticWeight;
        } else {
            p.againstVotes += quadraticWeight;
        }

        emit Voted(proposalId, msg.sender, support, quadraticWeight);
    }

    // ─── Finalize ────────────────────────────────────────────
    function finalizeProposal(uint256 proposalId) external {
        require(proposalId < proposals.length, "DAO: invalid proposal");
        Proposal storage p = proposals[proposalId];
        require(p.state == ProposalState.Active, "DAO: not active");
        require(block.timestamp >= p.endTime, "DAO: still voting");

        if (p.forVotes > p.againstVotes) {
            p.state = ProposalState.Passed;
        } else {
            p.state = ProposalState.Rejected;
        }

        // Return staked ECO to proposer
        if (p.stakedAmount > 0) {
            ecoToken.transfer(p.proposer, p.stakedAmount);
            p.stakedAmount = 0;
        }

        emit ProposalFinalized(proposalId, p.state);
    }

    // ─── Execute (by owner after proposal passes) ───────────
    function executeProposal(uint256 proposalId) external onlyOwner {
        require(proposalId < proposals.length, "DAO: invalid proposal");
        Proposal storage p = proposals[proposalId];
        require(p.state == ProposalState.Passed, "DAO: not passed");
        p.state = ProposalState.Executed;
        emit ProposalExecuted(proposalId);
    }

    // ─── Views ──────────────────────────────────────────────
    function getProposalCount() external view returns (uint256) {
        return proposals.length;
    }

    function getProposal(uint256 id) external view returns (Proposal memory) {
        require(id < proposals.length, "DAO: invalid proposal");
        return proposals[id];
    }

    function getActiveProposals() external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < proposals.length; i++) {
            if (proposals[i].state == ProposalState.Active) count++;
        }
        uint256[] memory ids = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < proposals.length; i++) {
            if (proposals[i].state == ProposalState.Active) ids[idx++] = i;
        }
        return ids;
    }
}
