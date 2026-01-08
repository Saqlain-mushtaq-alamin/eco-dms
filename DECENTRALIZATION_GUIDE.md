# 🌐 Full Decentralization Architecture Guide

## Overview

Your social media platform is now **FULLY DECENTRALIZED**! No centralized database stores user data permanently.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    USER'S WALLET (SIWE)                      │
│                     ↓ Controls ↓                             │
│                   DID (Decentralized ID)                     │
│          did:pkh:eip155:1:0x123...abc                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              CERAMIC NETWORK (Decentralized)                 │
│  ┌───────────────┬────────────────┬─────────────────┐       │
│  │ UserProfile   │  AuthorPosts   │  SocialGraph    │       │
│  │ Stream        │  Stream        │  Stream         │       │
│  │ (User owns)   │  (User owns)   │  (User owns)    │       │
│  └───────────────┴────────────────┴─────────────────┘       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│           IPFS/Pinata (Decentralized Storage)                │
│  • Post Content (immutable)                                  │
│  • Images/Media (immutable)                                  │
│  • Profile Data (immutable snapshots)                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│         YOUR BACKEND (Gateway Only - No Data Storage)        │
│  • Helps users interact with Ceramic                         │
│  • Validates signatures                                      │
│  • Temporary cache (Redis) for performance ONLY              │
└─────────────────────────────────────────────────────────────┘
```

## What Each Component Does

### 🔐 **User's Wallet (SIWE - Sign-In With Ethereum)**
- User authenticates with their wallet signature
- No passwords, no usernames stored centrally
- Wallet = Identity = DID

### 🆔 **DID (Decentralized Identifier)**
- Format: `did:pkh:eip155:1:0xYourWalletAddress`
- User's unique identifier across the decentralized web
- Controls all their data on Ceramic

### 🏺 **Ceramic Network (Mutable Decentralized Storage)**
**What it stores:**
1. **UserProfile Stream** - Username, bio, avatar CID
2. **AuthorPosts Stream** - List of post CIDs (mutable)
3. **SocialGraph Stream** - Following/followers relationships

**Key Features:**
- ✅ User owns and controls their data via their DID
- ✅ Data is mutable (can be updated)
- ✅ Decentralized (runs on Ceramic nodes worldwide)
- ✅ Queryable via ComposeDB (GraphQL)
- ✅ No single point of failure

### 📦 **IPFS/Pinata (Immutable Content Storage)**
**What it stores:**
- Actual post content (text, data)
- Images and media files
- Profile snapshots

**Key Features:**
- ✅ Content-addressed (CID)
- ✅ Immutable (can't be changed)
- ✅ Decentralized
- ✅ Permanent storage

### 🖥️ **Your Backend (Gateway/Helper)**
**What it does:**
- ✅ Helps users create Ceramic streams
- ✅ Validates SIWE signatures
- ✅ Pins content to IPFS/Pinata
- ✅ Provides API endpoints for frontend

**What it DOESN'T store:**
- ❌ User profiles (on Ceramic)
- ❌ Posts index (on Ceramic)
- ❌ Social graph (on Ceramic)
- ❌ User registry (query Ceramic instead)

**Redis Usage (Optional):**
- ✅ Temporary nonces (5 min expiration) - for login
- ✅ Rate limiting (60 sec expiration) - prevent spam
- ✅ Optional cache (30 day expiration) - can be rebuilt from Ceramic
- ❌ NO permanent data storage!

## Setup Instructions

### 1. Install Ceramic Node

```bash
npm install -g @ceramicnetwork/cli
```

### 2. Start Ceramic Daemon

```bash
ceramic daemon --network testnet-clay
```

Or for local development:
```bash
ceramic daemon
```

Default URL: `http://localhost:7007`

### 3. Install ComposeDB CLI

```bash
npm install -g @composedb/cli
```

### 4. Compile Your Ceramic Schema

```powershell
cd backend/ceramic
.\compile.ps1
```

This will:
1. Create the composite from `schema.graphql`
2. Deploy to Ceramic
3. Generate model stream IDs

### 5. Update `.env` File

```env
# Ceramic Configuration
CERAMIC_API_URL=http://localhost:7007
CERAMIC_POSTS_MODEL_STREAM=kjzl6hvfrbw6c...  # Copy from compile output
CERAMIC_PROFILE_MODEL_STREAM=kjzl6hvfrbw6c... # Copy from compile output
CERAMIC_SOCIAL_MODEL_STREAM=kjzl6hvfrbw6c...  # Copy from compile output

# Redis (Optional - for caching only)
REDIS_URL=redis://127.0.0.1:6379/0

# IPFS/Pinata
PINATA_JWT=your_pinata_jwt_here
```

### 6. Start Your Backend

```bash
make dev
```

## Data Flow Examples

### Creating a Post (Fully Decentralized)

```
1. User signs post with wallet
2. Backend validates signature
3. Post content → IPFS → Returns CID
4. User's AuthorPosts stream updated on Ceramic
   - DID controls the stream
   - Stream contains array of post CIDs
5. Backend doesn't store anything permanently!
```

