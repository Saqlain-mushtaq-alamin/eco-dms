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

// 3. Support GraphQL file extensions (removed workspace package mappings to avoid ethers bundling)
config.resolver.sourceExts = ['jsx', 'js', 'ts', 'tsx', 'json', 'graphql', 'gql'];

// 4. Configure server to be accessible on the network
config.server = {
    ...config.server,
    enhanceMiddleware: (middleware) => {
        return middleware;
    },
};

module.exports = config;