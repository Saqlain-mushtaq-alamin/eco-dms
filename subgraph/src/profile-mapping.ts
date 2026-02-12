/**
 * PROFILE MAPPING
 * Handles user profile registration (optional)
 */

import { BigInt } from "@graphprotocol/graph-ts";
import { ProfileCreated } from "../generated/ProfileRegistry/ProfileRegistry";
import { User } from "../generated/schema";

/**
 * Handle ProfileCreated event
 * Updates user handle when they register a profile
 */
export function handleProfileCreated(event: ProfileCreated): void {
    const userId = event.params.user.toHex();
    let user = User.load(userId);

    if (user == null) {
        // Create new user if they don't exist
        user = new User(userId);
        user.createdAt = event.block.timestamp;
        user.totalPosts = BigInt.fromI32(0);
        user.totalLikes = BigInt.fromI32(0);
        user.totalComments = BigInt.fromI32(0);
        user.totalEcoVerifications = BigInt.fromI32(0);
        user.totalEcoRewards = BigInt.fromI32(0);
        user.tokenBalance = BigInt.fromI32(0);
    }

    // Update handle
    user.handle = event.params.handle;
    user.save();
}
