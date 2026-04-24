import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import * as dotenv from 'dotenv';
dotenv.config();

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY ?? '';
const accounts = PRIVATE_KEY ? [PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    optimismSepolia: {
      url: process.env.OP_SEPOLIA_RPC ?? 'https://sepolia.optimism.io',
      chainId: 11155420,
      accounts,
    },
    filecoinCalibration: {
      url: process.env.FIL_CALIBRATION_RPC ?? 'https://api.calibration.node.glif.io/rpc/v1',
      chainId: 314159,
      accounts,
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC ?? 'https://sepolia.base.org',
      chainId: 84532,
      accounts,
    },
  },
};

export default config;
