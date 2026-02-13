import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    console.log("🚀 Auto-deploying Verification System...\n");

    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

    // 1. Deploy RewardToken
    console.log("📦 Deploying RewardToken...");
    const RewardTokenFactory = await ethers.getContractFactory("RewardToken");
    const rewardToken = await RewardTokenFactory.deploy(deployer.address);
    await rewardToken.waitForDeployment();
    const rewardTokenAddress = await rewardToken.getAddress();
    console.log("✅ RewardToken:", rewardTokenAddress);

    // 2. Deploy Verification
    console.log("📦 Deploying Verification...");
    const VerificationFactory = await ethers.getContractFactory("Verification");
    const verification = await VerificationFactory.deploy(
        rewardTokenAddress,
        deployer.address
    );
    await verification.waitForDeployment();
    const verificationAddress = await verification.getAddress();
    console.log("✅ Verification:", verificationAddress);

    // 3. Add Verification as minter
    console.log("🔑 Adding Verification as minter...");
    const addMinterTx = await rewardToken.addMinter(verificationAddress);
    await addMinterTx.wait();
    console.log("✅ Minter added");

    // 4. Add deployer as verifier (for testing)
    console.log("🔑 Adding deployer as verifier (for testing)...");
    const addVerifierTx = await verification.addVerifier(deployer.address);
    await addVerifierTx.wait();
    console.log("✅ Verifier added");

    // 5. Save addresses to .env file for frontend
    const envPath = path.join(__dirname, "../../apps/web/.env.local");
    const envContent = `# Auto-generated contract addresses
VITE_REWARD_TOKEN_ADDRESS=${rewardTokenAddress}
VITE_VERIFICATION_ADDRESS=${verificationAddress}
VITE_CHAIN_ID=31337

# API endpoints
VITE_BACKEND_URL=http://127.0.0.1:8000
VITE_GRAPH_URL=http://127.0.0.1:8100/subgraphs/name/eco-dms
VITE_IPFS_GATEWAY=https://ipfs.io/ipfs/
`;

    try {
        fs.writeFileSync(envPath, envContent);
        console.log("\n✅ Addresses saved to apps/web/.env.local");
    } catch (err) {
        console.log("\n⚠️  Could not save .env.local (continuing anyway)");
    }

    // 6. Update frontend config
    const configPath = path.join(__dirname, "../../apps/web/src/config/contracts.ts");
    const configContent = `// Contract addresses (auto-generated)
export const CONTRACTS = {
  rewardToken: {
    address: "${rewardTokenAddress}",
  },
  verification: {
    address: "${verificationAddress}",
  },
};

export const LOCAL_CHAIN_ID = 31337; // Hardhat
export const REWARD_TOKEN_SYMBOL = "ECO";
export const REWARD_TOKEN_DECIMALS = 18;
export const REWARD_TOKEN_ICON = "https://em-content.zobj.net/source/apple/391/seedling_1f331.png";
`;

    try {
        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        fs.writeFileSync(configPath, configContent);
        console.log("✅ Frontend config updated");
    } catch (err) {
        console.log("⚠️  Could not update frontend config (continuing anyway)");
    }

    console.log("\n" + "=".repeat(60));
    console.log("🎉 Deployment Complete!");
    console.log("=".repeat(60));
    console.log("\nContract Addresses:");
    console.log("  RewardToken:  ", rewardTokenAddress);
    console.log("  Verification: ", verificationAddress);
    console.log("\n✨ Ready for development!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
