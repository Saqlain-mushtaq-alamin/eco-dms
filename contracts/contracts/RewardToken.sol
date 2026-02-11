// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title RewardToken
 * @dev ERC-20 token for rewarding verified eco-friendly posts
 * Only authorized minters (Verification contract) can mint tokens
 */
contract RewardToken is ERC20, Ownable {
    // Authorized minters (typically the Verification contract)
    mapping(address => bool) public minters;

    // Events
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);

    /**
     * @dev Constructor initializes the token with name and symbol
     * @param initialOwner The address that will own the contract
     */
    constructor(
        address initialOwner
    ) ERC20("EcoDMS Reward Token", "ECO") Ownable(initialOwner) {
        // Owner is set via Ownable constructor
    }

    /**
     * @dev Modifier to restrict function to authorized minters
     */
    modifier onlyMinter() {
        require(minters[msg.sender], "RewardToken: caller is not a minter");
        _;
    }

    /**
     * @dev Add an authorized minter
     * @param minter Address to authorize for minting
     */
    function addMinter(address minter) external onlyOwner {
        require(minter != address(0), "RewardToken: minter is zero address");
        require(!minters[minter], "RewardToken: minter already added");

        minters[minter] = true;
        emit MinterAdded(minter);
    }

    /**
     * @dev Remove an authorized minter
     * @param minter Address to revoke minting authorization
     */
    function removeMinter(address minter) external onlyOwner {
        require(minters[minter], "RewardToken: minter does not exist");

        minters[minter] = false;
        emit MinterRemoved(minter);
    }

    /**
     * @dev Mint tokens to a recipient (only callable by authorized minters)
     * @param to Recipient address
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyMinter {
        require(to != address(0), "RewardToken: mint to zero address");
        require(amount > 0, "RewardToken: mint amount is zero");

        _mint(to, amount);
    }

    /**
     * @dev Check if an address is an authorized minter
     * @param account Address to check
     * @return bool True if address is a minter
     */
    function isMinter(address account) external view returns (bool) {
        return minters[account];
    }
}
