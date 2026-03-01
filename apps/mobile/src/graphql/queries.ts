import { gql } from '@apollo/client';

/**
 * GraphQL Queries for Mobile App
 * 
 * These queries interact with The Graph Node to fetch data from the blockchain.
 */

/**
 * Get user profile and stats from The Graph
 */
export const GET_USER_PROFILE = gql`
  query GetUserProfile($wallet: ID!) {
    user(id: $wallet) {
      id
      tokenBalance
      totalEcoRewards
      totalPosts
      totalLikes
      createdAt
      updatedAt
    }
  }
`;

/**
 * Get eco-verified feed (posts that passed ML verification)
 */
export const GET_ECO_FEED = gql`
  query GetEcoFeed($limit: Int!, $skip: Int!) {
    posts(
      first: $limit
      skip: $skip
      where: { isEcoVerified: true }
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      contentCID
      author {
        id
      }
      isEcoVerified
      mlVerdict
      likesCount
      commentsCount
      createdAt
    }
  }
`;

/**
 * Get all posts from a specific user
 */
export const GET_USER_POSTS = gql`
  query GetUserPosts($wallet: ID!, $limit: Int!, $skip: Int!) {
    posts(
      first: $limit
      skip: $skip
      where: { author: $wallet }
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      contentCID
      author {
        id
      }
      isEcoVerified
      mlVerdict
      likesCount
      commentsCount
      createdAt
    }
  }
`;

/**
 * Get recent verifications (for dashboard/activity feed)
 */
export const GET_RECENT_VERIFICATIONS = gql`
  query GetRecentVerifications($limit: Int!) {
    verifications(
      first: $limit
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      post {
        id
        contentCID
        author {
          id
        }
      }
      isEcoContent
      mlVerdict
      timestamp
    }
  }
`;

/**
 * Get leaderboard (top users by eco rewards)
 */
export const GET_LEADERBOARD = gql`
  query GetLeaderboard($limit: Int!) {
    users(
      first: $limit
      orderBy: totalEcoRewards
      orderDirection: desc
    ) {
      id
      tokenBalance
      totalEcoRewards
      totalPosts
    }
  }
`;

/**
 * Get single post details
 */
export const GET_POST_DETAILS = gql`
  query GetPostDetails($postId: ID!) {
    post(id: $postId) {
      id
      contentCID
      author {
        id
        tokenBalance
        totalEcoRewards
      }
      isEcoVerified
      mlVerdict
      likesCount
      commentsCount
      createdAt
    }
  }
`;
