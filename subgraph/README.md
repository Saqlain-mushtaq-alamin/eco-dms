# 🔎 Phase 5: The Graph Indexing

Complete indexing solution for ECO-DMS using The Graph protocol.

## 🏗️ Architecture Overview

### **Gasless Social Media Design**

This implementation uses a **hybrid architecture** to enable FREE user interactions:

```
┌─────────────────────────────────────────────────────────┐
│                     USER EXPERIENCE                      │
│                                                          │
│  ✅ Post, Like, Comment → FREE (no gas)                 │
│  ✅ Receive ECO rewards → FREE (backend pays gas)       │
│  ✅ Query data → INSTANT (GraphQL)                      │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
┌───────▼────────┐                    ┌────────▼────────┐
│  SOCIAL LAYER  │                    │ REWARD LAYER    │
│   (OFF-CHAIN)  │                    │  (ON-CHAIN)     │
├────────────────┤                    ├─────────────────┤
│ • Backend API  │                    │ • Smart         │
│ • IPFS Storage │                    │   Contracts     │
│ • No gas fees  │                    │ • Backend pays  │
│ • Fast writes  │                    │   gas via       │
└────────┬───────┘                    │   relayer       │
         │                            └────────┬────────┘
         │                                     │
         └──────────┬──────────────────────────┘
                    │
            ┌───────▼────────┐
            │   THE GRAPH     │
            │   (INDEXING)    │
            ├────────────────┤
            │ • GraphQL API   │
            │ • Fast queries  │
            │ • Aggregations  │
            └────────────────┘
```

### **What This Means:**

1. **Social Interactions (FREE)** 📱
   - Posts, likes, comments stored in **backend + IPFS**
   - Users authenticate with **SIWE** (Sign-In with Ethereum - free signature)
   - No blockchain transactions = **no gas fees**
   - Content is decentralized (IPFS) but interactions are gasless

2. **Eco Verifications (Backend Sponsored)** 🌱
   - ML backend verifies eco-friendliness
   - Backend calls smart contract (backend pays gas)
   - User receives **5 ECO tokens without paying anything**
   - Transparent, on-chain proof of verification

3. **The Graph (Fast Queries)** 🚀
   - Indexes blockchain events (verifications, rewards)
   - Can fetch IPFS content for posts
   - GraphQL API for instant data access
   - Aggregated stats (leaderboards, feeds, user timelines)

---

## 📦 What's Included

### **Schema Entities** ([schema.graphql](./schema.graphql))

- **User**: Profile with on-chain rewards + off-chain social stats
- **Post**: Content (IPFS CID) + verification status
- **Edge**: Social interactions (likes, comments, follows)
- **Verification**: ML verdict events from smart contract
- **Reward**: ECO token minting events
- **TokenTransfer**: ERC-20 transfer tracking
- **GlobalStats**: Platform-wide metrics

### **Mappings** ([src/](./src/))

- `reward-token-mapping.ts` - Tracks ECO token transfers
- `verification-mapping.ts` - Indexes verifications & rewards
- `profile-mapping.ts` - Handles user profiles (optional)

### **GraphQL Queries** ([GRAPHQL_QUERIES.md](./GRAPHQL_QUERIES.md))

Complete examples for:
- User profiles & leaderboards
- Post feeds (all posts, eco-verified only)
- Social interactions (likes, comments, follows)
- Verification history
- Reward earnings & daily stats
- Dashboard data (single query)

---

## 🚀 Quick Start

### Prerequisites

```bash
# Option 1: Docker (Recommended)
docker --version

# Option 2: Manual installation
# Install Graph CLI
pnpm add -g @graphprotocol/graph-cli

# Install PostgreSQL, IPFS, Ethereum node
```

### 1. Start Graph Node (Docker)

```bash
# Start local Graph Node + PostgreSQL + IPFS
cd infrastructure
docker-compose -f docker-compose.graph.yml up -d

# Verify services
docker ps  # Should see graph-node, postgres, ipfs containers
```

### 2. Deploy Contracts (if not already)

```bash
# Make sure contracts are deployed
make dev  # Starts Hardhat + deploys contracts

# Verify deployment
ls apps/web/src/config/contracts.ts  # Should contain addresses
```

### 3. Build & Deploy Subgraph

```bash
cd subgraph

# Prepare (copy ABIs + update addresses)
pnpm graph:prepare

# Generate TypeScript types
pnpm graph:codegen

# Build subgraph
pnpm graph:build

# Deploy to local Graph Node
pnpm graph:deploy:local

# OR all in one command:
pnpm graph:deploy
```

### 4. Verify Deployment

```bash
# GraphQL endpoint
curl http://127.0.0.1:8000/subgraphs/name/eco-dms/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ globalStats(id: \"global\") { totalPosts } }"}'

# Or visit GraphQL Playground
open http://127.0.0.1:8000/subgraphs/name/eco-dms/graphql
```

