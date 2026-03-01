const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../../');

const config = getDefaultConfig(projectRoot);

// CRITICAL FIX: Block web/node packages that break React Native
config.resolver.blockList = [
    // Block crypto/blockchain packages
    /node_modules\/.*\/ethers/,
    /node_modules\/.*\/@ethersproject/,
    /node_modules\/.*\/hardhat/,
    /node_modules\/.*\/web3/,
    /node_modules\/.*\/@nomicfoundation/,
    // Block workspace packages to prevent web dependencies
    /\/contracts\//,
    /\/subgraph\//,
];

// Only watch mobile directory to avoid bundling workspace packages
config.watchFolders = [projectRoot, workspaceRoot];

config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.sourceExts = ['jsx', 'js', 'ts', 'tsx', 'json'];

module.exports = config;