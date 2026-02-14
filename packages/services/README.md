# @eco-dms/services

Platform-agnostic services for backend communication, wallet interactions, and blockchain operations.

## Installation

This package is part of the Eco-DMS monorepo. It's automatically available when you run `pnpm install` from the root.

## Usage

```typescript
import {
  ApiService,
  WalletService,
  SIWEService,
  GraphQLService,
  MetaTransactionService,
} from '@eco-dms/services';
```

## Services

### ApiService

REST API client with authentication.

```typescript
const api = new ApiService({
  baseUrl: 'http://localhost:8000',
  timeout: 30000,
  headers: { 'Custom-Header': 'value' },
});

// GET request
const users = await api.get('/users', { page: '1', limit: '10' });

// POST request
const newPost = await api.post('/posts', {
  content: 'Hello world!',
  imageUri: 'https://example.com/image.jpg',
});

// PUT request
const updated = await api.put('/users/profile', {
  username: 'newname',
  bio: 'New bio',
});

// DELETE request
await api.delete('/posts/123');

// Authentication
api.setAuthToken('jwt-token-here');
api.clearAuthToken();
```

**Response Format:**
```typescript
{
  data: T,       // Response payload
  status: number, // HTTP status code
  message?: string
}
```

### WalletService

Ethereum wallet interactions.

```typescript
const wallet = new WalletService();

// Connect wallet
const { address, chainId } = await wallet.connect();

// Sign message
const signature = await wallet.signMessage('Hello Ethereum!');

// Switch chain
await wallet.switchChain(137); // Polygon

// Get provider & signer
const provider = wallet.getProvider();
const signer = wallet.getSigner();

// Disconnect
await wallet.disconnect();
```

**Platform-Specific:**
- **Web**: Uses window.ethereum (MetaMask, etc.)
- **Mobile**: Extend with WalletConnect provider

### SIWEService

Sign-In with Ethereum (EIP-4361).

```typescript
const siwe = new SIWEService({
  domain: 'eco-dms.app',
  uri: 'https://eco-dms.app',
  chainId: 1,
  version: '1',
  nonce: 'optional-nonce',
});

// Create SIWE message
const message = siwe.createMessage(
  address,
  'Sign in to Eco-DMS' // optional statement
);

// Format for signing
const formatted = siwe.formatMessage(message);

// User signs with wallet
const signature = await wallet.signMessage(formatted);

// Verify on backend
const isValid = await siwe.verifyMessage(
  message,
  signature,
  'http://localhost:8000'
);
```

**Message Format (EIP-4361):**
```
eco-dms.app wants you to sign in with your Ethereum account:
0x1234567890123456789012345678901234567890

Sign in to Eco-DMS

URI: https://eco-dms.app
Version: 1
Chain ID: 1
Nonce: abc123xyz
Issued At: 2024-01-01T00:00:00.000Z
Expiration Time: 2024-01-02T00:00:00.000Z
```

### GraphQLService

Query The Graph subgraph.

```typescript
const graphql = new GraphQLService('https://api.thegraph.com/subgraphs/name/eco-dms');

// Custom query
const result = await graphql.query(`
  query GetUser($id: ID!) {
    user(id: $id) {
      address
      ecoScore
      verifiedActions
    }
  }
`, { id: '0x1234...' });

// Built-in queries
const profile = await graphql.getUserProfile(address);
const posts = await graphql.getUserPosts(address, 20);
const verifications = await graphql.getVerifications(address);
const feed = await graphql.getFeed(20, 0);
```

**Available Queries:**
- `getUserProfile(address)` - Get user profile
- `getUserPosts(address, limit)` - Get user's posts
- `getVerifications(address)` - Get verification history
- `getFeed(limit, skip)` - Get global feed

### MetaTransactionService

Gasless transactions via relay.

```typescript
const relay = new MetaTransactionService({
  relayerUrl: 'https://relay.eco-dms.app',
  apiKey: 'your-api-key',
});

// Send gasless transaction
const result = await relay.sendTransaction({
  from: userAddress,
  to: contractAddress,
  data: encodedFunctionCall,
  value: '0',
  gas: '100000',
  chainId: 1,
});

// Check status
const status = await relay.getTransactionStatus(result.taskId);

// Batch transactions
const results = await relay.batchTransactions([
  { from, to, data, chainId: 1 },
  { from, to, data, chainId: 1 },
]);
```