---

## 🛠️ Development Workflow

### Make Changes to Schema

```bash
# 1. Edit schema.graphql
# 2. Regenerate types
pnpm graph:codegen

# 3. Update mappings (src/*.ts)
# 4. Rebuild & redeploy
pnpm graph:build
pnpm graph:deploy:local
```

### Test Queries

```bash
# Use GraphQL Playground
open http://127.0.0.1:8000/subgraphs/name/eco-dms/graphql

# Or use curl
curl -X POST http://127.0.0.1:8000/subgraphs/name/eco-dms/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { users(first: 5) { id handle totalEcoRewards } }"
  }'
```

### Debug Mappings

```bash
# Check Graph Node logs
docker logs -f graph-node

# Common errors:
# - "no block with that hash found" → Hardhat needs to mine blocks
# - "value is not an Address" → Check type conversions
# - "entity not found" → Use loadOrCreate pattern
```

---

## 🌐 Production Deployment

### Option 1: The Graph Hosted Service (Deprecated but still works)

```bash
# Authenticate
graph auth --product hosted-service <ACCESS_TOKEN>

# Deploy
graph deploy --product hosted-service <USERNAME>/eco-dms
```

### Option 2: The Graph Studio (Recommended)

```bash
# 1. Create subgraph at https://thegraph.com/studio/
# 2. Get deploy key
graph auth --studio <DEPLOY_KEY>

# 3. Deploy
graph deploy --studio eco-dms
```

### Option 3: Self-Hosted Graph Node

```bash
# Use infrastructure/docker-compose.graph.yml
# Update with your production RPC endpoint
# Deploy subgraph to your own node
```

---

## 📊 Frontend Integration

### Install Apollo Client

```bash
cd apps/web
pnpm add @apollo/client graphql
```

### Setup Client

```typescript
// src/config/apollo.ts
import { ApolloClient, InMemoryCache } from '@apollo/client';

export const apolloClient = new ApolloClient({
  uri: process.env.VITE_GRAPH_URL || 'http://127.0.0.1:8000/subgraphs/name/eco-dms',
  cache: new InMemoryCache(),
});
```

### Use in App

```tsx
// src/main.tsx
import { ApolloProvider } from '@apollo/client';
import { apolloClient } from './config/apollo';

root.render(
  <ApolloProvider client={apolloClient}>
    <App />
  </ApolloProvider>
);
```

### Query Data

```tsx
// src/pages/Feed.tsx
import { useQuery, gql } from '@apollo/client';

const GET_ECO_FEED = gql`
  query GetEcoFeed($first: Int!) {
    posts(
      first: $first
      where: { isEcoVerified: true }
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      contentCID
      author { handle }
      ecoConfidence
    }
  }
`;

export function Feed() {
  const { data, loading } = useQuery(GET_ECO_FEED, {
    variables: { first: 20 },
  });

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {data.posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
```

---

## 🎯 Key Features

### ✅ Gasless Social Media
- Users never pay gas for posting or interacting
- Backend handles all blockchain transactions
- Content stored on IPFS for decentralization

### ✅ Fast Queries
- GraphQL API for instant data access
- Complex aggregations without blockchain queries
- Pagination & filtering built-in

### ✅ Real-Time Updates
- Automatic indexing of new events
- Can add GraphQL subscriptions for live data
- Minimal latency (< 1 second sync)

### ✅ Rich Data Model
- User profiles with social + reward stats
- Post metadata with verification status
- Social graph (likes, comments, follows)
- Complete reward history

---

## 📚 Documentation

- [GraphQL Queries](./GRAPHQL_QUERIES.md) - Complete query examples
- [Schema Reference](./schema.graphql) - Entity definitions
- [The Graph Docs](https://thegraph.com/docs/) - Official documentation

---

## 🐛 Troubleshooting

### Subgraph not syncing?

```bash
# Check if Hardhat is running
curl -X POST http://127.0.0.1:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Restart Graph Node
docker-compose -f infrastructure/docker-compose.graph.yml restart
```

### "Failed to fetch" errors?

- Check Graph Node is running: `docker ps`
- Verify endpoint URL in apollo client
- Check CORS settings if accessing from different domain

### Missing data?

- Ensure contracts are deployed to correct addresses
- Run `pnpm graph:prepare` to update addresses
- Check event signatures match ABI

---

## 🌟 Next Steps

1. **Add GraphQL Subscriptions** for real-time data
2. **Implement IPFS mappings** to fetch post content automatically
3. **Add more aggregations** (trending posts, daily rewards stats)
4. **Deploy to production** (The Graph Studio)
5. **Optimize queries** with @derivedFrom and caching

---

**Built with ❤️ for a gasless, decentralized social media future**
