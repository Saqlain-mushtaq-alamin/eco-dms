/**
 * Deploy Script: EcoDMS — All Contracts (Production-Grade)
 *
 * Features:
 *   - Deploys all 5 contracts in dependency order
 *   - Wires minter roles automatically
 *   - Writes deployment addresses to:
 *       backend/.env.contracts   (backend worker/API)
 *       apps/web/.env.local      (Vite frontend)
 *       deployments/<network>.json (permanent audit log)
 *   - Optionally verifies contracts on Etherscan/Polygonscan
 *   - Resumes partial deployments (skips already-deployed contracts)
 *
 * Usage:
 *   npx hardhat run scripts/deploy-all.ts --network localhost
 *   npx hardhat run scripts/deploy-all.ts --network polygon
 *   npx hardhat run scripts/deploy-all.ts --network base
 *
 * Environment:
 *   DEPLOYER_PRIVATE_KEY   — required for live networks
 *   ETHERSCAN_API_KEY      — required for contract verification
 *   RESUME_FROM_JSON       — path to previous deployment JSON to resume from
 */
import { ethers, run, network } from "hardhat"
import * as fs from "fs"
import * as path from "path"

const REPO_ROOT = path.resolve(__dirname, "../..")

// ─── Resume support ─────────────────────────────────────────────────────────
function loadExisting(): Record<string, string> {
    const resumePath = process.env.RESUME_FROM_JSON
    if (resumePath && fs.existsSync(resumePath)) {
        console.log("♻️  Resuming from:", resumePath)
        return JSON.parse(fs.readFileSync(resumePath, "utf8"))
    }
    const defaultPath = path.join(__dirname, "../deployments", `${network.name}.json`)
    if (fs.existsSync(defaultPath)) {
        const data = JSON.parse(fs.readFileSync(defaultPath, "utf8"))
        console.log("♻️  Found existing deployment for", network.name)
        return data.contracts ?? {}
    }
    return {}
}

// ─── Verification helper ─────────────────────────────────────────────────────
async function verifyContract(address: string, constructorArgs: any[]) {
    if (!process.env.ETHERSCAN_API_KEY) return
    if (network.name === "localhost" || network.name === "hardhat") return
    console.log("   🔍 Verifying on Etherscan/Polygonscan…")
    try {
        await run("verify:verify", { address, constructorArguments: constructorArgs })
        console.log("   ✅ Verified")
    } catch (e: any) {
        if (e.message?.includes("Already Verified")) {
            console.log("   ℹ️  Already verified")
        } else {
            console.warn("   ⚠️  Verification failed:", e.message)
        }
    }
}

