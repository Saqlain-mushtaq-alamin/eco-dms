// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./RewardToken.sol";

/**
 * @title EcoBoost
 * @dev Burn ECO tokens to boost eco-post visibility.
 * Only verified eco-posts can be boosted (checked off-chain by backend).
 * All spent ECO is permanently burned — creating deflationary pressure.
 *
 * Boost levels:
 *   Spark    (1): 5 ECO  → 3x reach for 24h
 *   Flame    (2): 15 ECO → 10x reach for 48h
 *   Wildfire (3): 50 ECO → 50x reach for 7d
 */
contract EcoBoost is Ownable {
    RewardToken public ecoToken;

    // Dead address for burning
    address public constant BURN_ADDRESS = address(0xdEaD);

    // Boost levels and costs
    uint256 public constant SPARK_COST    = 5  * 10**18;   // 5 ECO  → 3x reach
    uint256 public constant FLAME_COST    = 15 * 10**18;   // 15 ECO → 10x reach
    uint256 public constant WILDFIRE_COST = 50 * 10**18;   // 50 ECO → 50x reach

    struct Boost {
        address booster;
        uint8   level;       // 1=Spark, 2=Flame, 3=Wildfire
        uint256 amount;      // ECO burned
        uint64  timestamp;
    }

    // keccak256(postCid) => Boost[]
    mapping(bytes32 => Boost[]) public boosts;

    // Aggregate stats
    uint256 public totalBurned;
    uint256 public totalBoosts;

    // ─── Events ─────────────────────────────────────────────
    event PostBoosted(
        string postCid,
        address indexed booster,
        uint8   level,
        uint256 amount,
        uint256 timestamp
    );

    // ─── Constructor ────────────────────────────────────────
    constructor(address _ecoToken, address initialOwner) Ownable(initialOwner) {
        require(_ecoToken != address(0), "EcoBoost: zero token");
        ecoToken = RewardToken(_ecoToken);
    }

    // ─── Core: Boost a post ─────────────────────────────────
    function boostPost(string calldata postCid, uint8 level) external {
        require(level >= 1 && level <= 3, "EcoBoost: invalid level");

        uint256 cost;
        if      (level == 1) cost = SPARK_COST;
        else if (level == 2) cost = FLAME_COST;
        else                 cost = WILDFIRE_COST;

        // Transfer tokens to dead address (burn)
        require(
            ecoToken.transferFrom(msg.sender, BURN_ADDRESS, cost),
            "EcoBoost: transfer failed"
        );

        totalBurned += cost;
        totalBoosts += 1;

        bytes32 cidHash = keccak256(bytes(postCid));
        boosts[cidHash].push(Boost({
            booster:   msg.sender,
            level:     level,
            amount:    cost,
            timestamp: uint64(block.timestamp)
        }));

        emit PostBoosted(postCid, msg.sender, level, cost, block.timestamp);
    }

    // ─── Views ──────────────────────────────────────────────
    function getBoostCount(string calldata postCid) external view returns (uint256) {
        return boosts[keccak256(bytes(postCid))].length;
    }

    function getBoosts(string calldata postCid) external view returns (Boost[] memory) {
        return boosts[keccak256(bytes(postCid))];
    }

    /// @notice Returns the maximum boost level active for a post.
    /// Level 0 = no boost. Useful for backend feed ranking.
    function getActiveBoostLevel(string calldata postCid) external view returns (uint8) {
        Boost[] memory postBoosts = boosts[keccak256(bytes(postCid))];
        if (postBoosts.length == 0) return 0;

        uint8 maxLevel = 0;
        uint256[3] memory durations = [uint256(1 days), uint256(2 days), uint256(7 days)];

        for (uint256 i = 0; i < postBoosts.length; i++) {
            Boost memory b = postBoosts[i];
            uint256 dur = durations[b.level - 1];
            if (block.timestamp <= b.timestamp + dur && b.level > maxLevel) {
                maxLevel = b.level;
            }
        }
        return maxLevel;
    }
}
