# Eco DMS Mobile App 🌱

Cross-platform mobile app for Eco DMS built with React Native and Expo.

## Features

✅ **Same Backend as Web**
- REST API integration (`http://127.0.0.1:8000`)
- GraphQL via The Graph
- SIWE authentication (placeholder)
- Identical API calls and data structures

✅ **Screens**
- **SignIn**: Wallet connection
- **CreateProfile**: Create/edit profile
- **Feed**: View posts with pull-to-refresh
- **Profile**: View your profile and posts
- **Dashboard**: Stats and activity
- **VisitProfile**: View other users

✅ **Cross-Platform**
- iOS & Android support via Expo

## Quick Start

```bash
cd apps/mobile
pnpm install
pnpm start
```

Scan QR code with Expo Go app (iOS) or camera (Android).

## Configuration

For physical device testing, update API URLs to your computer's local IP:

**src/config/api.ts** and **src/config/apollo.ts**:
```typescript
const API_BASE = 'http://192.168.1.XXX:8000';  // Replace with your IP
const GRAPH_URL = 'http://192.168.1.XXX:8100/subgraphs/name/eco-dms';
```

Find your IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)

## Current Status

✅ Navigation, screens, API integration complete
⚠️ WalletConnect integration needed for authentication
⚠️ Image picker/camera not yet implemented

**For full features, use the web version at http://localhost:5173**

## Architecture

```
src/
├── config/       # API & GraphQL setup
├── navigation/   # React Navigation
├── screens/      # All app screens
├── types/        # TypeScript types
└── app.tsx       # Root component
```

## Learn More

- [Expo documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- Main project README for backend/web setup
