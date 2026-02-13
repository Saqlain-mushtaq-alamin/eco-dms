import { gql } from '@apollo/client'

/**
 * Get user earnings and stats from The Graph
 */
export const GET_USER_EARNINGS = gql`
  query GetUserEarnings($wallet: ID!, $todayStart: BigInt!) {
    user(id: $wallet) {
      id
      tokenBalance
      totalEcoRewards
      totalEcoVerifications
      lastRewardTime
      createdAt
      
      # All rewards for lifetime calculation
      rewards {
        id
        amount
        timestamp
        postCid
      }
    }
    
    # Today's rewards (for today's earnings)
    todayRewards: rewards(
      where: { 
        recipient: $wallet
        timestamp_gte: $todayStart 
      }
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      amount
      timestamp
    }
  }
`

/**
 * Get just user token balance (lightweight query)
 */
export const GET_USER_BALANCE = gql`
  query GetUserBalance($wallet: ID!) {
    user(id: $wallet) {
      id
      tokenBalance
    }
  }
`

/**
 * Get user stats overview
 */
export const GET_USER_STATS = gql`
  query GetUserStats($wallet: ID!) {
    user(id: $wallet) {
      id
      tokenBalance
      totalEcoRewards
      totalEcoVerifications
      totalPosts
      totalLikes
      totalComments
      lastRewardTime
      createdAt
    }
  }
`
