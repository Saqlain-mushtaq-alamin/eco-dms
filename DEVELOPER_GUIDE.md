# Developer Guide: Using the Shared Packages

## Overview
Your Eco-DMS project now has a monorepo structure with shared packages that work across web and mobile. This guide shows you how to use them effectively.

## Quick Reference

### Import Components
```typescript
import { Button, Card, WalletConnectButton, PostCard, ProfileCard } from '@eco-dms/ui';
```

### Import Hooks
```typescript
import { useWallet, useAuth, useOptimistic, useToast } from '@eco-dms/hooks';
```

### Import Services
```typescript
import { ApiService, SIWEService, GraphQLService } from '@eco-dms/services';
```

## Common Patterns

### 1. Wallet Connection

```typescript
import { WalletConnectButton } from '@eco-dms/ui';
import { useWallet } from '@eco-dms/hooks';
import { WalletService, SIWEService } from '@eco-dms/services';

function MyComponent() {
  const { address, connect, connected, loading } = useWallet();
  
  return (
    <WalletConnectButton
      onPress={connect}
      connected={connected}
      address={address}
      loading={loading}
    />
  );
}
```

### 2. Authentication with SIWE

```typescript
import { useAuth } from '@eco-dms/hooks';
import { Button } from '@eco-dms/ui';

function AuthButton() {
  const { user, authenticated, signIn, signOut } = useAuth();
  
  const handleAuth = () => {
    if (authenticated) {
      signOut();
    } else {
      // Implement SIWE flow
      signIn(address, signature, message);
    }
  };
  
  return (
    <Button 
      title={authenticated ? 'Sign Out' : 'Sign In'}
      onPress={handleAuth}
    />
  );
}
```

### 3. Optimistic UI Updates

```typescript
import { PostCard } from '@eco-dms/ui';
import { useOptimistic } from '@eco-dms/hooks';
import { ApiService } from '@eco-dms/services';

function Post({ postId, initialLikes, initialIsLiked }) {
  const api = new ApiService({ baseUrl: 'http://localhost:8000' });
  
  const [post, updatePost, isPending] = useOptimistic({
    likes: initialLikes,
    isLiked: initialIsLiked,
  });
  
  const handleLike = () => {
    const newLikes = post.isLiked ? post.likes - 1 : post.likes + 1;
    
    updatePost(
      { likes: newLikes, isLiked: !post.isLiked },
      async () => {
        const result = await api.post(`/posts/${postId}/like`, {});
        return result.data;
      }
    );
  };
  
  return (
    <PostCard
      {...postData}
      likes={post.likes}
      isLiked={post.isLiked}
      onLike={handleLike}
      isOptimistic={isPending}
    />
  );
}
```

### 4. Toast Notifications

```typescript
import { useToast } from '@eco-dms/hooks';
import { Button } from '@eco-dms/ui';

function MyComponent() {
  const toast = useToast();
  
  const handleSuccess = () => {
    toast.success('Action completed successfully!');
  };
  
  const handleError = () => {
    toast.error('Something went wrong', 'Error');
  };
  
  return (
    <>
      <Button title="Success" onPress={handleSuccess} />
      <Button title="Error" onPress={handleError} variant="secondary" />
    </>
  );
}
```

### 5. Form with Validation

```typescript
import { useState } from 'react';
import { Input, Button, Card } from '@eco-dms/ui';
import { useToast } from '@eco-dms/hooks';

function ProfileForm() {
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [errors, setErrors] = useState({});
  const toast = useToast();
  
  const handleSubmit = async () => {
    if (!username.trim()) {
      setErrors({ username: 'Username is required' });
      return;
    }
    
    try {
      // Submit to API
      toast.success('Profile updated!');
    } catch (error) {
      toast.error('Failed to update profile');
    }
  };
  
  return (
    <Card>
      <Input
        label="Username"
        value={username}
        onChangeText={setUsername}
        error={errors.username}
        placeholder="Enter username"
      />
      <Input
        label="Bio"
        value={bio}
        onChangeText={setBio}
        placeholder="Tell us about yourself"
        multiline
        numberOfLines={4}
        style={{ marginTop: 16 }}
      />
      <Button
        title="Save Profile"
        onPress={handleSubmit}
        style={{ marginTop: 24 }}
      />
    </Card>
  );
}
```

