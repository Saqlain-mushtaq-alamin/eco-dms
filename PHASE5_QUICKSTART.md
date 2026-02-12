# 🚀 QUICK START: Phase 5 - The Graph

## What We Built

**A gasless social media indexing system** where:
- ✅ Users NEVER pay gas fees for posting or interacting
- ✅ Backend sponsors gas for eco-verifications and rewards
- ✅ GraphQL provides instant queries (no blockchain lag)
- ✅ Complete data model for users, posts, verifications, and rewards

---

## 🏃 Quick Start (3 Steps)

### Step 1: Start The Graph Node

```bash
# Start PostgreSQL + IPFS + Graph Node in Docker
make graph-start

# Wait 10 seconds for services to initialize
```

**What this does:**
- Starts PostgreSQL (database for indexed data)
- Starts IPFS (decentralized file storage)
- Starts Graph Node (indexes blockchain events)

### Step 2: Deploy Contracts & Backend

```bash
# Start Hardhat, deploy contracts, start backend
make dev

# This will:
# 1. Start Hardhat local blockchain
# 2. Deploy RewardToken and Verification contracts
# 3. Start backend API
# 4. Start web frontend
```

**Wait for the message:**
```
All services started:
  Backend http://127.0.0.1:8000
  Web http://localhost:5173
  Hardhat http://127.0.0.1:8545
```

### Step 3: Deploy Subgraph

```bash
# Build and deploy subgraph to Graph Node
make graph-deploy

# This will:
# 1. Copy contract ABIs
# 2. Extract contract addresses
# 3. Generate TypeScript types
# 4. Compile to WebAssembly
# 5. Deploy to Graph Node
```

**Success message:**
```
✅ Subgraph deployed!
🔗 GraphQL endpoint: http://127.0.0.1:8000/subgraphs/name/eco-dms
```

---

## 🎯 Test It Out

### 1. Open GraphQL Playground

Visit: http://127.0.0.1:8000/subgraphs/name/eco-dms/graphql

### 2. Run Example Queries

**Get Platform Stats:**
```graphql
{
  globalStats(id: "global") {
    totalUsers
    totalPosts
    totalEcoVerifiedPosts
    totalRewardsMinted
  }
}
```

**Get All Users:**
```graphql
{
  users(first: 10) {
    id
    handle
    totalPosts
    totalEcoVerifications
    totalEcoRewards
    tokenBalance
  }
}
```

**Get Eco-Verified Posts:**
```graphql
{
  posts(where: { isEcoVerified: true }, first: 10) {
    id
    contentCID
    author {
      id
      handle
    }
    ecoConfidence
    totalLikes
  }
}
```

### 3. Create Test Data

**In your web app:**
1. Connect wallet
2. Create a post about eco-friendly activity
3. Backend will verify it (ML)
4. Smart contract emits events
5. The Graph indexes them
6. Query GraphQL to see your data!

---

## 🛠️ Development Workflow

### View Logs

```bash
# Graph Node logs
make graph-logs

# Backend logs
# (Check terminal where you ran `make dev`)
```

### Stop Services

```bash
# Stop everything
make stop

# Or stop Graph Node only
make graph-stop
```

### Rebuild Subgraph

```bash
# After changing schema or mappings
cd subgraph
pnpm graph:codegen  # Regenerate types
pnpm graph:build    # Rebuild WASM
pnpm graph:deploy:local  # Redeploy
```

### Full Restart

```bash
make stop           # Stop all services
make graph-start    # Start Graph Node
make dev            # Start backend + contracts + web
make graph-deploy   # Deploy subgraph
```

---

## 📊 All-in-One Command

**For convenience, use:**

```bash
make dev-full
```

This automatically:
1. Starts Graph Node stack
2. Starts backend + contracts + web
3. Waits for contracts to deploy
4. Deploys subgraph

**One command = full system running!**

---

## 🔧 Troubleshooting

### "Failed to connect to Graph Node"

```bash
# Check if services are running
docker ps

# Should see: graph-node, graph-postgres, graph-ipfs

# If not, restart
make graph-stop
make graph-start
```

### "Subgraph not syncing"

```bash
# Check if Hardhat is running
curl -X POST http://127.0.0.1:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","id":1}'

# Restart Graph Node
docker-compose -f infrastructure/docker-compose.graph.yml restart
```

### "No data in GraphQL"

1. Ensure contracts are deployed:
   ```bash
   # Check if addresses are in config
   cat apps/web/src/config/contracts.ts
   ```

2. Ensure subgraph is deployed:
   ```bash
   # Redeploy subgraph
   make graph-deploy
   ```

3. Generate test data:
   - Create posts in web app
   - Backend should verify them
   - Check backend logs for verification events

---

## 📚 Learn More

- [Full Documentation](./subgraph/README.md)
- [GraphQL Query Examples](./subgraph/GRAPHQL_QUERIES.md)
- [Complete Phase 5 Summary](./PHASE5_COMPLETE.md)
- [Schema Reference](./subgraph/schema.graphql)

---

## ✅ Checklist

- [ ] Graph Node running (`docker ps` shows 3 containers)
- [ ] Contracts deployed (`ls apps/web/src/config/contracts.ts`)
- [ ] Backend running (`curl http://127.0.0.1:8000`)
- [ ] Subgraph deployed (`make graph-deploy` successful)
- [ ] GraphQL accessible (visit http://127.0.0.1:8000/subgraphs/name/eco-dms/graphql)

**All checked? You're ready to build! 🎉**
