# 🔎 PHASE 5: GRAPHQL QUERIES FOR FRONTEND

This document contains GraphQL query examples for querying the ECO-DMS subgraph.

## 📋 Table of Contents

1. [User Queries](#user-queries)
2. [Post Queries](#post-queries)
3. [Social Queries](#social-queries)
4. [Verification Queries](#verification-queries)
5. [Reward Queries](#reward-queries)
6. [Dashboard Queries](#dashboard-queries)
7. [Frontend Integration](#frontend-integration)

---



### Get User Profile with Stats

```graphql
query GetUserProfile($userId: ID!) {
  user(id: $userId) {
    id
    handle
    createdAt
    totalPosts
    totalLikes
    totalComments
    totalEcoVerifications
    totalEcoRewards
    tokenBalance
    lastRewardTime
  }
}
```

**Variables:**
```json
{
  "userId": "0x1234567890abcdef1234567890abcdef12345678"
}
```

### Get Top Eco Contributors (Leaderboard)

```graphql
query GetTopContributors($first: Int = 10) {
  users(
    first: $first
    orderBy: totalEcoRewards
    orderDirection: desc
    where: { totalEcoRewards_gt: "0" }
  ) {
    id
    handle
    totalEcoVerifications
    totalEcoRewards
    tokenBalance
    posts(first: 3, orderBy: timestamp, orderDirection: desc) {
      id
      contentCID
      isEcoVerified
      ecoConfidence
    }
  }
}
```

---

## 📝 Post Queries

### Get User Timeline (All Posts)

```graphql
query GetUserTimeline($userId: ID!, $first: Int = 20, $skip: Int = 0) {
  user(id: $userId) {
    id
    handle
    posts(
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      contentCID
      contentType
      timestamp
      totalLikes
      totalComments
      totalShares
      isEcoVerified
      ecoConfidence
      verification {
        id
        isEco
        confidence
        timestamp
      }
    }
  }
}
```

### Get Eco-Verified Posts (Feed)

```graphql
query GetEcoFeed($first: Int = 20, $skip: Int = 0) {
  posts(
    first: $first
    skip: $skip
    orderBy: timestamp
    orderDirection: desc
    where: { isEcoVerified: true }
  ) {
    id
    contentCID
    author {
      id
      handle
      totalEcoVerifications
    }
    timestamp
    totalLikes
    totalComments
    isEcoVerified
    ecoConfidence
    verification {
      isEco
      confidence
      blockTimestamp
    }
  }
}
```

### Get Single Post with Verification

```graphql
query GetPost($postId: ID!) {
  post(id: $postId) {
    id
    contentCID
    contentType
    author {
      id
      handle
      tokenBalance
    }
    timestamp
    totalLikes
    totalComments
    totalShares
    isEcoVerified
    ecoConfidence
    verification {
      id
      isEco
      confidence
      timestamp
      nonce
      transactionHash
    }
  }
}
```

---

## 💬 Social Queries

### Get Likes for a Post

```graphql
query GetPostLikes($postId: ID!, $first: Int = 50) {
  edges(
    first: $first
    where: { 
      edgeType: LIKE
      post: $postId 
    }
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    from {
      id
      handle
    }
    timestamp
  }
}
```

### Get Comments for a Post

```graphql
query GetPostComments($postId: ID!, $first: Int = 50) {
  edges(
    first: $first
    where: { 
      edgeType: COMMENT
      post: $postId 
    }
    orderBy: timestamp
    orderDirection: asc
  ) {
    id
    from {
      id
      handle
    }
    contentCID
    timestamp
  }
}
```

### Get User's Followers

```graphql
query GetFollowers($userId: ID!, $first: Int = 100) {
  edges(
    first: $first
    where: { 
      edgeType: FOLLOW
      to: $userId 
    }
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    from {
      id
      handle
      totalPosts
      totalEcoVerifications
    }
    timestamp
  }
}
```

---

## ✅ Verification Queries

### Get All Verifications for User

```graphql
query GetUserVerifications($userId: ID!, $first: Int = 20) {
  verifications(
    first: $first
    where: { wallet: $userId }
    orderBy: blockTimestamp
    orderDirection: desc
  ) {
    id
    postCid
    post {
      contentCID
      contentType
    }
    isEco
    confidence
    timestamp
    blockTimestamp
    transactionHash
  }
}
```

### Get Recent Eco Verifications (Global)

```graphql
query GetRecentVerifications($first: Int = 20) {
  verifications(
    first: $first
    where: { isEco: true }
    orderBy: blockTimestamp
    orderDirection: desc
  ) {
    id
    postCid
    wallet {
      id
      handle
    }
    isEco
    confidence
    blockTimestamp
  }
}
```

---

## 🎁 Reward Queries

### Get User Rewards History

```graphql
query GetUserRewards($userId: ID!, $first: Int = 50) {
  rewards(
    first: $first
    where: { recipient: $userId }
    orderBy: blockTimestamp
    orderDirection: desc
  ) {
    id
    postCid
    post {
      contentCID
    }
    amount
    timestamp
    blockTimestamp
    transactionHash
  }
}
```

### Get Daily Earnings (Last 24 Hours)

```graphql
query GetDailyEarnings($userId: ID!, $timestamp24hAgo: BigInt!) {
  rewards(
    where: { 
      recipient: $userId
      blockTimestamp_gt: $timestamp24hAgo
    }
  ) {
    id
    amount
    blockTimestamp
  }
}
```

**JavaScript to calculate timestamp:**
```javascript
const timestamp24hAgo = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
```

---

## 📊 Dashboard Queries

### Complete Dashboard Data (Single Query)

```graphql
query GetDashboard($userId: ID!, $timestamp24hAgo: BigInt!) {
  user(id: $userId) {
    id
    handle
    tokenBalance
    totalEcoVerifications
    totalEcoRewards
    totalPosts
    
    # Recent posts
    posts(first: 5, orderBy: timestamp, orderDirection: desc) {
      id
      contentCID
      isEcoVerified
      ecoConfidence
      timestamp
    }
    
    # Lifetime rewards
    rewards(orderBy: blockTimestamp, orderDirection: desc) {
      id
      amount
      blockTimestamp
    }
    
    # Today's rewards
    recentRewards: rewards(
      where: { blockTimestamp_gt: $timestamp24hAgo }
    ) {
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
```

### Global Platform Stats

```graphql
query GetPlatformStats {
  globalStats(id: "global") {
    totalUsers
    totalPosts
    totalLikes
    totalComments
    totalFollows
    totalVerifications
    totalEcoVerifiedPosts
    totalRewardsMinted
    lastUpdatedTimestamp
  }
}
```

---

## 🛠️ Frontend Integration

### React Hook Example

```typescript
// hooks/useSubgraph.ts
import { useQuery } from '@apollo/client';
import { gql } from '@apollo/client';

const GET_USER_PROFILE = gql`
  query GetUserProfile($userId: ID!) {
    user(id: $userId) {
      id
      handle
      tokenBalance
      totalEcoVerifications
      totalEcoRewards
    }
  }
`;

export function useUserProfile(walletAddress: string | null) {
  const { data, loading, error } = useQuery(GET_USER_PROFILE, {
    variables: { userId: walletAddress?.toLowerCase() },
    skip: !walletAddress,
  });

  return {
    user: data?.user,
    loading,
    error,
  };
}
```

### Apollo Client Setup

```typescript
// config/apollo.ts
import { ApolloClient, InMemoryCache } from '@apollo/client';

export const client = new ApolloClient({
  uri: 'http://127.0.0.1:8000/subgraphs/name/eco-dms', // Local Graph Node
  // OR for hosted service:
  // uri: 'https://api.thegraph.com/subgraphs/name/your-username/eco-dms',
  cache: new InMemoryCache(),
});
```

### Usage in Component

```tsx
// pages/Profile.tsx
import { useUserProfile } from '../hooks/useSubgraph';
import { useAccount } from 'wagmi';

export function Profile() {
  const { address } = useAccount();
  const { user, loading } = useUserProfile(address);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>{user?.handle || 'Anonymous'}</h1>
      <p>ECO Balance: {user?.tokenBalance}</p>
      <p>Verifications: {user?.totalEcoVerifications}</p>
      <p>Total Earned: {user?.totalEcoRewards}</p>
    </div>
  );
}
```

---

## 🚀 Performance Tips

### 1. **Use Pagination**
```graphql
query GetPosts($first: Int = 20, $skip: Int = 0) {
  posts(first: $first, skip: $skip, orderBy: timestamp, orderDirection: desc) {
    id
    # ...
  }
}
```

### 2. **Filter Early**
```graphql
# ✅ Good: Filter at query level
posts(where: { isEcoVerified: true }) { }

# ❌ Bad: Fetch all, filter client-side
```

### 3. **Request Only Needed Fields**
```graphql
# ✅ Good: Minimal fields
posts { id, contentCID, timestamp }

# ❌ Bad: Overfetching
posts { id, contentCID, timestamp, author { posts { verification { ... } } } }
```

### 4. **Cache Aggressively**
```typescript
const { data } = useQuery(GET_POSTS, {
  fetchPolicy: 'cache-first', // Use cache when available
});
```

---

## 📝 Notes

- **All IDs are lowercase**: Ethereum addresses are stored as lowercase hex strings
- **BigInt handling**: Use libraries like `ethers.js` to format BigInt values
- **IPFS CIDs**: Fetch content from IPFS using `contentCID` field
- **Real-time updates**: Use GraphQL subscriptions for live data (requires WebSocket support)

---

## 🔗 Related Files

- [schema.graphql](../schema.graphql) - Entity definitions
- [subgraph.yaml](../subgraph.yaml) - Subgraph configuration
- [verification-mapping.ts](../src/verification-mapping.ts) - Event handlers
