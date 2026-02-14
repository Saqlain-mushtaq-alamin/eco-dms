# @eco-dms/ui

Shared UI component library for Eco-DMS. Works seamlessly across web and mobile using React Native Web.

## Installation

This package is part of the Eco-DMS monorepo. It's automatically available when you run `pnpm install` from the root.

## Usage

```typescript
import { Button, Card, WalletConnectButton } from '@eco-dms/ui';
import { theme, ThemeProvider, useTheme } from '@eco-dms/ui';
```

## Components

### Button
Universal button component with multiple variants.

```typescript
<Button
  title="Click me"
  onPress={() => console.log('clicked')}
  variant="primary" // primary | secondary | outline | ghost
  size="md"        // sm | md | lg
  loading={false}
  disabled={false}
/>
```

### Input
Text input with label and error states.

```typescript
<Input
  value={text}
  onChangeText={setText}
  label="Username"
  placeholder="Enter username"
  error={error}
  secureTextEntry={false}
  multiline={false}
/>
```

### Card
Container component with consistent styling.

```typescript
<Card padding="md">
  <Text>Card content</Text>
</Card>
```

### Avatar
User avatar with initials fallback.

```typescript
<Avatar
  uri="https://example.com/avatar.jpg"
  name="John Doe"
  size="md" // sm | md | lg | xl
/>
```

### WalletConnectButton
Wallet connection button with address display.

```typescript
<WalletConnectButton
  onPress={connectWallet}
  connected={isConnected}
  address={walletAddress}
  loading={isConnecting}
/>
```

### ProfileCard
User profile display with stats.

```typescript
<ProfileCard
  address="0x1234...5678"
  username="eco_warrior"
  bio="Saving the planet one action at a time"
  avatarUri="https://example.com/avatar.jpg"
  ecoScore={150}
  verifiedActions={25}
/>
```

### PostCard
Social media post with interactions.

```typescript
<PostCard
  author={{
    address: "0x1234...5678",
    username: "eco_warrior",
    avatarUri: "https://example.com/avatar.jpg"
  }}
  content="Just verified my first eco-action!"
  imageUri="https://example.com/photo.jpg"
  timestamp={Date.now()}
  likes={42}
  comments={7}
  isLiked={true}
  isOptimistic={false}
  onLike={handleLike}
  onComment={handleComment}
/>
```

### Modal
Cross-platform modal dialog.

```typescript
<Modal
  visible={isVisible}
  onClose={closeModal}
  title="Confirm Action"
>
  <Text>Modal content</Text>
</Modal>
```

### LoadingSpinner
Loading indicator.

```typescript
<LoadingSpinner size="large" />
```

## Theme

### Using Theme
```typescript
import { useTheme } from '@eco-dms/ui';

function MyComponent() {
  const theme = useTheme();
  
  return (
    <View style={{ backgroundColor: theme.colors.background }}>
      <Text style={{ color: theme.colors.text }}>Hello</Text>
    </View>
  );
}
```

### Theme Structure
```typescript
{
  colors: {
    primary: '#10b981',
    secondary: '#3b82f6',
    background: '#ffffff',
    surface: '#f9fafb',
    text: '#111827',
    textSecondary: '#6b7280',
    border: '#e5e7eb',
    error: '#ef4444',
    success: '#10b981',
    warning: '#f59e0b',
  },
  spacing: {
    xs: 4, sm: 8, md: 16, lg: 24, xl: 32
  },
  borderRadius: {
    sm: 4, md: 8, lg: 12, full: 9999
  },
  typography: {
    h1: { fontSize: 32, fontWeight: '700' },
    h2: { fontSize: 24, fontWeight: '600' },
    h3: { fontSize: 20, fontWeight: '600' },
    body: { fontSize: 16, fontWeight: '400' },
    caption: { fontSize: 14, fontWeight: '400' },
  }
}
```

## Platform Compatibility

All components work on:
- ✅ Web (Vite + React)
- ✅ Mobile (Expo + React Native)
- ✅ Desktop (Electron - future)

## Styling

Components use React Native's StyleSheet for maximum compatibility. Use `style` prop to customize:

```typescript
<Button
  title="Custom"
  style={{ marginTop: 20, backgroundColor: '#custom' }}
/>
```

## Accessibility

All interactive components include proper accessibility props:
- `accessibilityRole`
- `accessibilityLabel`
- `accessibilityState`

## Examples

See `EXAMPLE_WEB_USAGE.tsx` and `EXAMPLE_MOBILE_USAGE.tsx` for complete examples.
