/**
 * Deploy Script: EcoDMS Phase 1 Contracts
 *
 * Deployment order:
 *   1. RewardToken (upgrade — adds burn mechanics)
 *   2. DynamicVerification (replaces flat-rate Verification.sol)
 *   3. EcoBoost (post visibility boosting)
 *   4. EcoCredential (soulbound NFT credentials)
 *   5. EcoDAO (quadratic voting governance)
 *
 * Usage:
 *   npx hardhat run scripts/deploy-phase1.ts --network localhost
 *   npx hardhat run scripts/deploy-phase1.ts --network polygon
 */
import { ethers } from "hardhat"

async function main() {
    const [deployer] = await ethers.getSigners()
    console.log("🚀 Deploying EcoDMS Phase 1 contracts...")
    console.log("   Deployer:", deployer.address)
    console.log("   Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n")

    // ── 1. RewardToken (upgraded with burn mechanics) ──────────────────────
    console.log("1️⃣  Deploying RewardToken (v2 — with burn)...")
    const RewardToken = await ethers.getContractFactory("RewardToken")
    const rewardToken = await RewardToken.deploy(deployer.address)
    await rewardToken.waitForDeployment()
    const rewardTokenAddress = await rewardToken.getAddress()
    console.log("   ✅ RewardToken deployed at:", rewardTokenAddress)

    // ── 2. DynamicVerification ─────────────────────────────────────────────
    console.log("\n2️⃣  Deploying DynamicVerification...")
    const DynamicVerification = await ethers.getContractFactory("DynamicVerification")
    const dynamicVerification = await DynamicVerification.deploy(rewardTokenAddress, deployer.address)
    await dynamicVerification.waitForDeployment()
    const dynamicVerificationAddress = await dynamicVerification.getAddress()
    console.log("   ✅ DynamicVerification deployed at:", dynamicVerificationAddress)

    // Grant DynamicVerification minting rights on RewardToken
    console.log("   🔑 Granting DynamicVerification minting rights...")
    await rewardToken.addMinter(dynamicVerificationAddress)
    console.log("   ✅ Minter role granted to DynamicVerification")

    // ── 3. EcoBoost ────────────────────────────────────────────────────────
    console.log("\n3️⃣  Deploying EcoBoost...")
    const EcoBoost = await ethers.getContractFactory("EcoBoost")
    const ecoBoost = await EcoBoost.deploy(rewardTokenAddress, deployer.address)
    await ecoBoost.waitForDeployment()
    const ecoBoostAddress = await ecoBoost.getAddress()
    console.log("   ✅ EcoBoost deployed at:", ecoBoostAddress)

    // ── 4. EcoCredential ───────────────────────────────────────────────────
    console.log("\n4️⃣  Deploying EcoCredential...")
    const EcoCredential = await ethers.getContractFactory("EcoCredential")
    const ecoCredential = await EcoCredential.deploy(rewardTokenAddress, deployer.address)
    await ecoCredential.waitForDeployment()
    const ecoCredentialAddress = await ecoCredential.getAddress()
    console.log("   ✅ EcoCredential deployed at:", ecoCredentialAddress)

    // ── 5. EcoDAO ──────────────────────────────────────────────────────────
    console.log("\n5️⃣  Deploying EcoDAO...")
    const EcoDAO = await ethers.getContractFactory("EcoDAO")
    const ecoDAO = await EcoDAO.deploy(rewardTokenAddress, deployer.address)
    await ecoDAO.waitForDeployment()
    const ecoDAOAddress = await ecoDAO.getAddress()
    console.log("   ✅ EcoDAO deployed at:", ecoDAOAddress)

    // ── Summary ────────────────────────────────────────────────────────────
    console.log("\n═══════════════════════════════════════════════════════════")
    console.log("📋 EcoDMS Phase 1 Deployment Summary")
    console.log("═══════════════════════════════════════════════════════════")
    console.log("RewardToken (v2):       ", rewardTokenAddress)
    console.log("DynamicVerification:    ", dynamicVerificationAddress)
    console.log("EcoBoost:               ", ecoBoostAddress)
    console.log("EcoCredential (ECOCRED):", ecoCredentialAddress)
    console.log("EcoDAO:                 ", ecoDAOAddress)
    console.log("═══════════════════════════════════════════════════════════")
    console.log("\n📝 Next steps:")
    console.log("  1. Update backend .env with new contract addresses")
    console.log("  2. Add DynamicVerification as authorized verifier in backend")
    console.log("  3. Update frontend contract configs")
    console.log("  4. Test on local network before mainnet/L2 deployment")
    console.log("  5. Consider L2 deployment (Polygon/Base) for cheaper gas")

    // Return addresses for programmatic use
    return {
        rewardToken: rewardTokenAddress,
        dynamicVerification: dynamicVerificationAddress,
        ecoBoost: ecoBoostAddress,
        ecoCredential: ecoCredentialAddress,
        ecoDAO: ecoDAOAddress,
    }
}

main()
    .then((addresses) => {
        console.log("\n✅ All contracts deployed successfully!")
        process.exit(0)
    })
    .catch((error) => {
        console.error("\n❌ Deployment failed:", error)
        process.exit(1)
    })
