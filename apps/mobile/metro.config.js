const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project and workspace directories
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../../');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [workspaceRoot];

// 2. Let Metro know where to resolve packages and which files to support
config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Support shared packages
config.resolver.extraNodeModules = {
    '@eco-dms/ui': path.resolve(workspaceRoot, 'packages/ui'),
    '@eco-dms/hooks': path.resolve(workspaceRoot, 'packages/hooks'),
    '@eco-dms/services': path.resolve(workspaceRoot, 'packages/services'),
};

// 4. Support platform extensions for React Native Web compatibility
// Also add GraphQL file extensions
config.resolver.sourceExts = ['jsx', 'js', 'ts', 'tsx', 'json', 'graphql', 'gql'];

// 5. Configure server to be accessible on the network
config.server = {
    ...config.server,
    enhanceMiddleware: (middleware) => {
        return middleware;
    },
};

module.exports = config;