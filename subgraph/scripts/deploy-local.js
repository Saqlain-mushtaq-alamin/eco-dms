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
        'graph deploy --node http://127.0.0.1:8020 --ipfs http://127.0.0.1:5001 eco-dms',
        { stdio: 'inherit' }
    );
    console.log('\n✅ Subgraph deployed successfully!\n');
    console.log('🔗 GraphQL endpoint: http://127.0.0.1:8000/subgraphs/name/eco-dms');
    console.log('🔍 GraphQL Playground: http://127.0.0.1:8000/subgraphs/name/eco-dms/graphql\n');
} catch (error) {
    console.error('❌ Deployment failed');
    process.exit(1);
}
