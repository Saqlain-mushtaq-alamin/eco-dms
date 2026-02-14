# @eco-dms/hooks

Shared React hooks for common functionality in Eco-DMS.

## Installation

This package is part of the Eco-DMS monorepo. It's automatically available when you run `pnpm install` from the root.

## Usage

```typescript
import { useWallet, useAuth, useOptimistic, useDebounce, useToast } from '@eco-dms/hooks';
```

## Hooks

### useWallet

Manage wallet connection state.

```typescript
const {
  address,        // Current wallet address
  chainId,        // Current chain ID
  connected,      // Connection status
  loading,        // Loading state
  error,          // Error object
  connect,        // Connect function
  disconnect,     // Disconnect function
  switchChain,    // Switch chain function
} = useWallet(provider);

// Example
const handleConnect = async () => {
  await connect();
};
```

### useAuth

SIWE (Sign-In with Ethereum) authentication.

```typescript
const {
  user,           // Current user object
  authenticated,  // Authentication status
  loading,        // Loading state
  error,          // Error message
  signIn,         // Sign in function
  signOut,        // Sign out function
  updateProfile,  // Update profile function
} = useAuth();

// Example
const handleSignIn = async (address, signature, message) => {
  await signIn(address, signature, message);
};
```

**User Type:**
```typescript
interface User {
  address: string;
  username?: string;
  bio?: string;
  avatarUri?: string;
  ecoScore?: number;
  verifiedActions?: number;
}
```

### useOptimistic

Optimistic UI updates for instant feedback.

```typescript
const [state, update, isPending] = useOptimistic(initialState);

// Example - Like a post
const handleLike = () => {
  update(
    { ...post, likes: post.likes + 1, isLiked: true }, // Optimistic state
    async () => {
      // Actual API call
      const result = await api.likePost(postId);
      return result.data; // Real state from server
    }
  );
};
```

**Benefits:**
- Instant UI updates
- Automatic rollback on error
- Seamless async handling

### useDebounce

Debounce values for search inputs, etc.

```typescript
const debouncedValue = useDebounce(value, delay);

// Example - Search
function SearchInput() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  
  useEffect(() => {
    if (debouncedSearch) {
      performSearch(debouncedSearch);
    }
  }, [debouncedSearch]);
  
  return <Input value={search} onChangeText={setSearch} />;
}
```

### useToast

Toast notifications (platform-agnostic).

```typescript
const {
  toasts,    // Array of active toasts
  show,      // Show custom toast
  dismiss,   // Dismiss toast by ID
  success,   // Show success toast
  error,     // Show error toast
  warning,   // Show warning toast
  info,      // Show info toast
} = useToast();

// Examples
toast.success('Action completed!');
toast.error('Something went wrong', 'Error');
toast.warning('Please verify your action');
toast.info('New feature available');

// Custom toast
const id = toast.show({
  message: 'Custom message',
  type: 'success',
  duration: 3000,
});

// Dismiss programmatically
toast.dismiss(id);
```

## Complete Examples

### Wallet Connection Flow

```typescript
import { useWallet, useAuth, useToast } from '@eco-dms/hooks';
import { SIWEService } from '@eco-dms/services';

function WalletConnect() {
  const { address, connect, connected } = useWallet();
  const { signIn, user } = useAuth();
  const toast = useToast();
  
  const siwe = new SIWEService({
    domain: 'eco-dms.app',
    uri: 'https://eco-dms.app',
    chainId: 1,
  });
  
  const handleConnect = async () => {
    try {
      await connect();
      toast.success('Wallet connected!');
    } catch (error) {
      toast.error('Failed to connect wallet');
    }
  };
  
  const handleSignIn = async () => {
    if (!address) return;
    
    try {
      const message = siwe.createMessage(address);
      const formatted = siwe.formatMessage(message);
      // Sign with wallet
      const signature = await wallet.signMessage(formatted);
      
      await signIn(address, signature, formatted);
      toast.success('Signed in successfully!');
    } catch (error) {
      toast.error('Sign in failed');
    }
  };
  
  return (
    <View>
      {!connected && (
        <Button title="Connect Wallet" onPress={handleConnect} />
      )}
      {connected && !user && (
        <Button title="Sign In" onPress={handleSignIn} />
      )}
      {user && (
        <Text>Welcome, {user.username || user.address}</Text>
      )}
    </View>
  );
}
```

### Optimistic Social Interactions

```typescript
import { useOptimistic, useToast } from '@eco-dms/hooks';
import { PostCard } from '@eco-dms/ui';
import { ApiService } from '@eco-dms/services';

function Post({ postId, initialData }) {
  const api = new ApiService({ baseUrl: 'http://localhost:8000' });
  const toast = useToast();
  
  const [post, updatePost, isPending] = useOptimistic({
    likes: initialData.likes,
    isLiked: initialData.isLiked,
  });
  
  const handleLike = async () => {
    const newLikes = post.isLiked ? post.likes - 1 : post.likes + 1;
    
    updatePost(
      { likes: newLikes, isLiked: !post.isLiked },
      async () => {
        try {
          const result = await api.post(`/posts/${postId}/like`, {});
          return result.data;
        } catch (error) {
          toast.error('Failed to like post');
          throw error; // Will rollback
        }
      }
    );
  };
  
  return (
    <PostCard
      {...initialData}
      likes={post.likes}
      isLiked={post.isLiked}
      isOptimistic={isPending}
      onLike={handleLike}
    />
  );
}
```

### Search with Debounce

```typescript
import { useState, useEffect } from 'react';
import { useDebounce } from '@eco-dms/hooks';
import { Input } from '@eco-dms/ui';
import { ApiService } from '@eco-dms/services';

function UserSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const debouncedQuery = useDebounce(query, 500);
  const api = new ApiService({ baseUrl: 'http://localhost:8000' });
  
  useEffect(() => {
    if (debouncedQuery) {
      searchUsers(debouncedQuery);
    } else {
      setResults([]);
    }
  }, [debouncedQuery]);
  
  const searchUsers = async (q: string) => {
    setLoading(true);
    try {
      const response = await api.get('/users/search', { q });
      setResults(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <View>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Search users..."
      />
      {loading && <LoadingSpinner />}
      {results.map(user => (
        <UserCard key={user.address} {...user} />
      ))}
    </View>
  );
}
```

## Type Safety

All hooks are fully typed with TypeScript:

```typescript
import type {
  WalletState,
  WalletError,
  AuthState,
  User,
  ToastOptions,
} from '@eco-dms/hooks';
```

## Platform Compatibility

All hooks work on:
- ✅ Web (React)
- ✅ Mobile (React Native)
- ✅ Desktop (Electron - future)
