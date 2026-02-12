/**
 * Direct deployment to Graph Node using JSON-RPC
 * More reliable than graph-cli for local development
 */

const { execSync } = require('child_process');
const fs = require('fs');
const http = require('http');

console.log('🚀 Deploying subgraph directly to Graph Node...\n');

// Step 1: Build subgraph
console.log('🔨 Step 1: Building subgraph...');
try {
    execSync('npx graph build', { stdio: 'inherit' });
    console.log('✅ Build complete\n');
} catch (error) {
    console.error('❌ Build failed');
    process.exit(1);
}

// Step 2: Upload to IPFS
console.log('📦 Step 2: Uploading to IPFS...');
const ipfsHash = execSync(
    'curl -X POST -F file=@build/subgraph.yaml http://127.0.0.1:5001/api/v0/add',
    { encoding: 'utf8' }
);
const hash = JSON.parse(ipfsHash).Hash;
console.log(`✅ Uploaded: ${hash}\n`);

// Step 3: Create subgraph (if not exists)
console.log('📝 Step 3: Creating subgraph...');
try {
    execSync('npx graph create --node http://127.0.0.1:8020 eco-dms', {
        stdio: 'pipe'
    });
    console.log('✅ Subgraph created\n');
} catch (error) {
    console.log('ℹ️  Subgraph already exists\n');
}

// Step 4: Deploy via JSON-RPC with custom timeout
console.log('🚀 Step 4: Deploying subgraph...');
const deployData = JSON.stringify({
    jsonrpc: '2.0',
    method: 'subgraph_deploy',
    params: {
        name: 'eco-dms',
        ipfs_hash: hash
    },
    id: 1
});

const options = {
    hostname: '127.0.0.1',
    port: 8020,
    path: '/',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': deployData.length
    },
    timeout: 180000 // 3 minutes
};

const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('\n📡 Verifying deployment...');

        // Wait a bit for indexing to start
        setTimeout(() => {
            try {
                const result = execSync(
                    'curl -s -X POST http://127.0.0.1:8100/subgraphs/name/eco-dms/graphql -H "Content-Type: application/json" -d "{\\"query\\":\\"{_meta{block{number}}}\\"}"',
                    { encoding: 'utf8', timeout: 10000 }
                );

                if (result.includes('_meta') || result.includes('block')) {
                    console.log('✅ Subgraph deployed and syncing!\n');
                    console.log('🔗 GraphQL endpoint: http://127.0.0.1:8100/subgraphs/name/eco-dms');
                    console.log('🔍 GraphQL Playground: http://127.0.0.1:8100/subgraphs/name/eco-dms/graphql\n');
                    process.exit(0);
                } else {
                    console.log('⚠️  Deployment accepted but endpoint not ready yet.');
                    console.log('   Check progress: docker logs graph-node -f\n');
                    process.exit(0);
                }
            } catch (err) {
                console.log('⚠️  Deployment may still be processing.');
                console.log('   Monitor logs: docker logs graph-node -f\n');
                process.exit(0);
            }
        }, 5000);
    });
});

req.on('error', (e) => {
    console.error(`\n❌ Deployment failed: ${e.message}`);
    console.error('\nTroubleshooting:');
    console.error('1. Check Graph Node: docker ps | grep graph-node');
    console.error('2. Check Hardhat: curl http://127.0.0.1:8545');
    console.error('3. View logs: docker logs graph-node --tail 100\n');
    process.exit(1);
});

req.on('timeout', () => {
    console.error('\n❌ Deployment request timed out');
    console.error('   This usually means the deployment is still processing.');
    console.error('   Check Graph Node logs: docker logs graph-node -f\n');
    req.destroy();
    process.exit(1);
});

req.write(deployData);
req.end();