### 6. Search with Debounce

```typescript
import { useState, useEffect } from 'react';
import { Input, Card, LoadingSpinner } from '@eco-dms/ui';
import { useDebounce } from '@eco-dms/hooks';
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
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Card>
      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Search users..."
      />
      {loading && <LoadingSpinner />}
      {results.map(user => (
        <ProfileCard key={user.address} {...user} />
      ))}
    </Card>
  );
}
```

## Platform-Specific Considerations

### Web (apps/web)
- Use standard React patterns
- WalletService works with window.ethereum automatically
- Styled with React Native Web (uses StyleSheet)

### Mobile (apps/mobile)
- Use React Native patterns
- Configure WalletConnect provider for WalletService
- Same components, same code!

## Styling

All components accept a `style` prop. Use React Native StyleSheet:

```typescript
import { StyleSheet } from 'react-native';
import { Button, Card } from '@eco-dms/ui';

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  button: {
    marginTop: 20,
  },
});

function MyComponent() {
  return (
    <Card style={styles.container}>
      <Button 
        title="Click me" 
        onPress={() => {}}
        style={styles.button}
      />
    </Card>
  );
}
```

### Using Theme

```typescript
import { useTheme } from '@eco-dms/ui';
import { View, Text } from 'react-native';

function ThemedComponent() {
  const theme = useTheme();
  
  return (
    <View style={{ 
      backgroundColor: theme.colors.background,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.lg,
    }}>
      <Text style={{ 
        color: theme.colors.text,
        fontSize: theme.typography.h2.fontSize,
      }}>
        Themed Text
      </Text>
    </View>
  );
}
```

## API Integration

### Initialize API Service

```typescript
// services/api.ts (create this in your app)
import { ApiService } from '@eco-dms/services';

export const api = new ApiService({
  baseUrl: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  timeout: 30000,
});

// Set auth token after login
export const setAuthToken = (token: string) => {
  api.setAuthToken(token);
};
```

### Use in Components

```typescript
import { api } from '../services/api';
import { useToast } from '@eco-dms/hooks';

function MyComponent() {
  const toast = useToast();
  
  const loadData = async () => {
    try {
      const response = await api.get('/users/profile');
      // Handle response
    } catch (error) {
      toast.error('Failed to load data');
    }
  };
  
  return // ...
}
```

## Testing

### Component Testing

```typescript
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '@eco-dms/ui';

test('button calls onPress when clicked', () => {
  const onPress = jest.fn();
  const { getByText } = render(
    <Button title="Click me" onPress={onPress} />
  );
  
  fireEvent.press(getByText('Click me'));
  expect(onPress).toHaveBeenCalled();
});
```

## Type Safety

All packages are fully typed. Import types when needed:

```typescript
import type { Theme } from '@eco-dms/ui';
import type { WalletState, User } from '@eco-dms/hooks';
import type { ApiResponse } from '@eco-dms/services';

const handleResponse = (response: ApiResponse<User>) => {
  console.log(response.data.address);
};
```

## Best Practices

1. **Always use shared components** - Don't create duplicate UI
2. **Use optimistic updates** - Better UX for user actions
3. **Debounce search inputs** - Reduce API calls
4. **Handle errors gracefully** - Use toast notifications
5. **Type everything** - TypeScript is your friend
6. **Test across platforms** - Code should work everywhere

## Troubleshooting

### "Cannot find module '@eco-dms/ui'"
- Make sure you ran `pnpm install` from root
- Check tsconfig.json has correct path mappings
- Restart TypeScript server

### Components look different on web vs mobile
- Use StyleSheet instead of CSS
- Avoid platform-specific styling
- Test on both platforms regularly

### TypeScript errors in shared packages
-Run `pnpm type-check` from root
- Check for circular dependencies
- Ensure all packages have correct types

## Getting Help

- Read package READMEs: `packages/*/README.md`
- Check Phase 6 docs: `PHASE6_MONOREPO_SETUP.md`
- View examples in `packages/ui/EXAMPLE_*.tsx`

## Happy Coding! 🚀

You're all set to build amazing cross-platform features with shared code!
