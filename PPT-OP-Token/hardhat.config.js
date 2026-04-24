require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config()

// Fallback values so Hardhat doesn't crash when .env is missing
const RPC_URL = process.env.RPC_URL || "https://sepolia.optimism.io";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  networks: {
    "op-sepolia": {
      url: RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 11155420,
    },
  },
  etherscan: {
    apiKey: {
      "op-sepolia": process.env.VERIFY_KEY || "",
    },
    customChains: [
      {
        network: "op-sepolia",
        chainId: 11155420,
        urls: {
          apiURL: "https://api-sepolia-optimistic.etherscan.io/api",
          browserURL: "https://sepolia-optimism.etherscan.io"
        }
      }
    ]
  }
};