// ─── .env writer ────────────────────────────────────────────────────────────
function writeEnvFile(filePath: string, vars: Record<string, string>) {
    let existing = ""
    if (fs.existsSync(filePath)) {
        existing = fs.readFileSync(filePath, "utf8")
    }

    const lines = existing.split("\n").filter(Boolean)
    const updated = new Map<string, string>()

    for (const line of lines) {
        const [k, ...rest] = line.split("=")
        if (k) updated.set(k.trim(), rest.join("="))
    }
    for (const [k, v] of Object.entries(vars)) {
        updated.set(k, v)
    }

    const content = Array.from(updated.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join("\n") + "\n"

    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, content)
    console.log("   📝 Wrote", path.relative(REPO_ROOT, filePath))
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
    const [deployer] = await ethers.getSigners()
    const networkName = network.name
    const existing = loadExisting()

    console.log("\n🌿 EcoDMS Full Deployment")
    console.log("   Network:", networkName)
    console.log("   Deployer:", deployer.address)
    const bal = await ethers.provider.getBalance(deployer.address)
    console.log("   Balance:", ethers.formatEther(bal), "ETH\n")

    if (parseFloat(ethers.formatEther(bal)) < 0.01 && networkName !== "localhost" && networkName !== "hardhat") {
        throw new Error("Insufficient deployer balance (< 0.01 ETH)")
    }

    const deployed: Record<string, string> = { ...existing }

    // ── 1. RewardToken ──────────────────────────────────────────────────────
    let rewardTokenAddr = deployed["REWARD_TOKEN_ADDRESS"]
    if (!rewardTokenAddr) {
        console.log("1️⃣  Deploying RewardToken…")
        const RewardToken = await ethers.getContractFactory("RewardToken")
        const rt = await RewardToken.deploy(deployer.address)
        await rt.waitForDeployment()
        rewardTokenAddr = await rt.getAddress()
        console.log("   ✅ RewardToken:", rewardTokenAddr)
        await verifyContract(rewardTokenAddr, [deployer.address])
        deployed["REWARD_TOKEN_ADDRESS"] = rewardTokenAddr
    } else {
        console.log("1️⃣  RewardToken already deployed:", rewardTokenAddr)
    }

    const rewardToken = await ethers.getContractAt("RewardToken", rewardTokenAddr)

    // ── 2. DynamicVerification ──────────────────────────────────────────────
    let dynVerAddr = deployed["DYNAMIC_VERIFICATION_ADDRESS"]
    if (!dynVerAddr) {
        console.log("\n2️⃣  Deploying DynamicVerification…")
        const DV = await ethers.getContractFactory("DynamicVerification")
        const dv = await DV.deploy(rewardTokenAddr, deployer.address)
        await dv.waitForDeployment()
        dynVerAddr = await dv.getAddress()
        console.log("   ✅ DynamicVerification:", dynVerAddr)
        console.log("   🔑 Granting minter role…")
        await (await rewardToken.addMinter(dynVerAddr)).wait()
        console.log("   ✅ Minter role granted")
        await verifyContract(dynVerAddr, [rewardTokenAddr, deployer.address])
        deployed["DYNAMIC_VERIFICATION_ADDRESS"] = dynVerAddr
    } else {
        console.log("\n2️⃣  DynamicVerification already deployed:", dynVerAddr)
    }

    // ── 3. EcoBoost ─────────────────────────────────────────────────────────
    let ecoBoostAddr = deployed["ECOBOOST_ADDRESS"]
    if (!ecoBoostAddr) {
        console.log("\n3️⃣  Deploying EcoBoost…")
        const EcoBoost = await ethers.getContractFactory("EcoBoost")
        const eb = await EcoBoost.deploy(rewardTokenAddr, deployer.address)
        await eb.waitForDeployment()
        ecoBoostAddr = await eb.getAddress()
        console.log("   ✅ EcoBoost:", ecoBoostAddr)
        await verifyContract(ecoBoostAddr, [rewardTokenAddr, deployer.address])
        deployed["ECOBOOST_ADDRESS"] = ecoBoostAddr
    } else {
        console.log("\n3️⃣  EcoBoost already deployed:", ecoBoostAddr)
    }

    // ── 4. EcoCredential ────────────────────────────────────────────────────
    let ecoCredAddr = deployed["ECOCREDENTIAL_ADDRESS"]
    if (!ecoCredAddr) {
        console.log("\n4️⃣  Deploying EcoCredential…")
        const EcoCredential = await ethers.getContractFactory("EcoCredential")
        const ec = await EcoCredential.deploy(rewardTokenAddr, deployer.address)
        await ec.waitForDeployment()
        ecoCredAddr = await ec.getAddress()
        console.log("   ✅ EcoCredential:", ecoCredAddr)
        await verifyContract(ecoCredAddr, [rewardTokenAddr, deployer.address])
        deployed["ECOCREDENTIAL_ADDRESS"] = ecoCredAddr
    } else {
        console.log("\n4️⃣  EcoCredential already deployed:", ecoCredAddr)
    }

    // ── 5. EcoDAO ────────────────────────────────────────────────────────────
    let ecoDAOAddr = deployed["ECODAO_ADDRESS"]
    if (!ecoDAOAddr) {
        console.log("\n5️⃣  Deploying EcoDAO…")
        const EcoDAO = await ethers.getContractFactory("EcoDAO")
        const dao = await EcoDAO.deploy(rewardTokenAddr, deployer.address)
        await dao.waitForDeployment()
        ecoDAOAddr = await dao.getAddress()
        console.log("   ✅ EcoDAO:", ecoDAOAddr)
        await verifyContract(ecoDAOAddr, [rewardTokenAddr, deployer.address])
        deployed["ECODAO_ADDRESS"] = ecoDAOAddr
    } else {
        console.log("\n5️⃣  EcoDAO already deployed:", ecoDAOAddr)
    }

    // ── Write env files ──────────────────────────────────────────────────────
    console.log("\n📝 Writing contract addresses to env files…")

    const backendVars: Record<string, string> = {
        REWARD_TOKEN_ADDRESS:          rewardTokenAddr!,
        DYNAMIC_VERIFICATION_ADDRESS:  dynVerAddr!,
        ECOBOOST_ADDRESS:              ecoBoostAddr!,
        ECOCREDENTIAL_ADDRESS:         ecoCredAddr!,
        ECODAO_ADDRESS:                ecoDAOAddr!,
    }
    writeEnvFile(path.join(REPO_ROOT, "backend/.env.contracts"), backendVars)

    const frontendVars: Record<string, string> = {
        VITE_REWARD_TOKEN_ADDRESS:          rewardTokenAddr!,
        VITE_DYNAMIC_VERIFICATION_ADDRESS:  dynVerAddr!,
        VITE_ECOBOOST_ADDRESS:              ecoBoostAddr!,
        VITE_ECOCREDENTIAL_ADDRESS:         ecoCredAddr!,
        VITE_ECODAO_ADDRESS:                ecoDAOAddr!,
        VITE_NETWORK:                       networkName,
    }
    writeEnvFile(path.join(REPO_ROOT, "apps/web/.env.local"), frontendVars)

    // ── Save deployment JSON ─────────────────────────────────────────────────
    const deploymentsDir = path.join(__dirname, "../deployments")
    fs.mkdirSync(deploymentsDir, { recursive: true })
    const deploymentRecord = {
        network: networkName,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: deployed,
    }
    const jsonPath = path.join(deploymentsDir, `${networkName}.json`)
    fs.writeFileSync(jsonPath, JSON.stringify(deploymentRecord, null, 2))
    console.log("   📄 Deployment log:", path.relative(REPO_ROOT, jsonPath))

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log("\n═══════════════════════════════════════════════════════════")
    console.log("🌿 EcoDMS Deployment Complete —", networkName.toUpperCase())
    console.log("═══════════════════════════════════════════════════════════")
    console.log("  RewardToken:           ", rewardTokenAddr)
    console.log("  DynamicVerification:   ", dynVerAddr)
    console.log("  EcoBoost:              ", ecoBoostAddr)
    console.log("  EcoCredential:         ", ecoCredAddr)
    console.log("  EcoDAO:                ", ecoDAOAddr)
    console.log("═══════════════════════════════════════════════════════════")
    console.log("\n✅ Next steps:")
    console.log("  1. Copy backend/.env.contracts values into backend/.env")
    console.log("  2. Set VERIFIER_PRIVATE_KEY in backend/.env (verifier EOA)")
    console.log("  3. Run: cd backend && celery -A ml.celery_app worker -l info")
    console.log("  4. Run: cd apps/web && npm run dev")
    console.log("  5. Post a test eco action and watch the full pipeline run\n")

    return deploymentRecord
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error("\n❌ Deployment failed:", e)
        process.exit(1)
    })
