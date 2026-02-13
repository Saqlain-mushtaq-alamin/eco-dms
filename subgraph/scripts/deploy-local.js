/**
 * Deploy subgraph to local Graph Node
 * This script creates and deploys the subgraph to a local Graph Node instance
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Deploying subgraph to local Graph Node...\n');

// Step 1: Update contract addresses in subgraph.yaml
console.log('📝 Step 1: Updating contract addresses...');
try {
    const contractsPath = path.join(__dirname, '../../apps/web/src/config/contracts.ts');
    const contractsContent = fs.readFileSync(contractsPath, 'utf8');

    // Extract addresses using regex
    const rewardTokenMatch = contractsContent.match(/rewardToken:\s*{\s*address:\s*"(0x[a-fA-F0-9]+)"/);
    const verificationMatch = contractsContent.match(/verification:\s*{\s*address:\s*"(0x[a-fA-F0-9]+)"/);

    if (rewardTokenMatch && verificationMatch) {
        const rewardTokenAddress = rewardTokenMatch[1];
        const verificationAddress = verificationMatch[1];

        console.log('   RewardToken:', rewardTokenAddress);
        console.log('   Verification:', verificationAddress);

        // Update subgraph.yaml
        const yamlPath = path.join(__dirname, '../subgraph.yaml');
        let yamlContent = fs.readFileSync(yamlPath, 'utf8');

        // Replace addresses (find the lines with "address:" under each contract)
        yamlContent = yamlContent.replace(
            /(name: RewardToken[\s\S]*?address:\s*)"0x[a-fA-F0-9]+"/,
            `$1"${rewardTokenAddress}"`
        );
        yamlContent = yamlContent.replace(
            /(name: Verification[\s\S]*?address:\s*)"0x[a-fA-F0-9]+"/,
            `$1"${verificationAddress}"`
        );

        fs.writeFileSync(yamlPath, yamlContent);
        console.log('✅ Addresses updated in subgraph.yaml\n');
    } else {
        throw new Error('Could not parse addresses from contracts.ts');
    }
} catch (error) {
    console.log('⚠️  Could not extract contract addresses from contracts.ts');
    console.log('   Make sure contracts are deployed first!');
    console.log('   You can manually update addresses in subgraph.yaml\n');
}

// Step 2: Create the subgraph (only needed once)
console.log('📝 Step 2: Creating subgraph...');
try {
    execSync(
        'graph create --node http://127.0.0.1:8020 eco-dms',
        { stdio: 'inherit' }
    );
    console.log('✅ Subgraph created\n');
} catch (error) {
    console.log('ℹ️  Subgraph already exists (this is fine)\n');
}

// Step 3: Deploy the subgraph
console.log('📦 Step 3: Deploying subgraph...');
let deploymentSucceeded = false;

try {
    execSync(
        'graph deploy --version-label v0.0.1 --node http://127.0.0.1:8020 --ipfs http://127.0.0.1:5001 eco-dms',
        {
            stdio: 'inherit',
            timeout: 600000, // 10 minute timeout (increased for Windows)
            maxBuffer: 10 * 1024 * 1024, // 10MB buffer
            shell: true // Better Windows compatibility
        }
    );
    deploymentSucceeded = true;
} catch (error) {
    // On Windows, Graph CLI sometimes throws ECONNRESET even when deployment succeeds
    // We'll verify the deployment actually worked before failing
    console.log('\n⚠️  Deployment command returned an error (this is common on Windows)');
    console.log('   Checking if deployment actually succeeded...\n');
}

// Verify deployment (always run this, even if deploy command threw error)
console.log('📡 Verifying deployment...');
try {
    const result = execSync(
        'curl -s -X POST http://127.0.0.1:8100/subgraphs/name/eco-dms -H "Content-Type: application/json" -d "{\\"query\\":\\"{_meta{block{number}}}\\"}"',
        { timeout: 10000 }
    ).toString();

    if (result.includes('"_meta"') || result.includes('block') || result.includes('data')) {
        console.log('✅ Subgraph deployed and verified successfully!\n');
        console.log('🔗 GraphQL endpoint: http://127.0.0.1:8100/subgraphs/name/eco-dms');
        console.log('🔍 GraphQL Playground: http://127.0.0.1:8100/subgraphs/name/eco-dms/graphql\n');
        deploymentSucceeded = true;
    } else {
        throw new Error('GraphQL endpoint not responding with valid data');
    }
} catch (verifyError) {
    if (!deploymentSucceeded) {
        console.error('\n❌ Deployment verification failed');
        console.error('Error:', verifyError.message);
        console.error('\nTroubleshooting:');
        console.error('1. Check Graph Node is running: docker ps');
        console.error('2. Check Hardhat is running on port 8545');
        console.error('3. View Graph Node logs: docker logs graph-node --tail 50');
        console.error('4. Wait a few seconds and verify manually: http://127.0.0.1:8100/subgraphs/name/eco-dms/graphql\n');
        process.exit(1);
    } else {
        console.warn('⚠️  Deployment succeeded but verification query failed (endpoint may still be starting)');
        console.warn('   Check: http://127.0.0.1:8100/subgraphs/name/eco-dms/graphql\n');
    }
}

console.log('🎉 Subgraph deployment complete!\n');
