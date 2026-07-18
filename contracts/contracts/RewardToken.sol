// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title RewardToken
 * @dev ERC-20 token for rewarding verified eco-friendly posts.
 * Only authorized minters (Verification contracts) can mint tokens.
 *
 * v2 upgrades (Phase 1):
 *   - Added burn() for user self-burn
 *   - Added burnFrom() for contract-driven burns (EcoBoost, EcoCredential, EcoDAO)
 *   - Added totalBurned tracker for analytics and portfolio display
 */
contract RewardToken is ERC20, Ownable {
    // Authorized minters (Verification.sol, DynamicVerification.sol, etc.)
    mapping(address => bool) public minters;

    // Track total ECO burned for tokenomics analytics
    uint256 public totalBurned;

    // Events
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event Burned(address indexed from, uint256 amount);

    /**
     * @dev Constructor initializes the token with name and symbol
     * @param initialOwner The address that will own the contract
     */
    constructor(
        address initialOwner
    ) ERC20("EcoDMS Reward Token", "ECO") Ownable(initialOwner) {}

    // ─── Minter Access Control ───────────────────────────────

    modifier onlyMinter() {
        require(minters[msg.sender], "RewardToken: caller is not a minter");
        _;
    }

    function addMinter(address minter) external onlyOwner {
        require(minter != address(0), "RewardToken: minter is zero address");
        require(!minters[minter], "RewardToken: minter already added");
        minters[minter] = true;
        emit MinterAdded(minter);
    }

    function removeMinter(address minter) external onlyOwner {
        require(minters[minter], "RewardToken: minter does not exist");
        minters[minter] = false;
        emit MinterRemoved(minter);
    }

    function isMinter(address account) external view returns (bool) {
        return minters[account];
    }

    // ─── Mint ────────────────────────────────────────────────

    function mint(address to, uint256 amount) external onlyMinter {
        require(to != address(0), "RewardToken: mint to zero address");
        require(amount > 0, "RewardToken: mint amount is zero");
        _mint(to, amount);
    }

    // ─── Burn Mechanics (v2) ─────────────────────────────────

    /// @notice Allow any token holder to burn their own tokens
    function burn(uint256 amount) external {
        require(amount > 0, "RewardToken: burn amount is zero");
        _burn(msg.sender, amount);
    }

    /// @notice Allow approved contracts to burn tokens on behalf of users
    function burnFrom(address account, uint256 amount) external {
        uint256 currentAllowance = allowance(account, msg.sender);
        require(currentAllowance >= amount, "RewardToken: insufficient allowance");
        _approve(account, msg.sender, currentAllowance - amount);
        _burn(account, amount);
    }

    /// @dev Override _burn to accumulate totalBurned for analytics
    function _burn(address account, uint256 amount) internal override {
        super._burn(account, amount);
        totalBurned += amount;
        emit Burned(account, amount);
    }
}