**Integration Options:**
- Biconomy
- Gelato
- Custom relayer

## Complete Examples

### Full Authentication Flow

```typescript
import { WalletService, SIWEService, ApiService } from '@eco-dms/services';

async function authenticateUser() {
  // 1. Connect wallet
  const wallet = new WalletService();
  const { address, chainId } = await wallet.connect();
  
  // 2. Create SIWE message
  const siwe = new SIWEService({
    domain: window.location.host,
    uri: window.location.origin,
    chainId,
  });
  
  const message = siwe.createMessage(address);
  const formatted = siwe.formatMessage(message);
  
  // 3. Sign message
  const signature = await wallet.signMessage(formatted);
  
  // 4. Verify and get JWT
  const api = new ApiService({ baseUrl: 'http://localhost:8000' });
  const response = await api.post('/auth/login', {
    message,
    signature,
  });
  
  // 5. Set auth token
  api.setAuthToken(response.data.token);
  
  return { address, api };
}
```

### Query User Data from Subgraph

```typescript
import { GraphQLService } from '@eco-dms/services';

async function loadUserDashboard(address: string) {
  const graphql = new GraphQLService('https://api.thegraph.com/...');
  
  // Load all user data in parallel
  const [profile, posts, verifications] = await Promise.all([
    graphql.getUserProfile(address),
    graphql.getUserPosts(address, 10),
    graphql.getVerifications(address),
  ]);
  
  return {
    user: profile.user,
    recentPosts: posts.posts,
    verifications: verifications.verifications,
  };
}
```

### Gasless Transaction with Meta-Transaction

```typescript
import { MetaTransactionService } from '@eco-dms/services';
import { Contract } from 'ethers';

async function submitVerificationGasless(
  userAddress: string,
  actionType: string,
  data: string
) {
  const relay = new MetaTransactionService({
    relayerUrl: 'https://relay.eco-dms.app',
    apiKey: process.env.RELAY_API_KEY,
  });
  
  // Encode contract call
  const contract = new Contract(contractAddress, abi);
  const encodedData = contract.interface.encodeFunctionData(
    'submitVerification',
    [actionType, data]
  );
  
  // Submit via relay
  const result = await relay.sendTransaction({
    from: userAddress,
    to: contractAddress,
    data: encodedData,
    chainId: 1,
  });
  
  console.log('Task ID:', result.taskId);
  
  // Poll for status
  let status = result.status;
  while (status === 'pending' || status === 'submitted') {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const update = await relay.getTransactionStatus(result.taskId);
    status = update.status;
    
    if (status === 'confirmed') {
      console.log('Transaction confirmed:', update.transactionHash);
      return update.transactionHash;
    }
  }
  
  throw new Error('Transaction failed');
}
```

### Unified API Client

```typescript
import { ApiService } from '@eco-dms/services';

class EcoDMSClient {
  private api: ApiService;
  
  constructor(baseUrl: string) {
    this.api = new ApiService({ baseUrl });
  }
  
  async getPosts(page = 1, limit = 20) {
    const response = await this.api.get('/posts', {
      page: page.toString(),
      limit: limit.toString(),
    });
    return response.data;
  }
  
  async createPost(content: string, imageUri?: string) {
    const response = await this.api.post('/posts', {
      content,
      imageUri,
    });
    return response.data;
  }
  
  async likePost(postId: string) {
    const response = await this.api.post(`/posts/${postId}/like`, {});
    return response.data;
  }
  
  async updateProfile(updates: { username?: string; bio?: string }) {
    const response = await this.api.put('/users/profile', updates);
    return response.data;
  }
}

// Usage
const client = new EcoDMSClient('http://localhost:8000');
client.api.setAuthToken(token);
const posts = await client.getPosts();
```

## Error Handling

```typescript
try {
  const result = await api.get('/users');
} catch (error) {
  console.error(error.message); // Error message
  console.error(error.status);  // HTTP status
  console.error(error.code);    // Error code
}
```

## Type Safety

All services are fully typed:

```typescript
import type {
  ApiConfig,
  ApiResponse,
  ApiError,
  SIWEMessage,
  SIWEConfig,
  MetaTransactionConfig,
  RelayRequest,
  RelayResponse,
} from '@eco-dms/services';
```

## Platform Compatibility

All services work on:
- ✅ Web (fetch API)
- ✅ Mobile (React Native fetch)
- ✅ Node.js (backend testing)
