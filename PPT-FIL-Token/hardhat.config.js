require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config()

// Fallback values so Hardhat doesn't crash when .env is missing
const RPC_URL = process.env.RPC_URL || "https://api.calibration.node.glif.io/rpc/v1";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  networks: {
    "calibnet": {
      url: RPC_URL,
      accounts: [PRIVATE_KEY]
    },
    "filecoin": {
      url: RPC_URL,
      accounts: [PRIVATE_KEY]
    },
    "op-sepolia": {
      url: RPC_URL,
      accounts: [PRIVATE_KEY]
    },
    "op-mainnet": {
      url: RPC_URL,
      accounts: [PRIVATE_KEY]
    },
    "arbitrumSepolia": {
      url: RPC_URL,
      accounts: [PRIVATE_KEY]
    },
    "celo-alfajores": {
      url: RPC_URL,
      accounts: [PRIVATE_KEY]
    }
  },
  etherscan: {
    apiKey: {
      "calibnet": process.env.VERIFY_KEY,
      "op-sepolia": process.env.VERIFY_KEY,
      "op-mainnet": process.env.VERIFY_KEY,
      "optimism": process.env.VERIFY_KEY,
      "arbitrumSepolia": process.env.VERIFY_KEY,
      "celo-alfajores": process.env.VERIFY_KEY
    },
    customChains: [
      {
        network: "calibnet",
        chainId: 314159,
        urls: {
          apiURL: "https://api.calibration.node.glif.io/rpc/v1",
          browserURL: "https://calibration.filscan.io"
        }
      },
      {
        network: "op-sepolia",
        chainId: 11155420,
        urls: {
          apiURL: "https://api-sepolia-optimistic.etherscan.io/api",
          browserURL: "https://sepolia-optimism.etherscan.io"
        }
      },
      {
        network: "optimism",
        chainId: 10,
        urls: {
          apiURL: "https://api-optimistic.etherscan.io/api",
          browserURL: "https://optimistic.etherscan.io"
        }
      },
      {
        network: "arbitrumSepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io/"
        }
      },
      {
        network: "celo-alfajores",
        chainId: 44787,
        urls: {
            apiURL: "https://api-alfajores.celoscan.io/api",
            browserURL: "https://alfajores.celoscan.io",
        },
      },
      {
        network: "op-mainnet",
        chainId: 10,
        urls: {
          apiURL: "https://api-optimistic.etherscan.io/api",
          browserURL: "https://optimistic.etherscan.io"
        }
      }
    ]
  }
};