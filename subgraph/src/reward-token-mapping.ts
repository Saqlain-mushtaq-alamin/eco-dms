/**
 * REWARD TOKEN MAPPING
 * Handles ECO token transfer events
 */

import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
    Transfer,
    MinterAdded,
    MinterRemoved,
} from "../generated/RewardToken/RewardToken";
import { User, TokenTransfer } from "../generated/schema";

/**
 * Handle ERC-20 Transfer events
 * Updates user balances and creates transfer records
 */
export function handleTokenTransfer(event: Transfer): void {
    const from = event.params.from;
    const to = event.params.to;
    const value = event.params.value;

    // Create transfer record
    const transferId = event.transaction.hash
        .toHex()
        .concat("-")
        .concat(event.logIndex.toString());
    let transfer = new TokenTransfer(transferId);
    transfer.from = from;
    transfer.to = to;
    transfer.value = value;
    transfer.timestamp = event.block.timestamp;
    transfer.transactionHash = event.transaction.hash;
    transfer.blockNumber = event.block.number;
    transfer.save();

    // Update sender balance (skip if minting from 0x0)
    if (from.toHex() != "0x0000000000000000000000000000000000000000") {
        let sender = loadOrCreateUser(from, event.block.timestamp);
        sender.tokenBalance = sender.tokenBalance.minus(value);
        sender.save();
    }

    // Update recipient balance (skip if burning to 0x0)
    if (to.toHex() != "0x0000000000000000000000000000000000000000") {
        let recipient = loadOrCreateUser(to, event.block.timestamp);
        recipient.tokenBalance = recipient.tokenBalance.plus(value);
        recipient.save();
    }
}

/**
 * Handle MinterAdded event (optional tracking)
 */
export function handleMinterAdded(event: MinterAdded): void {
    // Could track authorized minters in a separate entity if needed
    // For now, this is just logged by the contract
}

/**
 * Handle MinterRemoved event (optional tracking)
 */
export function handleMinterRemoved(event: MinterRemoved): void {
    // Could track minter removals if needed
}

/**
 * Load existing user or create new one
 */
function loadOrCreateUser(address: Address, timestamp: BigInt): User {
    const userId = address.toHex();
    let user = User.load(userId);

    if (user == null) {
        user = new User(userId);
        user.createdAt = timestamp;
        user.totalPosts = BigInt.fromI32(0);
        user.totalLikes = BigInt.fromI32(0);
        user.totalComments = BigInt.fromI32(0);
        user.totalEcoVerifications = BigInt.fromI32(0);
        user.totalEcoRewards = BigInt.fromI32(0);
        user.tokenBalance = BigInt.fromI32(0);
    }

    return user as User;
}
