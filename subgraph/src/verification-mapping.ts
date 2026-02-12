/**
 * VERIFICATION MAPPING
 * Handles ML verification and reward events from Verification contract
 */

import { BigInt, Address, Bytes } from "@graphprotocol/graph-ts";
import {
    PostVerified,
    RewardMinted,
    VerifierAdded,
    VerifierRemoved,
} from "../generated/Verification/Verification";
import {
    User,
    Post,
    Verification,
    Reward,
    GlobalStats,
} from "../generated/schema";

/**
 * Handle PostVerified event
 * Records ML verification result on-chain
 */
export function handlePostVerified(event: PostVerified): void {
    const postCid = event.params.postCid.toString(); // Convert Bytes to string
    const wallet = event.params.wallet;
    const isEco = event.params.isEco;
    const confidence = event.params.confidence;
    const timestamp = event.params.timestamp;
    const nonce = event.params.nonce;

    // Load or create user
    let user = loadOrCreateUser(wallet, event.block.timestamp);

    // Load or create post
    let post = loadOrCreatePost(postCid, wallet, event.block.timestamp);
    post.isEcoVerified = isEco;
    post.ecoConfidence = confidence;
    post.save();

    // Create verification record
    const verificationId = event.transaction.hash
        .toHex()
        .concat("-")
        .concat(event.logIndex.toString());
    let verification = new Verification(verificationId);
    verification.postCid = postCid;
    verification.wallet = user.id;
    verification.post = post.id;
    verification.isEco = isEco;
    verification.confidence = confidence;
    verification.timestamp = timestamp;
    verification.nonce = nonce;
    verification.transactionHash = event.transaction.hash;
    verification.blockNumber = event.block.number;
    verification.blockTimestamp = event.block.timestamp;
    verification.save();

    // Update user stats
    user.totalEcoVerifications = user.totalEcoVerifications.plus(
        BigInt.fromI32(1)
    );
    if (isEco) {
        user.lastRewardTime = event.block.timestamp;
    }
    user.save();

    // Update global stats
    let stats = loadOrCreateGlobalStats();
    stats.totalVerifications = stats.totalVerifications.plus(BigInt.fromI32(1));
    if (isEco) {
        stats.totalEcoVerifiedPosts = stats.totalEcoVerifiedPosts.plus(
            BigInt.fromI32(1)
        );
    }
    stats.lastUpdatedTimestamp = event.block.timestamp;
    stats.save();
}

/**
 * Handle RewardMinted event
 * Records ECO token rewards for verified eco-friendly posts
 */
export function handleRewardMinted(event: RewardMinted): void {
    const wallet = event.params.wallet;
    const postCid = event.params.postCid.toString(); // Convert Bytes to string
    const amount = event.params.amount;
    const timestamp = event.params.timestamp;

    // Load user
    let user = loadOrCreateUser(wallet, event.block.timestamp);

    // Load post
    let post = loadOrCreatePost(postCid, wallet, event.block.timestamp);
    // Create reward record
    const rewardId = event.transaction.hash
        .toHex()
        .concat("-")
        .concat(event.logIndex.toString());
    let reward = new Reward(rewardId);
    reward.recipient = user.id;
    reward.postCid = postCid;
    reward.post = post.id;
    reward.amount = amount;
    reward.timestamp = timestamp;
    reward.transactionHash = event.transaction.hash;
    reward.blockNumber = event.block.number;
    reward.blockTimestamp = event.block.timestamp;
    reward.save();

    // Update user stats
    user.totalEcoRewards = user.totalEcoRewards.plus(amount);
    user.save();

    // Update global stats
    let stats = loadOrCreateGlobalStats();
    stats.totalRewardsMinted = stats.totalRewardsMinted.plus(amount);
    stats.lastUpdatedTimestamp = event.block.timestamp;
    stats.save();
}

/**
 * Handle VerifierAdded event (optional tracking)
 */
export function handleVerifierAdded(event: VerifierAdded): void {
    // Could track authorized verifiers if needed
}

/**
 * Handle VerifierRemoved event (optional tracking)
 */
export function handleVerifierRemoved(event: VerifierRemoved): void {
    // Could track verifier removals if needed
}

// ==================
// HELPER FUNCTIONS
// ==================

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
        user.save();

        // Update global user count
        let stats = loadOrCreateGlobalStats();
        stats.totalUsers = stats.totalUsers.plus(BigInt.fromI32(1));
        stats.save();
    }

    return user as User;
}

/**
 * Load existing post or create new one
 */
function loadOrCreatePost(
    postCid: string,
    author: Address,
    timestamp: BigInt
): Post {
    let post = Post.load(postCid);

    if (post == null) {
        post = new Post(postCid);
        post.author = author.toHex();
        post.contentCID = postCid;
        post.timestamp = timestamp;
        post.totalLikes = BigInt.fromI32(0);
        post.totalComments = BigInt.fromI32(0);
        post.totalShares = BigInt.fromI32(0);
        post.isEcoVerified = false;
        post.save();

        // Ensure author user exists
        let user = loadOrCreateUser(author, timestamp);
        user.totalPosts = user.totalPosts.plus(BigInt.fromI32(1));
        user.save();

        // Update global stats
        let stats = loadOrCreateGlobalStats();
        stats.totalPosts = stats.totalPosts.plus(BigInt.fromI32(1));
        stats.save();
    }

    return post as Post;
}

/**
 * Load or create global statistics
 */
function loadOrCreateGlobalStats(): GlobalStats {
    const statsId = "global";
    let stats = GlobalStats.load(statsId);

    if (stats == null) {
        stats = new GlobalStats(statsId);
        stats.totalUsers = BigInt.fromI32(0);
        stats.totalPosts = BigInt.fromI32(0);
        stats.totalLikes = BigInt.fromI32(0);
        stats.totalComments = BigInt.fromI32(0);
        stats.totalFollows = BigInt.fromI32(0);
        stats.totalVerifications = BigInt.fromI32(0);
        stats.totalEcoVerifiedPosts = BigInt.fromI32(0);
        stats.totalRewardsMinted = BigInt.fromI32(0);
        stats.totalRewardRecipients = BigInt.fromI32(0);
        stats.lastUpdatedTimestamp = BigInt.fromI32(0);
        stats.save();
    }

    return stats as GlobalStats;
}
