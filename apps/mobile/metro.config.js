const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add workspace packages to watchFolders
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

config.watchFolders = [workspaceRoot];

// Configure resolution for workspace packages
config.resolver = config.resolver || {};
config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
];

// Handle problematic packages
config.resolver.resolveRequest = (context, moduleName, platform) => {
    // Fix multiformats import issues - redirect cjs to esm
    // Handles both 'multiformats/cjs/...' and importing from cjs path
    if (moduleName.includes('/cjs/') && moduleName.includes('multiformats')) {
        const newModuleName = moduleName.replace(/\/cjs\//g, '/esm/');
        try {
            return context.resolveRequest(context, newModuleName, platform);
        } catch (e) {
            // If ESM resolution fails, try the original
            console.warn(`Failed to resolve ${newModuleName}, falling back to original`);
        }
    }

    // Default resolver
    return context.resolveRequest(context, moduleName, platform);
};

// Enable symlinks for monorepo
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;

// Disable new architecture to prevent TurboModule errors
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
