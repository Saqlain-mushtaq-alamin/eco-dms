import { ethers } from "hardhat";

async function main() {
    console.log("🚀 Starting deployment of EcoDMS Verification System...\n");

    const [deployer] = await ethers.getSigners();
    console.log("📝 Deploying contracts with account:", deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

    // 1. Deploy RewardToken
    console.log("📦 Deploying RewardToken...");
    const RewardTokenFactory = await ethers.getContractFactory("RewardToken");
    const rewardToken = await RewardTokenFactory.deploy(deployer.address);
    await rewardToken.waitForDeployment();
    const rewardTokenAddress = await rewardToken.getAddress();
    console.log("✅ RewardToken deployed to:", rewardTokenAddress);
    console.log("   - Name:", await rewardToken.name());
    console.log("   - Symbol:", await rewardToken.symbol());
    console.log("   - Owner:", await rewardToken.owner(), "\n");

    // 2. Deploy Verification
    console.log("📦 Deploying Verification...");
    const VerificationFactory = await ethers.getContractFactory("Verification");
    const verification = await VerificationFactory.deploy(
        rewardTokenAddress,
        deployer.address
    );
    await verification.waitForDeployment();
    const verificationAddress = await verification.getAddress();
    console.log("✅ Verification deployed to:", verificationAddress);
    console.log("   - Reward Token:", await verification.rewardToken());
    console.log("   - Owner:", await verification.owner());
    console.log("   - Reward Amount:", ethers.formatEther(await verification.REWARD_AMOUNT()), "ECO");
    console.log("   - Min Confidence:", (await verification.MIN_CONFIDENCE()).toString());
    console.log("   - Cooldown Period:", (await verification.COOLDOWN_PERIOD()).toString(), "seconds\n");

    // 3. Add Verification contract as minter
    console.log("🔑 Adding Verification contract as authorized minter...");
    const addMinterTx = await rewardToken.addMinter(verificationAddress);
    await addMinterTx.wait();
    console.log("✅ Verification contract authorized to mint tokens\n");

    // 4. Optional: Add a verifier address (ML backend)
    // Uncomment and set your ML backend address here
    /*
    const ML_BACKEND_ADDRESS = "0x..."; // Replace with your ML backend address
    console.log("🔑 Adding ML backend as authorized verifier...");
    const addVerifierTx = await verification.addVerifier(ML_BACKEND_ADDRESS);
    await addVerifierTx.wait();
    console.log("✅ ML backend authorized:", ML_BACKEND_ADDRESS, "\n");
    */

    // 5. Summary
    console.log("=".repeat(60));
    console.log("🎉 Deployment Complete!");
    console.log("=".repeat(60));
    console.log("\n📋 Contract Addresses:");
    console.log("   RewardToken:    ", rewardTokenAddress);
    console.log("   Verification:   ", verificationAddress);
    console.log("\n📝 Next Steps:");
    console.log("   1. Verify contracts on block explorer");
    console.log("   2. Add ML backend address as authorized verifier:");
    console.log("      verification.addVerifier(ML_BACKEND_ADDRESS)");
    console.log("   3. Update frontend with contract addresses");
    console.log("   4. Update subgraph configuration");
    console.log("\n💡 Important:");
    console.log("   - Save these addresses in your .env file");
    console.log("   - Only authorized verifiers can sign verdicts");
    console.log("   - Users receive 5 ECO tokens per verified eco-post");
    console.log("   - 24-hour cooldown period per wallet");
    console.log("=".repeat(60));

    // Return addresses for programmatic use
    return {
        rewardToken: rewardTokenAddress,
        verification: verificationAddress,
    };
}

// Execute deployment
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
