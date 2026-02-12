/**
 * Prepare subgraph for deployment:
 * 1. Copy contract ABIs to subgraph/abis
 * 2. Update subgraph.yaml with deployed contract addresses
 */

import { mkdirSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

console.log('📝 Preparing subgraph...\n')

// ==================
// Step 1: Copy ABIs
// ==================
const destDir = resolve(__dirname, '../abis')
mkdirSync(destDir, { recursive: true })

const abis = [
    {
        name: 'ProfileRegistry',
        path: '../../contracts/artifacts/contracts/ProfileRegistry.sol/ProfileRegistry.json'
    },
    {
        name: 'RewardToken',
        path: '../../contracts/artifacts/contracts/RewardToken.sol/RewardToken.json'
    },
    {
        name: 'Verification',
        path: '../../contracts/artifacts/contracts/Verification.sol/Verification.json'
    }
]

console.log('📦 Step 1: Copying ABIs...')
for (const abi of abis) {
    const artifact = resolve(__dirname, abi.path)
    const dest = resolve(destDir, `${abi.name}.json`)

    if (!existsSync(artifact)) {
        console.warn(`⚠️  ${abi.name} artifact not found, skipping...`)
        continue
    }

    copyFileSync(artifact, dest)
    console.log(`✅ Copied ${abi.name}.json`)
}

// ==================
// Step 2: Update addresses in subgraph.yaml
// ==================
console.log('\n📝 Step 2: Updating contract addresses...')

const contractsConfigPath = resolve(__dirname, '../../apps/web/src/config/contracts.ts')
const subgraphYamlPath = resolve(__dirname, '../subgraph.yaml')

if (!existsSync(contractsConfigPath)) {
    console.warn('⚠️  contracts.ts not found, skipping address update')
    console.log('   You can manually update addresses in subgraph.yaml later\n')
    process.exit(0)
}

// Read contracts.ts to extract addresses
const contractsTs = readFileSync(contractsConfigPath, 'utf8')

// Extract RewardToken address
const rewardTokenMatch = contractsTs.match(/REWARD_TOKEN_ADDRESS\s*=\s*['"]([^'"]+)['"]/)
const rewardTokenAddress = rewardTokenMatch ? rewardTokenMatch[1] : null

// Extract Verification address
const verificationMatch = contractsTs.match(/VERIFICATION_ADDRESS\s*=\s*['"]([^'"]+)['"]/)
const verificationAddress = verificationMatch ? verificationMatch[1] : null

if (!rewardTokenAddress || !verificationAddress) {
    console.warn('⚠️  Could not extract contract addresses from contracts.ts')
    console.log('   Make sure contracts are deployed first!')
    console.log('   You can manually update addresses in subgraph.yaml\n')
    process.exit(0)
}

console.log(`✅ RewardToken: ${rewardTokenAddress}`)
console.log(`✅ Verification: ${verificationAddress}`)

// Read and update subgraph.yaml
let yaml = readFileSync(subgraphYamlPath, 'utf8')

// Replace RewardToken address
yaml = yaml.replace(
    /address: "0x5FbDB2315678afecb367f032d93F642f64180aa3"/,
    `address: "${rewardTokenAddress}"`
)

// Replace Verification address
yaml = yaml.replace(
    /address: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"/,
    `address: "${verificationAddress}"`
)

writeFileSync(subgraphYamlPath, yaml)

console.log('✅ Updated subgraph.yaml with contract addresses\n')
console.log('🎉 Subgraph prepared successfully!')
console.log('📦 Next: pnpm graph:codegen && pnpm graph:build\n')
