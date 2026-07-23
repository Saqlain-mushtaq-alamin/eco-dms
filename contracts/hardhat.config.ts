import { HardhatUserConfig } from "hardhat/config"
import "@nomicfoundation/hardhat-toolbox"
import * as dotenv from "dotenv"
dotenv.config()

const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY
    ? [process.env.DEPLOYER_PRIVATE_KEY]
    : []

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.28",
        settings: {
            optimizer: { enabled: true, runs: 200 },
            viaIR: true,
            evmVersion: "cancun",
        },
    },

    networks: {
        // ── Local ─────────────────────────────────────────────────
        hardhat: {
            hardfork: "cancun",
            chainId: 31337,
        },
        localhost: {
            url: "http://127.0.0.1:8545",
            chainId: 31337,
        },

        // ── Testnets ───────────────────────────────────────────────
        sepolia: {
            url: process.env.SEPOLIA_RPC_URL || `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || ""}`,
            accounts: DEPLOYER_KEY,
            chainId: 11155111,
            gasPrice: "auto",
        },
        baseSepolia: {
            url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
            accounts: DEPLOYER_KEY,
            chainId: 84532,
            gasPrice: "auto",
        },
        polygonAmoy: {
            url: process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
            accounts: DEPLOYER_KEY,
            chainId: 80002,
            gasPrice: "auto",
        },

        // ── Mainnets ───────────────────────────────────────────────
        polygon: {
            url: process.env.POLYGON_RPC_URL || `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || ""}`,
            accounts: DEPLOYER_KEY,
            chainId: 137,
            gasPrice: "auto",
        },
        base: {
            url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
            accounts: DEPLOYER_KEY,
            chainId: 8453,
            gasPrice: "auto",
        },
        mainnet: {
            url: process.env.MAINNET_RPC_URL || `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || ""}`,
            accounts: DEPLOYER_KEY,
            chainId: 1,
            gasPrice: "auto",
        },
    },

    // ── Contract Verification ──────────────────────────────────────
    etherscan: {
        apiKey: {
            mainnet:      process.env.ETHERSCAN_API_KEY    || "",
            sepolia:      process.env.ETHERSCAN_API_KEY    || "",
            polygon:      process.env.POLYGONSCAN_API_KEY  || "",
            polygonAmoy:  process.env.POLYGONSCAN_API_KEY  || "",
            base:         process.env.BASESCAN_API_KEY     || "",
            baseSepolia:  process.env.BASESCAN_API_KEY     || "",
        },
        customChains: [
            {
                network: "baseSepolia",
                chainId: 84532,
                urls: {
                    apiURL:  "https://api-sepolia.basescan.org/api",
                    browserURL: "https://sepolia.basescan.org",
                },
            },
            {
                network: "polygonAmoy",
                chainId: 80002,
                urls: {
                    apiURL:  "https://api-amoy.polygonscan.com/api",
                    browserURL: "https://amoy.polygonscan.com",
                },
            },
        ],
    },

    // ── Gas Reporter ────────────────────────────────────────────────
    gasReporter: {
        enabled: process.env.REPORT_GAS === "true",
        currency: "USD",
        coinmarketcap: process.env.COINMARKETCAP_API_KEY || "",
        outputFile: process.env.GAS_REPORT_FILE,
        noColors: !!process.env.GAS_REPORT_FILE,
    },

    // ── Path config ─────────────────────────────────────────────────
    paths: {
        sources:   "./contracts",
        tests:     "./test",
        cache:     "./cache",
        artifacts: "./artifacts",
    },

    // ── Typechain ────────────────────────────────────────────────────
    typechain: {
        outDir: "typechain-types",
        target: "ethers-v6",
    },
}

export default config
