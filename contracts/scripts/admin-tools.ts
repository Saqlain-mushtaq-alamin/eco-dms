import { ethers } from "hardhat";
import * as readline from "readline";

// Helper to get user input
function question(query: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question(query, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

async function main() {
    console.log("🔧 EcoDMS Verification System - Admin Tools\n");

    const [signer] = await ethers.getSigners();
    console.log("👤 Using account:", signer.address);
    console.log("💰 Balance:", ethers.formatEther(await ethers.provider.getBalance(signer.address)), "ETH\n");

    // Get contract addresses
    const rewardTokenAddress = await question("Enter RewardToken address: ");
    const verificationAddress = await question("Enter Verification address: ");

    if (!ethers.isAddress(rewardTokenAddress) || !ethers.isAddress(verificationAddress)) {
        console.error("❌ Invalid address format");
        return;
    }

    // Connect to contracts
    const rewardToken = await ethers.getContractAt("RewardToken", rewardTokenAddress);
    const verification = await ethers.getContractAt("Verification", verificationAddress);

    console.log("\n✅ Connected to contracts\n");

    // Menu
    while (true) {
        console.log("\n" + "=".repeat(60));
        console.log("📋 Admin Menu:");
        console.log("=".repeat(60));
        console.log("1. Add Verifier (ML Backend)");
        console.log("2. Remove Verifier");
        console.log("3. Check Verifier Status");
        console.log("4. Check Token Balance");
        console.log("5. Check Post Reward Status");
        console.log("6. Check Wallet Cooldown");
        console.log("7. Get Contract Info");
        console.log("8. Exit");
        console.log("=".repeat(60));

        const choice = await question("\nSelect option (1-8): ");

        switch (choice) {
            case "1": {
                const verifierAddress = await question("Enter verifier address to add: ");
                if (!ethers.isAddress(verifierAddress)) {
                    console.log("❌ Invalid address");
                    break;
                }
                console.log("⏳ Adding verifier...");
                const tx = await verification.addVerifier(verifierAddress);
                await tx.wait();
                console.log("✅ Verifier added successfully");
                break;
            }

            case "2": {
                const verifierAddress = await question("Enter verifier address to remove: ");
                if (!ethers.isAddress(verifierAddress)) {
                    console.log("❌ Invalid address");
                    break;
                }
                console.log("⏳ Removing verifier...");
                const tx = await verification.removeVerifier(verifierAddress);
                await tx.wait();
                console.log("✅ Verifier removed successfully");
                break;
            }

            case "3": {
                const verifierAddress = await question("Enter verifier address to check: ");
                if (!ethers.isAddress(verifierAddress)) {
                    console.log("❌ Invalid address");
                    break;
                }
                const isAuthorized = await verification.isAuthorizedVerifier(verifierAddress);
                console.log(`📊 Status: ${isAuthorized ? "✅ Authorized" : "❌ Not Authorized"}`);
                break;
            }

            case "4": {
                const walletAddress = await question("Enter wallet address: ");
                if (!ethers.isAddress(walletAddress)) {
                    console.log("❌ Invalid address");
                    break;
                }
                const balance = await rewardToken.balanceOf(walletAddress);
                console.log(`💰 Balance: ${ethers.formatEther(balance)} ECO tokens`);
                break;
            }

            case "5": {
                const postCid = await question("Enter post CID: ");
                const isRewarded = await verification.isPostRewarded(postCid);
                console.log(`📊 Status: ${isRewarded ? "✅ Already Rewarded" : "⏳ Not Yet Rewarded"}`);
                break;
            }

            case "6": {
                const walletAddress = await question("Enter wallet address: ");
                if (!ethers.isAddress(walletAddress)) {
                    console.log("❌ Invalid address");
                    break;
                }
                const remaining = await verification.getCooldownRemaining(walletAddress);
                if (remaining === 0n) {
                    console.log("✅ Wallet is ready to receive rewards");
                } else {
                    const hours = Number(remaining) / 3600;
                    console.log(`⏳ Cooldown remaining: ${hours.toFixed(2)} hours`);
                }
                break;
            }

            case "7": {
                console.log("\n📊 Contract Information:");
                console.log("=".repeat(60));
                console.log("RewardToken:");
                console.log("  - Address:", rewardTokenAddress);
                console.log("  - Name:", await rewardToken.name());
                console.log("  - Symbol:", await rewardToken.symbol());
                console.log("  - Total Supply:", ethers.formatEther(await rewardToken.totalSupply()), "ECO");
                console.log("\nVerification:");
                console.log("  - Address:", verificationAddress);
                console.log("  - Reward Amount:", ethers.formatEther(await verification.REWARD_AMOUNT()), "ECO");
                console.log("  - Min Confidence:", (await verification.MIN_CONFIDENCE()).toString() + "%");
                console.log("  - Cooldown Period:", Number(await verification.COOLDOWN_PERIOD()) / 3600, "hours");
                console.log("  - Is Minter:", await rewardToken.isMinter(verificationAddress) ? "✅ Yes" : "❌ No");
                console.log("=".repeat(60));
                break;
            }

            case "8":
                console.log("\n👋 Goodbye!");
                return;

            default:
                console.log("❌ Invalid option");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    });