### Viewing User Profile

```
1. Frontend requests profile for wallet address
2. Backend converts wallet → DID
3. Query Ceramic for UserProfile stream by DID
4. Ceramic returns profile data
5. Backend returns to frontend
6. Optional: Cache in Redis for 30 days (performance)
```

### Following a User

```
1. User A follows User B
2. User A's SocialGraph stream updated:
   - Add User B to "following" array
3. User B's SocialGraph stream updated:
   - Add User A to "followers" array
4. Both updates happen on Ceramic
5. Users control their own social graph data
```

## Benefits of This Architecture

### ✅ **True Decentralization**
- No central database
- No single point of failure
- Users own their data

### ✅ **Censorship Resistant**
- You can't delete user data (they own it)
- No central authority controls content
- Data lives on decentralized networks

### ✅ **Privacy & Control**
- Users control their data via DID
- Can revoke access anytime
- Can export/migrate data

### ✅ **Interoperability**
- Data follows web3 standards (DID, Ceramic, IPFS)
- Can be used by other apps
- True data portability

### ✅ **Cost Efficient**
- You don't pay for database hosting
- Users pin their own data
- IPFS/Ceramic handle storage

## Migration from Current System

If you have existing data in Redis:

1. **User Profiles:**
   - Read profile CIDs from Redis
   - Fetch data from IPFS
   - Create Ceramic UserProfile streams
   - Users now own their profiles!

2. **Posts Indexes:**
   - Read posts index CIDs from Redis
   - Fetch post lists from IPFS
   - Create Ceramic AuthorPosts streams
   - Delete from Redis

3. **User Registry:**
   - Query all users from Redis
   - Create Ceramic profiles for each
   - Delete registry from Redis
   - Use Ceramic ComposeDB queries instead

## Ceramic Schema Models

### UserProfile
```graphql
type UserProfile
  @createModel(accountRelation: SINGLE, description: "User profile data controlled by DID")
{
  author: DID! @documentAccount
  username: String @string(maxLength: 50)
  bio: String @string(maxLength: 500)
  avatarCID: String @string(maxLength: 200)
  profileCID: String @string(maxLength: 200)
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

### AuthorPosts
```graphql
type AuthorPosts
  @createModel(accountRelation: SINGLE, description: "Posts CIDs per author")
{
  author: DID! @documentAccount
  cids: [String!]! @list(maxLength: 10000) @string(maxLength: 200)
}
```

### SocialGraph
```graphql
type SocialGraph
  @createModel(accountRelation: SINGLE, description: "Following/followers relationships")
{
  author: DID! @documentAccount
  following: [String!]! @list(maxLength: 5000) @string(maxLength: 100)
  followers: [String!]! @list(maxLength: 5000) @string(maxLength: 100)
}
```

## Querying Data with ComposeDB

### Get User Profile
```graphql
query GetProfile($did: ID!) {
  node(id: $did) {
    ... on UserProfile {
      username
      bio
      avatarCID
      createdAt
      updatedAt
    }
  }
}
```

### Get All Posts for User
```graphql
query GetUserPosts($did: ID!) {
  node(id: $did) {
    ... on AuthorPosts {
      cids
    }
  }
}
```

### Get All Users
```graphql
query GetAllUsers {
  userProfileIndex(first: 100) {
    edges {
      node {
        author { id }
        username
        bio
        avatarCID
      }
    }
  }
}
```

## Testing Decentralization

### Test 1: Kill Redis
```bash
# Stop Redis
redis-cli shutdown

# Your app should still work!
# - Login might fail (nonces stored in Redis temporarily)
# - But all user data is accessible from Ceramic
```

### Test 2: Kill Backend Server
```bash
# Stop your backend
Ctrl+C

# Restart it
make dev

# All data should still be there!
# - Posts visible
# - Profiles accessible
# - Nothing lost
```

### Test 3: Access Data from Another App
```javascript
// Any app can read Ceramic data!
import { CeramicClient } from '@ceramicnetwork/http-client'

const ceramic = new CeramicClient('http://localhost:7007')
const doc = await ceramic.loadStream('streamId')
console.log(doc.content) // User's data!
```

## Future Enhancements

1. **User-Controlled Pinning**
   - Let users pin their own posts to IPFS
   - Remove backend as middleman

2. **Direct Ceramic Writes from Frontend**
   - Frontend can write directly to user's Ceramic streams
   - Backend becomes truly optional

3. **IPFS Cluster**
   - Distribute IPFS pinning across multiple nodes
   - More resilient content storage

4. **OrbitDB for Real-time Updates**
   - Decentralized database built on IPFS
   - Real-time collaborative editing

## Summary

✅ **Users own their data** via Ceramic DID streams  
✅ **No centralized database** for permanent storage  
✅ **Backend is just a gateway** - can be replaced  
✅ **Redis is optional** - only for temporary caching  
✅ **Fully censorship-resistant** - you can't delete user data  
✅ **Interoperable** - data can be used by other apps  

**You now have a TRULY decentralized social media platform! 🎉**
