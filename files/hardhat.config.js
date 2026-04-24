require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PK = process.env.PRIVATE_KEY || "0x" + "0".repeat(64);

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },

  networks: {
    // ── Local ────────────────────────────────────────────────────
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },

    // ── Mainnets ─────────────────────────────────────────────────
    opMainnet: {
      url: "https://mainnet.optimism.io",
      chainId: 10,
      accounts: [PK],
      gasPrice: "auto",
    },
    polygon: {
      url: "https://polygon-rpc.com",
      chainId: 137,
      accounts: [PK],
      gasPrice: "auto",
    },
    filecoin: {
      url: "https://api.node.glif.io/rpc/v1",
      chainId: 314,
      accounts: [PK],
      gasPrice: "auto",
    },
    arbitrum: {
      url: "https://arb1.arbitrum.io/rpc",
      chainId: 42161,
      accounts: [PK],
    },

    // ── Testnets ─────────────────────────────────────────────────
    opSepolia: {
      url: "https://sepolia.optimism.io",
      chainId: 11155420,
      accounts: [PK],
    },
    amoy: {
      url: "https://rpc-amoy.polygon.technology",
      chainId: 80002,
      accounts: [PK],
    },
    calibnet: {
      url: "https://api.calibration.node.glif.io/rpc/v1",
      chainId: 314159,
      accounts: [PK],
    },
    arbSepolia: {
      url: "https://sepolia-rollup.arbitrum.io/rpc",
      chainId: 421614,
      accounts: [PK],
    },
    baseSepolia: {
      url: "https://sepolia.base.org",
      chainId: 84532,
      accounts: [PK],
    },
    hedera: {
      url: "https://testnet.hashio.io/api",
      chainId: 296,
      accounts: [PK],
    },
    aurora: {
      url: "https://testnet.aurora.dev",
      chainId: 1313161555,
      accounts: [PK],
    },
    celo: {
      url: "https://alfajores-forno.celo-testnet.org",
      chainId: 44787,
      accounts: [PK],
    },
  },

  // ── Etherscan / block explorer verification ───────────────────
  etherscan: {
    apiKey: {
      optimisticEthereum: process.env.OPSCAN_API_KEY || "",
      polygon:            process.env.POLYGONSCAN_API_KEY || "",
      arbitrumOne:        process.env.ARBSCAN_API_KEY || "",
      // Filecoin and Hedera use separate verification flows
    },
    customChains: [
      {
        network: "opSepolia",
        chainId: 11155420,
        urls: {
          apiURL: "https://api-sepolia-optimism.etherscan.io/api",
          browserURL: "https://sepolia-optimism.etherscan.io",
        },
      },
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org",
        },
      },
      {
        network: "arbSepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io",
        },
      },
    ],
  },
};
