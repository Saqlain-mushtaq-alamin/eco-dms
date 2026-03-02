const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Enhanced configuration for stable iOS bundling
config.resolver = {
    ...config.resolver,
    // Ensure consistent module resolution
    sourceExts: ['js', 'jsx', 'json', 'ts', 'tsx'],
    // Explicitly define node_modules location
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
    // Ensure React is resolved correctly
    resolverMainFields: ['react-native', 'browser', 'main'],
};

// Improve transformer stability
config.transformer = {
    ...config.transformer,
    // Ensure consistent bundling across platforms
    minifierPath: require.resolve('metro-minify-terser'),
    minifierConfig: {
        // Keep class and function names for better debugging
        keep_classnames: true,
        keep_fnames: true,
    },
    // Ensure Babel processes all files consistently
    enableBabelRCLookup: true,
    enableBabelRuntime: true,
};

// Always reset cache to avoid stale bundles
config.resetCache = true;

module.exports = config;
