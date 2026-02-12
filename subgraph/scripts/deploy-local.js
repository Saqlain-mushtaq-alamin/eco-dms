/**
 * Deploy subgraph to local Graph Node
 * This script creates and deploys the subgraph to a local Graph Node instance
 */

const { execSync } = require('child_process');

console.log('🚀 Deploying subgraph to local Graph Node...\n');

// Step 1: Create the subgraph (only needed once)
console.log('📝 Step 1: Creating subgraph...');
try {
    execSync(
        'graph create --node http://127.0.0.1:8020 eco-dms',
        { stdio: 'inherit' }
    );
    console.log('✅ Subgraph created\n');
} catch (error) {
    console.log('ℹ️  Subgraph already exists (this is fine)\n');
}

// Step 2: Deploy the subgraph
console.log('📦 Step 2: Deploying subgraph...');
try {
    execSync(
        'graph deploy --version-label v0.0.1 --node http://127.0.0.1:8020 --ipfs http://127.0.0.1:5001 eco-dms',
        { stdio: 'inherit', timeout: 120000 } // 2 minute timeout
    );

    // Verify deployment succeeded
    console.log('\n📡 Verifying deployment...');
    const { execSync: exec } = require('child_process');
    try {
        const result = exec(
            'curl -s -X POST http://127.0.0.1:8100/subgraphs/name/eco-dms -H "Content-Type: application/json" -d "{\\"query\\":\\"{_meta{block{number}}}\\"}"'
        ).toString();

        if (result.includes('"_meta"') || result.includes('block')) {
            console.log('✅ Subgraph deployed successfully!\n');
            console.log('🔗 GraphQL endpoint: http://127.0.0.1:8100/subgraphs/name/eco-dms');
            console.log('🔍 GraphQL Playground: http://127.0.0.1:8100/subgraphs/name/eco-dms/graphql\n');
        } else {
            throw new Error('Deployment verification failed - endpoint not responding');
        }
    } catch (verifyError) {
        console.warn('⚠️  Deployment command completed but verification failed.');
        console.warn('   The subgraph may still be syncing. Check logs with: docker logs graph-node');
        console.warn('   Endpoint: http://127.0.0.1:8100/subgraphs/name/eco-dms/graphql\n');
    }
} catch (error) {
    console.error('\n❌ Deployment failed');
    console.error('Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check Graph Node is running: docker ps | grep graph-node');
    console.error('2. Check Hardhat is running on port 8545');
    console.error('3. View Graph Node logs: docker logs graph-node --tail 50');
    process.exit(1);
}
