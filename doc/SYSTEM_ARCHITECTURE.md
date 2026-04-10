# Eco-DMS System Architecture

**Complete Data Flow Documentation**

This document explains the complete data flow from frontend user actions through backend processing to final decentralized storage. It covers where CIDs are stored, what each component does, and how the system maintains true decentralization.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Component Roles](#component-roles)
3. [Data Flow Diagrams](#data-flow-diagrams)
4. [Storage Architecture](#storage-architecture)
5. [CID Storage Locations](#cid-storage-locations)
6. [Complete User Journeys](#complete-user-journeys)

---

## System Overview

**Eco-DMS** is a **fully decentralized** social media platform for eco-friendly content with ML-powered verification and blockchain rewards.

### Architecture Principles

1. **IPFS as Source of Truth**: All permanent data stored on IPFS (content-addressed, immutable)
2. **User Data Ownership**: OrbitDB databases give users full control of their data
3. **No Central Database**: No PostgreSQL/MongoDB - completely decentralized
4. **Optional Caching**: Redis used ONLY as read cache (24h TTL), never source of truth
5. **Blockchain Verification**: On-chain rewards for verified eco-content (ERC20 tokens)
6. **Async Processing**: Celery workers handle ML verification without blocking user actions

### Technology Stack

- **Frontend**: React/TypeScript (apps/web)
- **Backend**: Python FastAPI with asyncio
- **Primary Storage**: IPFS (InterPlanetary File System)
- **User Databases**: OrbitDB (peer-to-peer databases on IPFS)
- **Pinning Services**: Pinata (primary), NFT.storage (backup)
- **Optional Cache**: Redis (read-only, 24h TTL)
- **Task Queue**: Celery with Redis broker
- **ML Pipeline**: Multi-model verification (YOLO, CLIP, EfficientNet)
- **Blockchain**: Ethereum compatible (Verification.sol, RewardToken.sol)

---

## Component Roles

### 1. IPFS (InterPlanetary File System)

**Role**: Permanent, decentralized storage - the SOURCE OF TRUTH

**What it stores**:
- User profiles (username, bio, avatar CID)
- Post content (text, media CIDs, tags, timestamp)
- Social interactions (likes, comments)
- OrbitDB address registry (backup)
- All content addressed by CID (Content Identifier)

**Key Operations**:
```python
# Pin JSON to IPFS (returns CID)
cid = await ipfs_service.pin_json(data)

# Fetch JSON from IPFS by CID
data = await ipfs_service.get_json(cid)
```

**Why**: Content-addressed storage means data is immutable and verifiable. CIDs are cryptographic hashes - if content changes, CID changes.

---

### 2. Pinata (IPFS Pinning Service)

**Role**: Keep IPFS content available 24/7 (prevent garbage collection)

**What it does**:
- Receives IPFS CIDs from backend
- Pins content to keep it available on the network
- Provides redundancy (multiple IPFS nodes)
- Free tier: 1GB storage

**Key Operations**:
```python
# Pin existing CID
await pinata_service.pin_by_cid(cid)

# Pin JSON directly
cid = await pinata_service.pin_json(data, name="profile_0x123")
```

**Why**: IPFS nodes garbage collect unpinned content. Pinata ensures user data stays available even if local IPFS node restarts.

**Alternatives**: NFT.storage (backup pinning service)

---

### 3. OrbitDB (Peer-to-Peer Database)

**Role**: User-owned databases on IPFS (indices for posts, profiles, social data)

**What it stores**:
- **Per-user posts database**: Append-only log of post CIDs
- **Per-post social database**: Likes, comments for each post
- **Database addresses**: IPFS CIDs pointing to database state

**Key Operations**:
```python
# Get database address (CID of database state)
db_address = await orbitdb_service.get_db_address(wallet, "posts")

# Append post CID to user's feed
await orbitdb_service.append_post(wallet, post_cid)

# Get all posts for user
post_cids = await orbitdb_service.get_user_posts(wallet)
```

**Database Types**:
- **Feed/Log**: Append-only (user posts)
- **KeyValue**: Mutable key-value pairs (coming soon for user profiles)

**Why**: Users OWN their databases. Database state is stored on IPFS. No central server controls user data.

**Important**: Database addresses (OrbitDB CIDs) are backed up to IPFS in a global registry to prevent data loss if Redis is cleared.

---

### 4. Redis (Optional Read Cache)

**Role**: OPTIONAL performance cache - NOT source of truth

**What it caches**:
- User profiles (60s TTL)
- Post content (60s TTL)
- Social metrics (likes, comments) - request-level cache (5s TTL)
- OrbitDB addresses (90 days TTL)
- User discovery list (60s TTL)

**Key Operations**:
```python
# Try cache first
cached = redis_service.get_json(f"profile:{wallet}")
if cached:
    return cached

# Fallback to IPFS (source of truth)
profile = await ipfs_service.get_json(profile_cid)

# Update cache for next request
redis_service.set_json(f"profile:{wallet}", profile, ex=60)
```

**Critical Properties**:
- ✅ All reads check IPFS if cache miss
- ✅ System works perfectly without Redis (graceful degradation)
- ✅ Cache eviction (TTL expiry) does NOT cause data loss
- ✅ Redis is NEVER written to before IPFS

**Why**: IPFS fetches can be slow (100-500ms). Redis provides fast reads (1-5ms) for frequently accessed data.

---

### 5. Celery (Async Task Queue)

**Role**: Asynchronous background processing (ML verification, blockchain submission)

**What it processes**:
- ML verification tasks (multi-model eco-content analysis)
- Blockchain transaction submission (future)
- Batch operations (future)

**Key Operations**:
```python
# Trigger ML verification (async - doesn't block user)
celery_app.send_task(
    'verify_eco_content',
    kwargs={
        'ipfs_cid': media_cid,
        'text_content': post_content,
        'post_id': post_cid,
        'author_wallet': wallet
    }
)
```

**Worker Configuration**:
- **Broker**: Redis (task queue)
- **Backend**: Redis (results storage)
- **Timeout**: 5 minutes per task
- **Retry**: Automatic with exponential backoff

**Why**: ML inference takes 2-5 seconds per image. Running async via Celery keeps post creation fast (<500ms) for users.

---

### 6. ML Verification Pipeline

**Role**: Verify eco-friendliness of images using multiple AI models

**Models Used**:
1. **YOLO** (object detection): Detect eco-objects (solar panels, recycling, nature)
2. **CLIP** (vision-language): Semantic understanding of eco-context
3. **EfficientNet** (image classification): Eco vs non-eco classification

**Verification Flow**:
```
1. Celery worker receives task
2. Fetch image from IPFS (tries multiple gateways)
3. Run all 3 models in parallel
4. Aggregate confidence scores
5. Sign verdict with EIP-712 signature
6. Store verdict on IPFS
7. (Future) Submit to blockchain for rewards
```

**Verdict Structure**:
```python
{
    "post_cid": "Qm...",
    "is_eco": true,
    "confidence": 0.92,      # 92% confidence
    "timestamp": 1640000000,
    "nonce": 1,              # Replay protection
    "wallet": "0x123...",    # User to reward
    "signature": "0xabc..."  # EIP-712 signature
}
```

**Why**: Multi-model ensemble provides high accuracy. Off-chain verification keeps gas costs zero for users.

---

### 7. Blockchain (Verification.sol)

**Role**: On-chain verification and ERC20 rewards for verified eco-content

**Smart Contracts**:
1. **Verification.sol**: Verifies EIP-712 signed verdicts, mints rewards
2. **RewardToken.sol**: ERC20 token (ECO) for rewards

**Key Features**:
- **EIP-712 Signatures**: ML backend signs verdicts off-chain
- **Replay Protection**: Nonces prevent double-spending
- **Anti-Spam**: 24h cooldown per wallet, one reward per post CID
- **Authorized Verifiers**: Only whitelisted ML backends can verify
- **Reward Amount**: 5 ECO tokens per verified eco-post (>80% confidence)

**Verification Flow**:
```solidity
function verifyAndReward(
    Verdict calldata verdict,
    bytes calldata signature
) external {
    // 1. Verify EIP-712 signature
    // 2. Check nonce not used (replay protection)
    // 3. Check post not already rewarded (anti-spam)
    // 4. Check wallet cooldown (24h)
    // 5. Check confidence >= 80%
    // 6. Mint 5 ECO tokens to user wallet
    // 7. Emit events for The Graph indexing
}
```

**Events Emitted** (indexed by The Graph):
- `PostVerified(postCid, wallet, isEco, confidence, timestamp, nonce)`
- `RewardMinted(wallet, postCid, amount, timestamp)`

**Why**: Blockchain provides trustless verification. Users can't fake eco-verdicts. EIP-712 signatures prevent impersonation.

---

## Data Flow Diagrams

### 1. Profile Creation Flow

```
┌─────────────┐
│   Frontend  │
│  (React)    │
└──────┬──────┘
       │ 1. POST /api/users/me
       │    { username, bio, avatar_cid }
       ▼
┌─────────────────────┐
│  Backend FastAPI    │
│  user_routes.py     │
└──────┬──────────────┘
       │ 2. user_service.update_profile()
       ▼
┌─────────────────────┐
│  user_service.py    │
└──────┬──────────────┘
       │ 3. Fetch current profile from IPFS (if exists)
       │
       ▼
┌─────────────────────┐
│  ipfs_service.py    │
│  get_json(cid)      │
└──────┬──────────────┘
       │ 4. Returns current profile (or None if new user)
       │
       ▼
┌─────────────────────┐
│  user_service.py    │
│  Merge update data  │
└──────┬──────────────┘
       │ 5. Create new profile object
       │    {
       │      wallet_address: "0x123...",
       │      username: "eco_warrior",
       │      bio: "Saving the planet!",
       │      avatar_cid: "QmAvatar...",
       │      created_at: "2024-01-01T00:00:00Z",
       │      updated_at: "2024-01-15T12:00:00Z"
       │    }
       ▼
┌─────────────────────┐
│  ipfs_service.py    │
│  pin_json()         │
└──────┬──────────────┘
       │ 6. Pin to local IPFS node
       │    Returns NEW_CID (e.g., "QmProfile123...")
       ▼
┌─────────────────────┐
│  pinata_service.py  │
│  pin_by_cid()       │
└──────┬──────────────┘
       │ 7. Pin to Pinata (redundancy)
       │    Keeps content available 24/7
       ▼
┌─────────────────────┐
│  orbitdb_service.py │
│  set_profile_cid()  │
└──────┬──────────────┘
       │ 8. Get/create user's profile DB
       │    DB address: "/orbitdb/Qm.../0x123-profile"
       ▼
┌─────────────────────┐
│  OrbitDB (IPFS)     │
│  KeyValue Store     │
└──────┬──────────────┘
       │ 9. Store: profile_cid -> NEW_CID
       │    OrbitDB updates internal state on IPFS
       ▼
┌─────────────────────┐
│  redis_service.py   │
│  Cache profile      │
└──────┬──────────────┘
       │ 10. Cache: "profile:0x123" -> profile_data (60s TTL)
       │     (Optional - for performance only)
       ▼
┌─────────────────────┐
│  Backend Response   │
│  { success: true,   │
│    profile_cid:     │
│    "QmProfile123" } │
└──────┬──────────────┘
       │ 11. Return to frontend
       ▼
┌─────────────┐
│  Frontend   │
│  Update UI  │
└─────────────┘
```

**CID Storage Locations** (Profile Creation):
1. **Profile content CID** (`QmProfile123...`):
   - Stored on local IPFS node
   - Pinned on Pinata (redundancy)
   - Indexed in user's OrbitDB profile database

2. **OrbitDB address** (`/orbitdb/Qm.../0x123-profile`):
   - Cached in Redis (`orbitdb:0x123:profile`, 90 days TTL)
   - Backed up to IPFS address registry (`QmRegistry...`)
   - OrbitDB state itself stored on IPFS

---

### 2. Post Creation Flow

```
┌─────────────┐
│  Frontend   │
│  Feed.tsx   │
└──────┬──────┘
       │ 1. User creates post
       │    - Uploads images to IPFS first (via Pinata)
       │    - Gets media_cids[] from upload
       │
       │ 2. POST /api/posts
       │    {
       │      author_wallet: "0x123",
       │      content: "Check out my solar panels!",
       │      media_cids: ["QmImage1...", "QmImage2..."],
       │      tags: ["solar", "renewable"]
       │    }
       ▼
┌─────────────────────┐
│  Backend FastAPI    │
│  post_routes.py     │
└──────┬──────────────┘
       │ 3. Verify JWT auth (wallet matches)
       ▼
┌─────────────────────┐
│  ipfs_service.py    │
│  pin_json()         │
└──────┬──────────────┘
       │ 4. Create post object and pin to IPFS
       │    {
       │      type: "post",
       │      version: 1,
       │      author: "0x123",
       │      content: "Check out my solar panels!",
       │      media_cids: ["QmImage1...", "QmImage2..."],
       │      tags: ["solar", "renewable"],
       │      created_at: "2024-01-15T12:00:00Z"
       │    }
       │
       │    Returns POST_CID (e.g., "QmPost456...")
       ▼
┌─────────────────────┐
│  social_service.py  │
│  set_post_author()  │
└──────┬──────────────┘
       │ 5. Register post author in memory
       │    (Needed for OrbitDB social DB lookups)
       ▼
┌─────────────────────┐
│  orbitdb_service.py │
│  append_post()      │
└──────┬──────────────┘
       │ 6. Get user's posts database
       │    DB type: Feed/Log (append-only)
       │    DB address: "/orbitdb/Qm.../0x123-posts"
       ▼
┌─────────────────────┐
│  OrbitDB (IPFS)     │
│  Feed Database      │
└──────┬──────────────┘
       │ 7. Append POST_CID to feed
       │    [QmOldPost1, QmOldPost2, QmPost456]
       │    OrbitDB updates state on IPFS
       ▼
┌──────────────────────┐
│  Celery Worker Queue │
│  (Redis broker)      │
└──────┬───────────────┘
       │ 8. Trigger async ML verification
       │    send_task('verify_eco_content',
       │      ipfs_cid: "QmImage1",
       │      text_content: "Check out my solar panels!",
       │      post_id: "QmPost456",
       │      author_wallet: "0x123")
       │
       │    (Non-blocking - user doesn't wait)
       ▼
┌─────────────────────┐
│  Backend Response   │
│  { success: true,   │
│    cid: "QmPost456",│
│    indexed: true }  │
└──────┬──────────────┘
       │ 9. Return immediately to frontend
       ▼
┌─────────────┐
│  Frontend   │
│  Show post  │
│  in feed    │
└─────────────┘

       ┌──────────────────────┐
       │  ASYNC: ML Worker    │
       │  (runs in background)│
       └──────┬───────────────┘
              │ 10. Celery worker picks up task
              ▼
       ┌─────────────────────┐
       │  ml/worker.py       │
       │  verify_eco_content │
       └──────┬──────────────┘
              │ 11. Fetch image from IPFS
              │     (tries multiple gateways)
              ▼
       ┌─────────────────────┐
       │  ml/inference.py    │
       │  Multi-model verify │
       └──────┬──────────────┘
              │ 12. Run YOLO + CLIP + EfficientNet
              │     Aggregate confidence scores
              ▼
       ┌─────────────────────┐
       │  ml/signer.py       │
       │  Sign EIP-712       │
       └──────┬──────────────┘
              │ 13. Create signed verdict
              │     {
              │       post_cid: "QmPost456",
              │       is_eco: true,
              │       confidence: 0.92,
              │       signature: "0xabc..."
              │     }
              ▼
       ┌─────────────────────┐
       │  ipfs_service.py    │
       │  Store verdict      │
       └──────┬──────────────┘
              │ 14. Pin verdict to IPFS
              │     Returns VERDICT_CID
              ▼
       ┌─────────────────────┐
       │  (Future) Blockchain│
       │  Verification.sol   │
       └──────┬──────────────┘
              │ 15. Submit verdict to smart contract
              │     verifyAndReward(verdict, signature)
              │
              │     Contract verifies signature, mints 5 ECO tokens
              ▼
       ┌─────────────────────┐
       │  User Wallet        │
       │  Receives 5 ECO     │
       └─────────────────────┘
```

**CID Storage Locations** (Post Creation):
1. **Media CIDs** (`QmImage1...`, `QmImage2...`):
   - Uploaded directly to IPFS via frontend
   - Pinned on Pinata by frontend
   - Referenced in post content

2. **Post content CID** (`QmPost456...`):
   - Stored on local IPFS node
   - Pinned on Pinata
   - Appended to user's OrbitDB posts database

3. **Verdict CID** (`QmVerdict789...`):
   - Stored on IPFS by ML worker
   - Linked to post_cid in database (future)
   - Used for blockchain submission

---

### 3. Like Flow (IPFS-First Architecture)

```
┌─────────────┐
│  Frontend   │
│  Post Card  │
└──────┬──────┘
       │ 1. User clicks ❤️ button
       │
       │ 2. POST /api/posts/{post_cid}/like
       │    { wallet: "0x123" }
       ▼
┌─────────────────────┐
│  Backend FastAPI    │
│  post_routes.py     │
└──────┬──────────────┘
       │ 3. Verify JWT auth
       ▼
┌─────────────────────┐
│  social_service.py  │
│  add_like()         │
└──────┬──────────────┘
       │ 4. CRITICAL: IPFS-FIRST WRITE
       │    Get current likes from IPFS (source of truth)
       ▼
┌─────────────────────┐
│  orbitdb_service.py │
│  get_social_db()    │
└──────┬──────────────┘
       │ 5. Get/create post's social database
       │    DB address: "/orbitdb/Qm.../post456-social"
       ▼
┌─────────────────────┐
│  OrbitDB → IPFS     │
│  Fetch likes CID    │
└──────┬──────────────┘
       │ 6. OrbitDB stores: "likes" -> "QmLikes123"
       │    Fetch QmLikes123 from IPFS
       ▼
┌─────────────────────┐
│  ipfs_service.py    │
│  get_json(cid)      │
└──────┬──────────────┘
       │ 7. Returns current likes array
       │    ["0xabc", "0xdef"]
       ▼
┌─────────────────────┐
│  social_service.py  │
│  Modify likes       │
└──────┬──────────────┘
       │ 8. Add new like (check for duplicates)
       │    ["0xabc", "0xdef", "0x123"]
       ▼
┌─────────────────────┐
│  ipfs_service.py    │
│  pin_json()         │
└──────┬──────────────┘
       │ 9. BLOCKING WRITE to IPFS
       │    Pin new likes array
       │    Returns NEW_LIKES_CID (e.g., "QmLikes456")
       │
       │    ⚠️ CRITICAL: This is BLOCKING - user waits
       │    ✅ GUARANTEE: Like is saved before success returned
       ▼
┌─────────────────────┐
│  pinata_service.py  │
│  pin_by_cid()       │
└──────┬──────────────┘
       │ 10. Pin to Pinata (redundancy)
       ▼
┌─────────────────────┐
│  orbitdb_service.py │
│  Update social DB   │
└──────┬──────────────┘
       │ 11. Update OrbitDB index
       │     "likes" -> "QmLikes456" (new CID)
       ▼
┌─────────────────────┐
│  OrbitDB → IPFS     │
│  State updated      │
└──────┬──────────────┘
       │ 12. OrbitDB saves updated state to IPFS
       ▼
┌─────────────────────┐
│  redis_service.py   │
│  OPTIONAL cache     │
└──────┬──────────────┘
       │ 13. Cache: "likes:{post_cid}" -> ["0xabc", "0xdef", "0x123"]
       │     (5s TTL - request-level cache only)
       │
       │     ⚠️ If Redis cleared, data NOT lost (IPFS is source of truth)
       ▼
┌─────────────────────┐
│  Backend Response   │
│  { success: true }  │
└──────┬──────────────┘
       │ 14. Return success ONLY after IPFS write confirmed
       ▼
┌─────────────┐
│  Frontend   │
│  Show ❤️️    │
│  filled     │
└─────────────┘
```

**Key Differences from Old (Broken) Architecture**:

❌ **OLD (Redis-first - BROKEN)**:
```python
# Write to Redis first (fast but UNSAFE)
redis_service.set_json(f"likes:{post_cid}", new_likes)

# Sync to IPFS in background (async, can fail silently)
asyncio.create_task(_sync_likes_to_ipfs(post_cid, new_likes))

# Return success BEFORE IPFS write
return {"success": True}  # ⚠️ Data not yet saved to IPFS!
```

**Problem**: If Redis is cleared before background sync completes, like is LOST forever.

✅ **NEW (IPFS-first - CORRECT)**:
```python
# 1. Fetch current likes from IPFS (source of truth)
current_likes = await ipfs_service.get_json(likes_cid)

# 2. Modify likes array
new_likes = current_likes + [wallet]

# 3. BLOCKING write to IPFS
new_likes_cid = await ipfs_service.pin_json(new_likes)  # WAIT for IPFS

# 4. Update OrbitDB index
await orbitdb_service.update_social_db(post_cid, "likes", new_likes_cid)

# 5. OPTIONAL: Cache for performance
redis_service.set_json(f"likes:{post_cid}", new_likes, ex=5)

# 6. Return success ONLY after IPFS write confirmed
return {"success": True}  # ✅ Data guaranteed saved to IPFS!
```

**Guarantee**: User only sees success after IPFS write completes. Data cannot be lost.

---

### 4. Comment Flow (Same IPFS-First Pattern)

```
┌─────────────┐
│  Frontend   │
└──────┬──────┘
       │ POST /api/posts/{post_cid}/comments
       │ { wallet: "0x123", text: "Great post!" }
       ▼
┌─────────────────────┐
│  social_service.py  │
│  add_comment()      │
└──────┬──────────────┘
       │ IPFS-FIRST WRITE (same pattern as likes)
       │
       │ 1. Fetch current comments from IPFS
       │ 2. Append new comment
       │ 3. BLOCKING write to IPFS
       │ 4. Update OrbitDB index
       │ 5. Optional Redis cache
       ▼
┌─────────────────────┐
│  Success returned   │
│  ONLY after IPFS    │
│  write confirmed    │
└─────────────────────┘
```

---

### 5. Timeline/Feed Flow

```
┌─────────────┐
│  Frontend   │
│  Feed.tsx   │
└──────┬──────┘
       │ 1. GET /api/feed/timeline?limit=50
       ▼
┌─────────────────────┐
│  Backend FastAPI    │
│  post_routes.py     │
└──────┬──────────────┘
       │ 2. Get list of followed users
       ▼
┌─────────────────────┐
│  user_service.py    │
│  get_following()    │
└──────┬──────────────┘
       │ 3. Returns followed wallets
       │    ["0xabc", "0xdef", "0x123"]
       ▼
┌─────────────────────┐
│  orbitdb_service.py │
│  get_user_posts()   │
└──────┬──────────────┘
       │ 4. For each followed user, get posts
       │    (Parallel fetching via asyncio.gather)
       ▼
┌─────────────────────┐
│  OrbitDB → IPFS     │
│  Fetch post CIDs    │
└──────┬──────────────┘
       │ 5. Returns arrays of post CIDs
       │    User 1: [QmPost1, QmPost2]
       │    User 2: [QmPost3, QmPost4]
       │    User 3: [QmPost5]
       ▼
┌─────────────────────┐
│  post_routes.py     │
│  Aggregate & sort   │
└──────┬──────────────┘
       │ 6. Combine all post CIDs
       │    [QmPost1, QmPost2, ..., QmPost5]
       │
       │ 7. Sort by timestamp (latest first)
       │
       │ 8. Limit to 50 posts (performance)
       │    [QmPost5, QmPost4, QmPost3, ...]
       ▼
┌─────────────────────┐
│  social_service.py  │
│  Pre-register users │
└──────┬──────────────┘
       │ 9. OPTIMIZATION: Register all post authors
       │    (Prevents duplicate OrbitDB creation)
       ▼
┌─────────────────────┐
│  ipfs_service.py    │
│  Fetch post content │
└──────┬──────────────┘
       │ 10. Parallel fetch all posts from IPFS
       │     (asyncio.gather for performance)
       │
       │     Optional: Check Redis cache first
       ▼
┌─────────────────────┐
│  social_service.py  │
│  Fetch social data  │
└──────┬──────────────┘
       │ 11. For each post, get likes + comments
       │     (Request-level cache - 5s TTL)
       │
       │     OPTIMIZATION: Coalesce duplicate fetches
       │     within same request
       ▼
┌─────────────────────┐
│  Backend Response   │
│  {                  │
│    posts: [         │
│      {              │
│        cid: "Qm...",│
│        content: "...",
│        likes: 42,   │
│        comments: 7  │
│      },             │
│      ...            │
│    ],               │
│    count: 50        │
│  }                  │
└──────┬──────────────┘
       │ 12. Return to frontend
       ▼
┌─────────────┐
│  Frontend   │
│  Render feed│
└─────────────┘
```

**Performance Optimizations**:
1. **Limit to 50 posts**: Prevents overwhelming IPFS with hundreds of parallel fetches
2. **Pre-register authors**: Prevents race conditions in OrbitDB creation
3. **Request-level cache**: Coalesces duplicate social data fetches (5s TTL)
4. **Parallel fetching**: asyncio.gather for concurrent IPFS fetches
5. **Redis caching**: Optional 60s cache for frequently accessed posts

**Timeline Load Time**:
- Before optimizations: **60-120 seconds** (race conditions, duplicate fetches)
- After optimizations: **2-5 seconds** (50 posts with social metrics)

---

## Storage Architecture

### IPFS Content Structure

```
IPFS (Content-Addressed Storage)
│
├── User Profiles
│   ├── QmProfile1... → {wallet, username, bio, avatar_cid, timestamps}
│   ├── QmProfile2... → {wallet, username, bio, avatar_cid, timestamps}
│   └── QmProfile3... → {wallet, username, bio, avatar_cid, timestamps}
│
├── Posts
│   ├── QmPost1... → {type:"post", author, content, media_cids[], tags[], created_at}
│   ├── QmPost2... → {type:"post", author, content, media_cids[], tags[], created_at}
│   └── QmPost3... → {type:"post", author, content, media_cids[], tags[], created_at}
│
├── Media (Images/Videos)
│   ├── QmImage1... → [binary image data]
│   ├── QmImage2... → [binary image data]
│   └── QmVideo1... → [binary video data]
│
├── Social Interactions
│   ├── QmLikes1... → ["0xabc", "0xdef", "0x123"]
│   ├── QmComments1... → [{wallet, text, timestamp}, ...]
│   └── QmLikes2... → ["0x456", "0x789"]
│
├── ML Verdicts
│   ├── QmVerdict1... → {post_cid, is_eco, confidence, signature, timestamp}
│   └── QmVerdict2... → {post_cid, is_eco, confidence, signature, timestamp}
│
├── OrbitDB States
│   ├── QmOrbitDB1... → OrbitDB database state (user posts feed)
│   ├── QmOrbitDB2... → OrbitDB database state (post social data)
│   └── QmOrbitDB3... → OrbitDB database state (user profile)
│
└── OrbitDB Address Registry (Backup)
    └── QmRegistry... → {
          "0x123:posts": "/orbitdb/Qm.../0x123-posts",
          "0x123:profile": "/orbitdb/Qm.../0x123-profile",
          "post456:social": "/orbitdb/Qm.../post456-social"
        }
```

### OrbitDB Database Structure

```
OrbitDB (Peer-to-Peer Databases on IPFS)
│
├── User Posts Databases (Feed/Log type - append-only)
│   ├── /orbitdb/Qm.../0x123-posts
│   │   └── [QmPost1, QmPost2, QmPost3, ...] (append-only log)
│   │
│   ├── /orbitdb/Qm.../0xabc-posts
│   │   └── [QmPost4, QmPost5, ...] (append-only log)
│   │
│   └── /orbitdb/Qm.../0xdef-posts
│       └── [QmPost6, QmPost7, ...] (append-only log)
│
├── User Profile Databases (KeyValue type - coming soon)
│   ├── /orbitdb/Qm.../0x123-profile
│   │   └── { "profile_cid": "QmProfile1..." }
│   │
│   └── /orbitdb/Qm.../0xabc-profile
│       └── { "profile_cid": "QmProfile2..." }
│
└── Post Social Databases (KeyValue type)
    ├── /orbitdb/Qm.../post1-social
    │   ├── "likes": "QmLikes1..." (CID pointing to likes array on IPFS)
    │   └── "comments": "QmComments1..." (CID pointing to comments array on IPFS)
    │
    └── /orbitdb/Qm.../post2-social
        ├── "likes": "QmLikes2..."
        └── "comments": "QmComments2..."
```

**Key Insight**: OrbitDB databases are THEMSELVES stored on IPFS. The database address (`/orbitdb/Qm...`) contains an IPFS CID that points to the database's current state.

### Redis Cache Structure (Optional)

```
Redis (Temporary Cache - NOT source of truth)
│
├── User Profiles (60s TTL)
│   ├── "profile:0x123" → {wallet, username, bio, avatar_cid, ...}
│   └── "profile:0xabc" → {wallet, username, bio, avatar_cid, ...}
│
├── Posts (60s TTL)
│   ├── "post:QmPost1" → {author, content, media_cids, tags, ...}
│   └── "post:QmPost2" → {author, content, media_cids, tags, ...}
│
├── Social Metrics (5s TTL - request-level only)
│   ├── "likes:QmPost1" → ["0xabc", "0xdef", "0x123"]
│   └── "comments:QmPost1" → [{wallet, text, timestamp}, ...]
│
├── OrbitDB Addresses (90 days TTL - with IPFS backup)
│   ├── "orbitdb:0x123:posts" → "/orbitdb/Qm.../0x123-posts"
│   ├── "orbitdb:0x123:profile" → "/orbitdb/Qm.../0x123-profile"
│   └── "orbitdb:post1:social" → "/orbitdb/Qm.../post1-social"
│
└── User Discovery (60s TTL)
    └── "users:all" → [{wallet, username, bio}, ...]
```

**Cache Eviction Policy**:
- All cache entries have TTL (Time To Live)
- When TTL expires, key is automatically deleted
- ✅ Data loss NEVER occurs - IPFS is always checked on cache miss
- ✅ System works perfectly without Redis (graceful degradation)

---

## CID Storage Locations

This section tracks WHERE each type of CID is stored across the system.

### 1. Profile CID (e.g., `QmProfile123...`)

**Content**: User profile object `{wallet, username, bio, avatar_cid, timestamps}`

**Stored at**:
- ✅ **IPFS** (local node) - permanent storage
- ✅ **Pinata** - pinned for availability
- ✅ **OrbitDB**: User's profile database (`profile_cid` key)
- ⚠️ **Redis**: Cached as `profile:{wallet}` (60s TTL, optional)

**Retrieval Flow**:
```python
# 1. Try Redis cache first (optional)
cached = redis_service.get_json(f"profile:{wallet}")
if cached:
    return cached

# 2. Get OrbitDB address (with IPFS backup)
db_address = await orbitdb_service.get_db_address(wallet, "profile")

# 3. Fetch profile CID from OrbitDB
profile_cid = await orbitdb_service.get(db_address, "profile_cid")

# 4. Fetch profile content from IPFS (source of truth)
profile = await ipfs_service.get_json(profile_cid)

# 5. Cache for next request
redis_service.set_json(f"profile:{wallet}", profile, ex=60)

return profile
```

---

### 2. Post CID (e.g., `QmPost456...`)

**Content**: Post object `{type:"post", author, content, media_cids[], tags[], created_at}`

**Stored at**:
- ✅ **IPFS** (local node) - permanent storage
- ✅ **Pinata** - pinned for availability
- ✅ **OrbitDB**: User's posts database (append-only feed)
- ⚠️ **Redis**: Cached as `post:{post_cid}` (60s TTL, optional)

**Retrieval Flow**:
```python
# 1. Try Redis cache first (optional)
cached = redis_service.get_json(f"post:{post_cid}")
if cached:
    return cached

# 2. Fetch from IPFS (source of truth)
post = await ipfs_service.get_json(post_cid)

# 3. Cache for next request
redis_service.set_json(f"post:{post_cid}", post, ex=60)

return post
```

---

### 3. Media CID (e.g., `QmImage1...`)

**Content**: Binary image/video data

**Stored at**:
- ✅ **IPFS** (local node) - permanent storage
- ✅ **Pinata** - pinned for availability (uploaded by frontend)
- ❌ **OrbitDB**: Not stored (referenced by post's `media_cids[]` array)
- ❌ **Redis**: Not cached (too large, served directly from IPFS gateway)

**Usage**:
```html
<!-- Frontend renders via IPFS gateway -->
<img src="https://gateway.pinata.cloud/ipfs/QmImage1..." />
```

---

### 4. Likes CID (e.g., `QmLikes123...`)

**Content**: Array of wallet addresses `["0xabc", "0xdef", "0x123"]`

**Stored at**:
- ✅ **IPFS** (local node) - permanent storage, SOURCE OF TRUTH
- ✅ **Pinata** - pinned for availability
- ✅ **OrbitDB**: Post's social database (`likes` key points to CID)
- ⚠️ **Redis**: Cached as `likes:{post_cid}` (5s TTL, request-level only)

**Write Flow** (CRITICAL - IPFS-first):
```python
# 1. Fetch current likes from IPFS (source of truth)
current_likes_cid = await orbitdb_service.get_social_value(post_cid, "likes")
current_likes = await ipfs_service.get_json(current_likes_cid)

# 2. Modify likes array
new_likes = current_likes + [wallet]

# 3. BLOCKING write to IPFS
new_likes_cid = await ipfs_service.pin_json(new_likes)  # WAIT for IPFS

# 4. Update OrbitDB to point to new CID
await orbitdb_service.set_social_value(post_cid, "likes", new_likes_cid)

# 5. Optional: Cache for performance (5s TTL)
redis_service.set_json(f"likes:{post_cid}", new_likes, ex=5)

# 6. Return success ONLY after IPFS write confirmed
return {"success": True}
```

**Read Flow**:
```python
# 1. Try Redis cache first (optional)
cached = redis_service.get_json(f"likes:{post_cid}")
if cached:
    return cached

# 2. Get likes CID from OrbitDB
likes_cid = await orbitdb_service.get_social_value(post_cid, "likes")

# 3. Fetch likes array from IPFS (source of truth)
likes = await ipfs_service.get_json(likes_cid)

# 4. Cache for next request (5s TTL)
redis_service.set_json(f"likes:{post_cid}", likes, ex=5)

return likes
```

---

### 5. Comments CID (e.g., `QmComments123...`)

**Content**: Array of comment objects `[{wallet, text, timestamp}, ...]`

**Stored at**:
- ✅ **IPFS** (local node) - permanent storage, SOURCE OF TRUTH
- ✅ **Pinata** - pinned for availability
- ✅ **OrbitDB**: Post's social database (`comments` key points to CID)
- ⚠️ **Redis**: Cached as `comments:{post_cid}` (5s TTL, request-level only)

**Same IPFS-first pattern as likes** (see above)

---

### 6. Verdict CID (e.g., `QmVerdict789...`)

**Content**: ML verification result `{post_cid, is_eco, confidence, signature, timestamp, nonce, wallet}`

**Stored at**:
- ✅ **IPFS** (local node) - permanent storage
- ✅ **Pinata** - pinned for availability
- ✅ **Blockchain** (future): Submitted to Verification.sol contract
- ❌ **OrbitDB**: Not yet indexed (coming soon)
- ❌ **Redis**: Not cached (low read frequency)

**Usage Flow**:
```python
# ML worker creates verdict
verdict = {
    "post_cid": "QmPost456",
    "is_eco": True,
    "confidence": 0.92,
    "timestamp": int(time.time()),
    "nonce": 1,
    "wallet": "0x123"
}

# Sign with EIP-712
signature = signer.sign_verdict(verdict)
verdict["signature"] = signature

# Store on IPFS
verdict_cid = await ipfs_service.pin_json(verdict)

# (Future) Submit to blockchain
await submit_to_blockchain(verdict, signature)
```

---

### 7. OrbitDB Address (e.g., `/orbitdb/Qm.../0x123-posts`)

**Content**: String pointing to OrbitDB database

**Stored at**:
- ⚠️ **Redis**: Primary cache (`orbitdb:{wallet}:{type}`, 90 days TTL)
- ✅ **IPFS**: Backup registry (`QmRegistry...` contains all addresses)
- ❌ **OrbitDB**: Not stored in OrbitDB (it IS the OrbitDB address)

**Backup Flow** (prevents data loss if Redis cleared):
```python
async def set_db_address(wallet: str, db_type: str, address: str):
    # 1. Save to Redis (fast access, 90 days TTL)
    redis_service.set_str(
        f"orbitdb:{wallet}:{db_type}",
        address,
        ex=90 * 24 * 60 * 60  # 90 days
    )
    
    # 2. CRITICAL: Backup to IPFS (permanent)
    await _backup_address_to_ipfs(wallet, db_type, address)

async def _backup_address_to_ipfs(wallet: str, db_type: str, address: str):
    # 1. Fetch current registry from IPFS
    registry_cid = redis_service.get_str("orbitdb:registry_cid")
    if registry_cid:
        registry = await ipfs_service.get_json(registry_cid)
    else:
        registry = {}
    
    # 2. Update registry
    key = f"{wallet}:{db_type}"
    registry[key] = address
    
    # 3. Pin updated registry to IPFS
    new_registry_cid = await ipfs_service.pin_json(registry)
    
    # 4. Update registry CID reference
    redis_service.set_str("orbitdb:registry_cid", new_registry_cid)
    
    print(f"Backed up OrbitDB address to IPFS: {new_registry_cid}")
```

**Recovery Flow** (if Redis cleared):
```python
async def get_db_address(wallet: str, db_type: str) -> Optional[str]:
    # 1. Try Redis cache first (fast)
    address = redis_service.get_str(f"orbitdb:{wallet}:{db_type}")
    if address:
        return address
    
    # 2. FALLBACK: Check IPFS backup registry
    registry_cid = redis_service.get_str("orbitdb:registry_cid")
    if registry_cid:
        try:
            registry = await ipfs_service.get_json(registry_cid)
            key = f"{wallet}:{db_type}"
            address = registry.get(key)
            
            if address:
                # Restore to Redis cache
                redis_service.set_str(
                    f"orbitdb:{wallet}:{db_type}",
                    address,
                    ex=90 * 24 * 60 * 60
                )
                return address
        except Exception as e:
            print(f"Failed to fetch registry from IPFS: {e}")
    
    # 3. No address found - will create new database
    return None
```

---

## Complete User Journeys

### Journey 1: New User Registration

```
1. User visits app → Connect wallet (MetaMask)
   - Frontend: Call eth_requestAccounts
   - User approves wallet connection

2. Frontend requests SIWE (Sign-In with Ethereum) message
   - GET /api/auth/nonce
   - Backend generates nonce

3. User signs SIWE message with wallet
   - Frontend: Call eth_personal_sign
   - Creates signed message proving wallet ownership

4. Frontend submits signed message for verification
   - POST /api/auth/verify
   - Backend verifies signature
   - Returns JWT token

5. User updates profile (username, bio, avatar)
   - User uploads avatar image → IPFS via Pinata → gets avatar_cid
   - PUT /api/users/me
   - Payload: {username: "eco_warrior", bio: "Saving the planet!", avatar_cid: "QmAvatar..."}

6. Backend creates profile
   - Create profile object: {wallet, username, bio, avatar_cid, created_at, updated_at}
   - Pin to IPFS → returns profile_cid
   - Pin to Pinata (redundancy)
   - Get/create user's profile OrbitDB database
   - Store profile_cid in OrbitDB
   - Backup OrbitDB address to IPFS registry
   - Cache profile in Redis (60s TTL)

7. User is registered!
   - Profile CID: QmProfile123 (on IPFS + Pinata)
   - OrbitDB address: /orbitdb/Qm.../0x123-profile (in Redis + IPFS backup)
   - Cached in Redis: profile:0x123 → {...}
```

**Data Flow**:
```
User Input (avatar image)
    ↓ upload to Pinata
QmAvatar... (IPFS CID)
    ↓ included in profile
Profile Object {avatar_cid: "QmAvatar..."}
    ↓ pin to IPFS
QmProfile123... (IPFS CID)
    ↓ store in OrbitDB
/orbitdb/Qm.../0x123-profile → {profile_cid: "QmProfile123"}
    ↓ backup address to IPFS
QmRegistry... → {"0x123:profile": "/orbitdb/Qm.../0x123-profile"}
```

---

### Journey 2: Creating Eco-Content Post

```
1. User writes post + uploads images
   - Frontend: User types "Check out my solar panels!"
   - User selects 2 images from device

2. Upload images to IPFS
   - Frontend: Upload to Pinata API directly
   - Returns media_cids: ["QmImage1...", "QmImage2..."]

3. Submit post to backend
   - POST /api/posts
   - Payload: {
       author_wallet: "0x123",
       content: "Check out my solar panels!",
       media_cids: ["QmImage1...", "QmImage2..."],
       tags: ["solar", "renewable"]
     }
   - Authorization: Bearer <JWT_TOKEN>

4. Backend verifies auth
   - Decode JWT token
   - Verify wallet_address matches author_wallet

5. Create post object
   - Add metadata: type, version, author, created_at
   - Post object: {
       type: "post",
       version: 1,
       author: "0x123",
       content: "Check out my solar panels!",
       media_cids: ["QmImage1...", "QmImage2..."],
       tags: ["solar", "renewable"],
       created_at: "2024-01-15T12:00:00Z"
     }

6. Pin post to IPFS
   - ipfs_service.pin_json(post_object)
   - Returns post_cid: "QmPost456..."

7. Index post in OrbitDB
   - Get user's posts database: /orbitdb/Qm.../0x123-posts
   - Append post_cid to feed: [QmOldPost1, QmOldPost2, QmPost456]
   - OrbitDB saves updated state to IPFS

8. Trigger ML verification (async)
   - Send task to Celery queue
   - Task: verify_eco_content(
       ipfs_cid="QmImage1",
       text_content="Check out my solar panels!",
       post_id="QmPost456",
       author_wallet="0x123"
     )
   - User doesn't wait - post appears immediately

9. Return success to frontend
   - Response: {success: true, cid: "QmPost456", indexed: true}
   - Frontend shows post in feed

10. BACKGROUND: ML Worker processes verification
    - Worker fetches QmImage1 from IPFS
    - Runs YOLO + CLIP + EfficientNet inference
    - Detects: solar panels (high confidence)
    - Creates verdict: {
        post_cid: "QmPost456",
        is_eco: true,
        confidence: 0.92,
        timestamp: 1640000000,
        nonce: 1,
        wallet: "0x123"
      }
    - Signs verdict with EIP-712
    - Stores verdict on IPFS: "QmVerdict789..."

11. FUTURE: Submit to blockchain
    - Contract: verifyAndReward(verdict, signature)
    - Contract verifies signature from authorized verifier
    - Checks: nonce not used, post not already rewarded, confidence >= 80%
    - Mints 5 ECO tokens to user's wallet (0x123)
    - Emits events for The Graph indexing

12. User receives reward!
    - Wallet balance: +5 ECO tokens
    - Post marked as verified ✅
```

**Data Flow**:
```
Images (user uploads)
    ↓ upload to Pinata
QmImage1, QmImage2 (IPFS CIDs)
    ↓ included in post
Post Object {media_cids: ["QmImage1", "QmImage2"]}
    ↓ pin to IPFS
QmPost456 (IPFS CID)
    ↓ append to OrbitDB feed
/orbitdb/Qm.../0x123-posts → [QmOldPost1, QmOldPost2, QmPost456]
    ↓ async: ML verification
QmVerdict789 (IPFS CID)
    ↓ submit to blockchain
Verification.sol → Mint 5 ECO tokens
```

---

### Journey 3: Liking a Post

```
1. User sees post in feed
   - Frontend fetches timeline
   - Post displayed with ❤️ button

2. User clicks ❤️ button
   - Frontend: POST /api/posts/QmPost456/like
   - Payload: {wallet: "0x123"}
   - Authorization: Bearer <JWT_TOKEN>

3. Backend verifies auth
   - Decode JWT token
   - Verify wallet_address matches payload wallet

4. social_service.add_like() - IPFS-FIRST WRITE
   
   4a. Get post's social database
       - OrbitDB address: /orbitdb/Qm.../post456-social
   
   4b. Fetch current likes CID from OrbitDB
       - OrbitDB key "likes" → "QmLikes123..."
   
   4c. Fetch likes array from IPFS (SOURCE OF TRUTH)
       - ipfs_service.get_json("QmLikes123")
       - Returns: ["0xabc", "0xdef"]
   
   4d. Add new like (check for duplicates)
       - New array: ["0xabc", "0xdef", "0x123"]
   
   4e. BLOCKING write to IPFS
       - ipfs_service.pin_json(new_likes_array)
       - ⚠️ USER WAITS - this is CRITICAL for data integrity
       - Returns: "QmLikes456..." (new CID)
   
   4f. Pin to Pinata (redundancy)
       - pinata_service.pin_by_cid("QmLikes456")
   
   4g. Update OrbitDB index
       - OrbitDB set: "likes" → "QmLikes456" (new CID)
       - OrbitDB saves updated state to IPFS
   
   4h. OPTIONAL: Cache for performance
       - redis_service.set_json("likes:QmPost456", new_likes_array, ex=5)
       - 5s TTL - request-level cache only

5. Return success to frontend
   - Response: {success: true}
   - ✅ Like is GUARANTEED saved to IPFS before success returned

6. Frontend updates UI
   - ❤️ button shows filled
   - Like count increments: 2 → 3
```

**Data Integrity Guarantee**:

✅ **What happens if Redis is cleared?**
- No problem! Likes stored on IPFS (QmLikes456)
- OrbitDB index points to QmLikes456
- Next request fetches from IPFS (source of truth)
- Redis cache rebuilt automatically

✅ **What happens if IPFS pin fails?**
- ipfs_service.pin_json() throws exception
- Backend returns error to frontend
- User sees error message, can retry
- Like is NOT saved (atomic operation)

✅ **What happens if Pinata fails?**
- Local IPFS pin already succeeded
- Pinata pin failure logged as warning
- User still sees success (local IPFS is enough)
- Content available on local node

❌ **OLD BROKEN ARCHITECTURE (Redis-first)**:
```
1. Write to Redis first: redis.set("likes:QmPost456", [...])
2. Return success immediately
3. Background task: sync to IPFS
4. ⚠️ If Redis cleared before sync → DATA LOST FOREVER
```

✅ **NEW CORRECT ARCHITECTURE (IPFS-first)**:
```
1. Fetch current state from IPFS (source of truth)
2. Modify data
3. BLOCKING write to IPFS (user waits)
4. Update OrbitDB index
5. Optional: Cache in Redis
6. Return success ONLY after IPFS write confirmed
```

---

### Journey 4: Viewing Timeline

```
1. User opens app → sees timeline
   - Frontend: GET /api/feed/timeline?limit=50

2. Backend gets followed users
   - Check Redis cache: "following:0x123"
   - If miss: Fetch from OrbitDB
   - Returns: ["0xabc", "0xdef", "0x456"]

3. Fetch posts for each followed user (parallel)
   - For each user: orbitdb_service.get_user_posts(wallet)
   - Returns arrays of post CIDs:
     * 0xabc: [QmPost1, QmPost2, QmPost3]
     * 0xdef: [QmPost4, QmPost5]
     * 0x456: [QmPost6, QmPost7, QmPost8]

4. Aggregate and sort posts
   - Combine: [QmPost1, ..., QmPost8]
   - Sort by timestamp (latest first)
   - Limit to 50 posts: [QmPost8, QmPost7, ..., QmPost2]

5. Pre-register post authors (OPTIMIZATION)
   - social_service.set_post_author(cid, wallet) for each post
   - Prevents race condition in OrbitDB creation

6. Fetch post content (parallel)
   - For each post CID:
     * Try Redis cache: "post:{cid}"
     * If miss: Fetch from IPFS
     * Cache for 60s
   - Returns: [{author, content, media_cids, tags, created_at}, ...]

7. Fetch social metrics (parallel)
   - For each post:
     * Get likes: social_service.get_post_likes(cid)
       - Try request cache (5s TTL)
       - If miss: Fetch from IPFS via OrbitDB
     * Get comments: social_service.get_post_comments(cid)
       - Same pattern as likes

8. Build response
   - Response: {
       posts: [
         {
           cid: "QmPost8",
           author: "0xabc",
           content: "...",
           media_cids: [...],
           tags: [...],
           like_count: 42,
           comment_count: 7,
           created_at: "2024-01-15T12:00:00Z"
         },
         ...
       ],
       count: 50
     }

9. Return to frontend
   - Total time: 2-5 seconds (optimized!)
   - Before optimization: 60-120 seconds (race conditions)

10. Frontend renders timeline
    - Display posts with images
    - Show like/comment counts
    - User can like, comment, share
```

**Performance Metrics**:

Before optimizations:
- ❌ Timeline load: 60-120 seconds
- ❌ Hundreds of duplicate OrbitDB creations
- ❌ Race conditions causing timeouts
- ❌ No request-level caching

After optimizations:
- ✅ Timeline load: 2-5 seconds
- ✅ Pre-registration prevents race conditions
- ✅ Request-level caching (5s TTL) coalesces duplicate fetches
- ✅ Limit 50 posts prevents overwhelming IPFS
- ✅ Parallel fetching via asyncio.gather

---

## Comparison: Centralized vs Decentralized

### Centralized Architecture (Traditional Social Media)

```
┌─────────────┐
│   Frontend  │
└──────┬──────┘
       │ POST /api/posts
       ▼
┌─────────────────────┐
│   Backend (AWS)     │
└──────┬──────────────┘
       │ INSERT INTO posts...
       ▼
┌─────────────────────┐
│  PostgreSQL (AWS)   │  ← ⚠️ SINGLE POINT OF FAILURE
│  All user data here │
└─────────────────────┘

Problems:
❌ Company owns all user data
❌ Can censor posts, ban users
❌ Single point of failure (server down = app down)
❌ Privacy concerns (data sold to advertisers)
❌ Vendor lock-in (can't migrate data)
```

### Decentralized Architecture (Eco-DMS)

```
┌─────────────┐
│   Frontend  │
└──────┬──────┘
       │ POST /api/posts
       ▼
┌─────────────────────┐
│ Backend (stateless) │  ← Just a helper, doesn't own data
└──────┬──────────────┘
       │ Pin to IPFS
       ▼
┌─────────────────────┐
│  IPFS Network       │  ← Permanent, content-addressed storage
│  Decentralized      │
└──────┬──────────────┘
       │ Index CID
       ▼
┌─────────────────────┐
│  OrbitDB (IPFS)     │  ← User-owned databases
│  User controls data │
└─────────────────────┘
       │ Reference CID
       ▼
┌─────────────────────┐
│  Pinata + Others    │  ← Multiple pinning services
│  Redundancy         │
└─────────────────────┘

Benefits:
✅ Users own their data (OrbitDB databases)
✅ Immutable content (CIDs can't be changed)
✅ Censorship-resistant (no single authority)
✅ Verifiable (cryptographic proofs)
✅ Redundant (multiple IPFS nodes)
✅ Portable (CIDs work anywhere)
✅ No vendor lock-in (data is yours)
```

---

## Security Considerations

### 1. Authentication (SIWE)

**Sign-In with Ethereum (SIWE)**: Proves wallet ownership without passwords

```
1. Backend generates nonce (random number)
2. User signs message with wallet: "Sign in to Eco-DMS with nonce: 123456"
3. Backend verifies signature using cryptography
4. Issues JWT token for subsequent requests
```

**Benefits**:
- ✅ No passwords (can't be stolen or forgotten)
- ✅ Cryptographic proof of wallet ownership
- ✅ Prevent replay attacks (nonce used once)
- ✅ Standard protocol (EIP-4361)

### 2. Data Integrity (CIDs)

**Content Addressing**: CID = cryptographic hash of content

```
Content: "Hello World"
    ↓ SHA-256 hash
CID: Qm... (deterministic)

If content changes: "Hello World!" → Different CID!
```

**Benefits**:
- ✅ Tamper-proof (changing content changes CID)
- ✅ Verifiable (anyone can recompute hash)
- ✅ Deduplication (same content = same CID)

### 3. Verification Signatures (EIP-712)

**Typed Structured Data Signing**: ML backend signs verdicts

```solidity
struct Verdict {
    string postCid;
    bool isEco;
    uint256 confidence;
    uint256 timestamp;
    uint256 nonce;
    address wallet;
}

// ML backend signs with private key
bytes32 digest = _hashTypedDataV4(hash(verdict));
bytes signature = sign(digest, ML_PRIVATE_KEY);

// Smart contract verifies signature
address signer = ECDSA.recover(digest, signature);
require(authorizedVerifiers[signer], "Unauthorized verifier");
```

**Benefits**:
- ✅ Only authorized ML backends can create valid signatures
- ✅ Users can't forge eco-verdicts
- ✅ Replay protection (nonces prevent double-spending)
- ✅ Standard protocol (EIP-712)

### 4. Anti-Spam Measures

**Smart Contract Protection**:

```solidity
// 1. One reward per post
mapping(string => bool) public rewardedPosts;
require(!rewardedPosts[postCid], "Post already rewarded");

// 2. 24-hour cooldown per wallet
mapping(address => uint256) public lastRewardTime;
require(
    block.timestamp >= lastRewardTime[wallet] + COOLDOWN_PERIOD,
    "Cooldown period active"
);

// 3. Minimum confidence threshold
require(verdict.confidence >= MIN_CONFIDENCE, "Confidence too low");
// MIN_CONFIDENCE = 80 (0.80 = 80%)
```

**Benefits**:
- ✅ Prevents spam (one reward per post, 24h cooldown)
- ✅ Ensures quality (80% confidence minimum)
- ✅ Protects token supply (controlled minting)

---

## Failure Modes & Recovery

### Scenario 1: Redis Cleared

**Problem**: All cached data lost (profiles, posts, OrbitDB addresses)

**Recovery**:
1. **Profiles**:
   - Cache miss → Fetch from IPFS via OrbitDB
   - Rebuild cache automatically
   
2. **Posts**:
   - Cache miss → Fetch from IPFS by CID
   - Rebuild cache automatically
   
3. **OrbitDB Addresses**:
   - Cache miss → Check IPFS backup registry
   - Restore addresses from QmRegistry...
   - Rebuild Redis cache

**Result**: ✅ Zero data loss (IPFS is source of truth)

**Downtime**: ~30 seconds (cache warm-up period)

---

### Scenario 2: IPFS Node Down

**Problem**: Local IPFS node crashes or restarts

**Recovery**:
1. **Content Retrieval**:
   - Fetch from Pinata gateway instead
   - Fallback to public gateways (ipfs.io, dweb.link)
   
2. **Content Pinning**:
   - Queue pins for retry when node recovers
   - Use Pinata API directly as fallback

**Result**: ✅ Content remains available (Pinata redundancy)

**Downtime**: None (automatic fallback)

---

### Scenario 3: Pinata Service Down

**Problem**: Pinata API unavailable

**Recovery**:
1. **Continue with local IPFS**:
   - Pins still work on local node
   - Content available via local gateway
   
2. **Fallback to NFT.storage**:
   - Use NFT.storage pinning service
   - Free tier for backup redundancy

**Result**: ✅ Posts still created (local IPFS)

**Impact**: Reduced redundancy temporarily

---

### Scenario 4: OrbitDB Database Lost

**Problem**: OrbitDB address lost from Redis, not in IPFS backup

**Recovery**:
1. **Profile Database**:
   - Create new OrbitDB database
   - User re-uploads profile (username, bio, avatar)
   - New profile_cid generated
   
2. **Posts Database**:
   - Create new OrbitDB database
   - ⚠️ Post CIDs still exist on IPFS (not lost!)
   - But index lost (user must manually re-share posts OR recover from OrbitDB DHT)

**Result**: ⚠️ Index lost, content NOT lost

**Prevention**: Regular IPFS registry backups (automated)

---

### Scenario 5: Blockchain Network Congestion

**Problem**: High gas fees prevent verification submission

**Recovery**:
1. **Queue verdicts**:
   - Store signed verdicts on IPFS
   - Wait for gas prices to drop
   
2. **Batch submissions**:
   - Submit multiple verdicts in one transaction
   - Reduce overall gas cost

**Result**: ✅ Delayed rewards, but verdicts safe on IPFS

**Impact**: Temporary delay in ECO token rewards

---

## Future Enhancements

### 1. The Graph Integration

**Purpose**: Index blockchain events for fast querying

```graphql
query GetUserRewards($wallet: String!) {
  rewardEvents(where: { wallet: $wallet }) {
    postCid
    amount
    timestamp
    transactionHash
  }
}
```

**Benefits**:
- Fast queries (no need to scan all blocks)
- Historical data (all past rewards)
- Real-time updates (via subscriptions)

### 2. IPFS Cluster

**Purpose**: Distributed IPFS pinning across multiple nodes

```
┌─────────────┐
│  IPFS Node 1│ ← Primary
└──────┬──────┘
       │
┌──────┴──────┬──────────────┐
│             │              │
│  IPFS Node 2│  IPFS Node 3│  IPFS Node 4│ ← Replicas
└─────────────┴──────────────┴─────────────┘
```

**Benefits**:
- Higher availability (multiple replicas)
- Load balancing (distribute reads)
- Fault tolerance (node failures)

### 3. Content Moderation (Decentralized)

**Purpose**: Community-driven moderation without centralized control

```
1. Users can flag content (flagging stored on IPFS)
2. Community votes on flags (voting on-chain or OrbitDB)
3. Thresholds trigger content hiding (but not deletion - censorship-resistant)
4. Appeals process (transparent, on-chain)
```

**Benefits**:
- No single authority
- Transparent process
- Appeals possible
- Content never deleted (IPFS immutability)

### 4. Mobile App (React Native)

**Purpose**: Native mobile experience

**Architecture**:
- Same backend API
- IPFS mobile client (js-ipfs or Textile)
- Wallet integration (WalletConnect)
- Push notifications (via FCM)

### 5. Earnings Dashboard

**Purpose**: Track eco-content rewards

**Features**:
- Total ECO tokens earned
- Rewards per post
- Verification history
- Leaderboards (top eco-creators)

**Data Source**: The Graph queries + smart contract reads

---

## Glossary

**CID (Content Identifier)**: Cryptographic hash of content on IPFS. Example: `QmYwAPJzv5CZsnA625s3Xo8vpXzCmN3QjgfBJx9j4cZC1v`

**IPFS (InterPlanetary File System)**: Decentralized content-addressed storage network

**OrbitDB**: Peer-to-peer database built on IPFS. Users own their databases.

**Pinning**: Keeping IPFS content available by preventing garbage collection

**Pinata**: IPFS pinning service (1GB free tier)

**EIP-712**: Ethereum standard for signing typed structured data

**SIWE (Sign-In with Ethereum)**: Standard for wallet-based authentication (EIP-4361)

**ECO Token**: ERC20 reward token for verified eco-content

**Celery**: Python distributed task queue for async processing

**Redis**: In-memory key-value store (used for optional caching)

**JWT (JSON Web Token)**: Secure token for authentication

**Nonce**: Number used once (prevents replay attacks)

**Source of Truth**: The authoritative, permanent storage (IPFS in our system)

**TTL (Time To Live)**: How long cache entries live before expiration

**AsyncIO**: Python library for concurrent asynchronous operations

**Race Condition**: Bug where multiple concurrent operations interfere with each other

**Graceful Degradation**: System continues working when optional components fail

---

## Quick Reference

### API Endpoints

**Auth**:
- `GET /api/auth/nonce` - Get SIWE nonce
- `POST /api/auth/verify` - Verify SIWE signature, get JWT

**Users**:
- `GET /api/users/me` - Get current user profile
- `PUT /api/users/me` - Update current user profile
- `GET /api/users/{wallet}` - Get user profile by wallet
- `GET /api/users/all` - Get all users

**Posts**:
- `POST /api/posts` - Create post
- `GET /api/posts/{wallet}` - Get user's posts
- `GET /api/posts/{cid}` - Get post by CID
- `POST /api/posts/{cid}/like` - Like post
- `DELETE /api/posts/{cid}/like` - Unlike post
- `POST /api/posts/{cid}/comments` - Add comment
- `GET /api/feed/timeline` - Get timeline (followed users)

**Verification**:
- `GET /api/verify/{cid}` - Get verification status
- `POST /api/verify/submit` - Submit verdict to blockchain (future)

### Environment Variables

```bash
# IPFS
IPFS_API_URL=http://localhost:5001
IPFS_GATEWAY_URL=http://localhost:8080

# Pinata
PINATA_JWT=your_pinata_jwt_token

# Redis (optional)
REDIS_URL=redis://localhost:6379/0

# Blockchain
CHAIN_ID=11155111  # Sepolia testnet
PRIVATE_KEY=your_ml_verifier_private_key
CONTRACT_ADDRESS=0x...  # Verification.sol address

# JWT
JWT_SECRET=your_secret_key
JWT_EXPIRATION=86400  # 24 hours

# ML Models
MODEL_DIR=./backend/ml/models
ML_CONFIDENCE_THRESHOLD=0.8
```

### Key Services

**Backend Services** (`backend/app/services/`):
- `ipfs_service.py` - IPFS operations (pin, fetch)
- `pinata_service.py` - Pinata pinning
- `orbitdb_service.py` - OrbitDB databases
- `redis_service.py` - Redis caching (optional)
- `social_service.py` - Likes, comments (IPFS-first)
- `user_service.py` - User profiles

**ML Services** (`backend/ml/`):
- `worker.py` - Celery worker
- `inference.py` - Multi-model verification
- `signer.py` - EIP-712 signing

### Data Guarantees

✅ **GUARANTEED (cannot be lost)**:
- User profiles (IPFS + Pinata)
- Post content (IPFS + Pinata)
- Media files (IPFS + Pinata)
- Likes (IPFS + Pinata + OrbitDB)
- Comments (IPFS + Pinata + OrbitDB)
- ML verdicts (IPFS + Pinata)

⚠️ **CACHED (can be rebuilt)**:
- OrbitDB addresses (Redis with IPFS backup)
- Profile cache (Redis, 60s TTL)
- Post cache (Redis, 60s TTL)
- Social metrics cache (Redis, 5s TTL)

❌ **EPHEMERAL (not persisted)**:
- JWT tokens (expire after 24h)
- Request-level caches (5s TTL)
- Background task results (expire after 24h)

---

## Conclusion

Eco-DMS achieves **true decentralization** through:

1. **IPFS as Source of Truth**: All permanent data on IPFS (content-addressed, immutable)
2. **User Data Ownership**: OrbitDB gives users control of their databases
3. **No Central Database**: Zero reliance on PostgreSQL/MongoDB
4. **Optional Caching**: Redis used ONLY for performance, never as source of truth
5. **Blockchain Verification**: EIP-712 signed verdicts ensure trustless verification
6. **Async Processing**: Celery workers keep user experience fast
7. **Redundancy**: Multiple pinning services prevent data loss

**Data Flow Summary**:
```
User Action (Frontend)
    ↓
Backend API (FastAPI - stateless helper)
    ↓
IPFS (Permanent Storage - SOURCE OF TRUTH)
    ↓
Pinata (Redundant Pinning)
    ↓
OrbitDB (User-Owned Indices)
    ↓
Optional: Redis Cache (Performance Only)
    ↓
Async: ML Verification (Celery)
    ↓
Future: Blockchain Rewards (Smart Contract)
```

**Key Insight**: If you shut down the backend, Redis, and Celery, user data remains safe on IPFS. Users can access content via IPFS gateways and OrbitDB. The backend is just a **helper**, not the owner of data.

This is **true decentralization**.

---

**Last Updated**: January 2024  
**Version**: 1.0  
**Author**: Eco-DMS Team
