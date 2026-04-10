# Decentralized Social Media Architecture

## Overview
This is a **fully decentralized** social media platform using IPFS for off-chain storage. No centralized database needed!

## How It Works

### 🎯 **Core Concept: Everything on IPFS**

All data is stored on IPFS/Pinata as immutable JSON files:
- Posts → IPFS
- Comments → IPFS
- Likes → IPFS
- User profiles → IPFS
- Indices (lists of CIDs) → IPFS

### 📊 **Data Structure**

```
User Profile (IPFS)
├── wallet_address
├── username, bio, avatar
└── posts_index_cid → Points to Posts Index

Posts Index (IPFS)
├── author_wallet
├── cids: [post1_cid, post2_cid, ...]
└── updated_at

Individual Post (IPFS)
├── cid (unique identifier)
├── author_wallet
├── content
├── media_cids
├── created_at
├── likes_index_cid → Points to Likes Index
└── comments_index_cid → Points to Comments Index

Likes Index (IPFS)
├── post_cid
├── likes: [wallet1, wallet2, ...]
└── count

Comments Index (IPFS)
├── post_cid
├── comments: [comment_cid1, comment_cid2, ...]
└── count

Individual Comment (IPFS)
├── cid
├── post_cid (parent post)
├── author_wallet
├── content
└── created_at
```

## ✅ Features Supported

### Current Features:
- ✅ **Posts** - Create, read, list posts
- ✅ **Likes** - Like/unlike posts
- ✅ **Comments** - Comment on posts
- ✅ **Social metrics** - Counts for likes/comments
- ✅ **User check** - See if user liked a post

### Easy to Add:
- **Follows/Followers** - Same pattern as likes
- **Reposts/Shares** - Store as posts with reference
- **Media** - Already supported (media_cids)
- **Hashtags** - Already supported (tags)
- **Mentions** - Parse from content
- **Notifications** - Event-based from wallet activity
- **Direct Messages** - Encrypted posts between users

## 🔧 API Endpoints

### Posts
```
POST   /api/posts                    - Create post
GET    /api/posts/{wallet}           - Get user's posts
```

### Likes
```
POST   /api/posts/{cid}/like         - Like a post
DELETE /api/posts/{cid}/like         - Unlike a post
GET    /api/posts/{cid}/likes        - Get post likes
```

### Comments
```
POST   /api/posts/{cid}/comments     - Add comment
GET    /api/posts/{cid}/comments     - Get post comments
```

## 🌐 Why This Works for Social Media

### Advantages:
1. **Censorship Resistant** - Data on IPFS can't be deleted
2. **User Owns Data** - You control your content CIDs
3. **No Central Server** - IPFS is distributed
4. **Portable** - Take your CIDs anywhere
5. **Verifiable** - Content can't be tampered with
6. **Scalable** - IPFS handles large files/media

### How It Compares:

| Feature | Traditional Social | This Platform |
|---------|-------------------|---------------|
| Data Storage | Centralized DB | IPFS (decentralized) |
| Censorship | Platform controls | User controls |
| Portability | Locked in | CIDs are portable |
| Content Integrity | Can be modified | Immutable |
| Media Storage | CDN | IPFS |
| Cost | Pay for servers | Pay for pinning |

## 🚀 Scaling Considerations

### Current Implementation:
- In-memory cache for index CIDs
- Works great for POC and small-medium scale

### For Production Scale:
1. **Cache Layer** - Redis for index CID lookups
2. **GraphQL Subgraph** - Index events on-chain for discovery
3. **CDN** - IPFS gateway with caching
4. **Push Notifications** - WebSockets + event stream
5. **Search** - Index content in Elasticsearch/Algolia
6. **Timeline Algorithm** - Aggregate feeds from follows

## 🔐 Authentication
- SIWE (Sign-In with Ethereum)
- Wallet-based identity
- JWT tokens for API access

## 📝 Example Flow: Creating a Post

1. User creates post → Frontend sends to API
2. API pins post to IPFS → Gets `post_cid`
3. API updates user's posts index → Pins new index → Gets `index_cid`
4. API caches `index_cid` for user
5. Post is now discoverable via user's index

## 💡 Best Practices

1. **Always cache index CIDs** - Avoid repeated IPFS lookups
2. **Batch operations** - Update indices efficiently
3. **Use Pinata/Web3.Storage** - Reliable pinning service
4. **Implement pagination** - Don't load all posts at once
5. **Add metadata** - Timestamps, versions, etc.

## 🎨 Frontend Integration

The frontend can:
- Display posts with likes/comments counts
- Show "liked by user" state
- Real-time updates (poll or WebSocket)
- Infinite scroll with pagination
- Media preview from IPFS gateway

## 🔮 Future Enhancements

- **On-chain hooks** - Emit events for important actions
- **Token gating** - Require token to post/interact
- **NFT integration** - Display NFTs, use as avatars
- **Encrypted DMs** - Private messages via encryption
- **DAO governance** - Community moderation
- **Reputation system** - Based on on-chain activity

---

**This is a fully functional decentralized social media platform!** 🎉
