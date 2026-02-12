import { gql } from '@apollo/client';

/**
 * GRAPHQL QUERY FRAGMENTS
 * Reusable pieces of queries
 */

export const USER_FRAGMENT = gql`
  fragment UserFields on User {
    id
    handle
    totalPosts
    totalEcoVerifications
    totalEcoRewards
    tokenBalance
    lastRewardTime
    createdAt
  }
`;

export const POST_FRAGMENT = gql`
  fragment PostFields on Post {
    id
    contentCID
    author {
      id
      handle
    }
    timestamp
    totalLikes
    totalComments
    totalShares
    isEcoVerified
    ecoConfidence
  }
`;

export const VERIFICATION_FRAGMENT = gql`
  fragment VerificationFields on Verification {
    id
    postCid
    isEco
    confidence
    timestamp
    transactionHash
  }
`;

export const REWARD_FRAGMENT = gql`
  fragment RewardFields on Reward {
    id
    postCid
    amount
    timestamp
    transactionHash
  }
`;

/**
 * FEED QUERIES
 */

// Get eco-verified posts feed (replaces /api/posts/feed/timeline)
export const GET_ECO_FEED = gql`
  ${POST_FRAGMENT}
  query GetEcoFeed($first: Int = 20, $skip: Int = 0) {
    posts(
      first: $first
      skip: $skip
      where: { isEcoVerified: true }
      orderBy: timestamp
      orderDirection: desc
    ) {
      ...PostFields
      verification {
        confidence
        timestamp
      }
    }
  }
`;

// Get user timeline (all posts from a user)
export const GET_USER_TIMELINE = gql`
  ${POST_FRAGMENT}
  query GetUserTimeline($userId: ID!, $first: Int = 20, $skip: Int = 0) {
    user(id: $userId) {
      id
      handle
      totalPosts
      posts(first: $first, skip: $skip, orderBy: timestamp, orderDirection: desc) {
        ...PostFields
      }
    }
  }
`;

// Get recent posts (all posts, eco and non-eco)
export const GET_RECENT_POSTS = gql`
  ${POST_FRAGMENT}
  query GetRecentPosts($first: Int = 20, $skip: Int = 0) {
    posts(
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: desc
    ) {
      ...PostFields
    }
  }
`;

/**
 * USER QUERIES
 */

// Get user profile with stats (replaces /api/users/me for reading)
export const GET_USER_PROFILE = gql`
  ${USER_FRAGMENT}
  query GetUserProfile($userId: ID!) {
    user(id: $userId) {
      ...UserFields
    }
  }
`;

// Get leaderboard (replaces /api/users/all for stats)
export const GET_LEADERBOARD = gql`
  ${USER_FRAGMENT}
  query GetLeaderboard($first: Int = 10) {
    users(
      first: $first
      orderBy: totalEcoRewards
      orderDirection: desc
      where: { totalEcoRewards_gt: "0" }
    ) {
      ...UserFields
    }
  }
`;

// Get all users (for discovery)
export const GET_ALL_USERS = gql`
  ${USER_FRAGMENT}
  query GetAllUsers($first: Int = 50, $skip: Int = 0) {
    users(
      first: $first
      skip: $skip
      orderBy: createdAt
      orderDirection: desc
    ) {
      ...UserFields
    }
  }
`;

/**
 * EARNINGS QUERIES
 */

// Get user earnings (replaces /api/verify/earnings/{wallet})
export const GET_USER_EARNINGS = gql`
  ${REWARD_FRAGMENT}
  query GetUserEarnings($userId: ID!, $timestamp24hAgo: BigInt!) {
    user(id: $userId) {
      id
      totalEcoRewards
      totalEcoVerifications
      rewards(orderBy: timestamp, orderDirection: desc) {
        ...RewardFields
      }
      recentRewards: rewards(where: { timestamp_gt: $timestamp24hAgo }) {
        amount
      }
    }
  }
`;

/**
 * DASHBOARD QUERY
 */

// Complete dashboard data in one query
export const GET_DASHBOARD = gql`
  ${POST_FRAGMENT}
  ${REWARD_FRAGMENT}
  query GetDashboard($userId: ID!, $timestamp24hAgo: BigInt!) {
    user(id: $userId) {
      id
      handle
      tokenBalance
      totalEcoVerifications
      totalEcoRewards
      totalPosts
      
      # Recent eco-verified posts
      posts(
        first: 5
        where: { isEcoVerified: true }
        orderBy: timestamp
        orderDirection: desc
      ) {
        ...PostFields
      }
      
      # All rewards
      rewards(orderBy: timestamp, orderDirection: desc) {
        ...RewardFields
      }
      
      # Today's rewards
      recentRewards: rewards(where: { timestamp_gt: $timestamp24hAgo }) {
        amount
      }
    }
    
    # Global stats
    globalStats(id: "global") {
      totalUsers
      totalPosts
      totalEcoVerifiedPosts
      totalRewardsMinted
    }
  }
`;

/**
 * VERIFICATION QUERIES
 */

// Get user verifications
export const GET_USER_VERIFICATIONS = gql`
  ${VERIFICATION_FRAGMENT}
  query GetUserVerifications($userId: ID!, $first: Int = 20) {
    verifications(
      first: $first
      where: { wallet: $userId }
      orderBy: timestamp
      orderDirection: desc
    ) {
      ...VerificationFields
      post {
        contentCID
      }
    }
  }
`;

/**
 * SINGLE POST QUERY
 */

export const GET_POST = gql`
  ${POST_FRAGMENT}
  query GetPost($postId: ID!) {
    post(id: $postId) {
      ...PostFields
      verification {
        isEco
        confidence
        timestamp
        transactionHash
      }
    }
  }
`;

/**
 * GLOBAL STATS QUERY
 */

export const GET_GLOBAL_STATS = gql`
  query GetGlobalStats {
    globalStats(id: "global") {
      totalUsers
      totalPosts
      totalLikes
      totalComments
      totalVerifications
      totalEcoVerifiedPosts
      totalRewardsMinted
      lastUpdatedTimestamp
    }
  }
`;
