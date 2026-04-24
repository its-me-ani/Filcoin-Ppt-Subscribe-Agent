/**
 * PPT Token — Chain Configuration Map
 *
 * Contains token + invoice contract addresses for every supported network.
 * After each new deployment, paste the output from deploy.js here.
 *
 * Usage:
 *   import { getChainConfig, SUPPORTED_CHAIN_IDS } from './chains'
 *   const { token, invoice, name } = getChainConfig(chainId)
 */

export const PPT_CHAINS = {

  // ── Mainnets ────────────────────────────────────────────────
  314: {
    name:       "Filecoin Mainnet",
    token:      "0xC00BBC9A2C88712dC1e094866973F036373C7134",
    invoice:    "0x08bacb51f405a2D793E4F4BE53Ca2B3C8b8cF0CA",
    rpc:        "https://api.node.glif.io/rpc/v1",
    explorer:   "https://filfox.info/en",
    isMainnet:  true,
  },
  10: {
    name:       "OP Mainnet",
    token:      "0xb84A2bC5Dd76BcD6548022Ac86e77b84acB94A87",
    invoice:    "0x49009CD05805ce571DcE7b577677F73B5828aB53",
    rpc:        "https://mainnet.optimism.io",
    explorer:   "https://optimistic.etherscan.io",
    isMainnet:  true,
  },
  137: {
    name:       "Polygon Mainnet",
    token:      "0xC00BBC9A2C88712dC1e094866973F036373C7134",
    invoice:    "0x08bacb51f405a2D793E4F4BE53Ca2B3C8b8cF0CA",
    rpc:        "https://polygon-rpc.com",
    explorer:   "https://polygonscan.com",
    isMainnet:  true,
  },

  // ── Testnets ────────────────────────────────────────────────
  11155420: {
    name:       "OP Sepolia",
    token:      "0xc76F004CB35ec0971075060D4DBd6279d2252Acf",
    invoice:    "0x49009CD05805ce571DcE7b577677F73B5828aB53",
    subscription: "0xEc490F81156e14A4b364E4fe5a3d116eFd697eED",
    faucet:     "0xBA01DF91c631A0E101902c6f5E96c39eab096C68",
    rpc:        "https://sepolia.optimism.io",
    explorer:   "https://sepolia-optimism.etherscan.io",
    dapp:       "https://invoice-ppt-op-test.vercel.app/",
    isMainnet:  false,
  },
  80002: {
    name:       "Polygon Amoy",
    token:      "0xa9c14d3e8ECE4d924A4a4A819088F982b55F6734",
    invoice:    "0x08bacb51f405a2D793E4F4BE53Ca2B3C8b8cF0CA",
    rpc:        "https://rpc-amoy.polygon.technology",
    explorer:   "https://amoy.polygonscan.com",
    isMainnet:  false,
  },
  314159: {
    name:       "Filecoin Calibnet",
    token:      "0xb83bFF8Fdbe7C27B06E5f83D38881fB03A518B78",
    invoice:    "0x01c7BAAFa38dd9B5B62FFB20f5228Dd0c63F6d70",
    rpc:        "https://api.calibration.node.glif.io/rpc/v1",
    explorer:   "https://calibration.filfox.info/en",
    isMainnet:  false,
  },
  421614: {
    name:       "Arbitrum Sepolia",
    token:      "0xc76F004CB35ec0971075060D4DBd6279d2252Acf",
    invoice:    "0x49009CD05805ce571DcE7b577677F73B5828aB53",
    rpc:        "https://sepolia-rollup.arbitrum.io/rpc",
    explorer:   "https://sepolia.arbiscan.io",
    dapp:       "https://invoice-ppt-arb-test.vercel.app/",
    isMainnet:  false,
  },
  84532: {
    name:       "Base Sepolia",
    token:      "0xC00BBC9A2C88712dC1e094866973F036373C7134",
    invoice:    "0xa9c14d3e8ECE4d924A4a4A819088F982b55F6734",
    rpc:        "https://sepolia.base.org",
    explorer:   "https://sepolia.basescan.org",
    isMainnet:  false,
  },
  296: {
    name:       "Hedera Testnet",
    token:      "0xc00bbc9a2c88712dc1e094866973f036373c7134",
    invoice:    "0xa9c14d3e8ece4d924a4a4a819088f982b55f6734",
    rpc:        "https://testnet.hashio.io/api",
    explorer:   "https://hashscan.io/testnet",
    dapp:       "https://road-incident-dapp-hedera.vercel.app/",
    isMainnet:  false,
  },
  1313161555: {
    name:       "Aurora Testnet",
    token:      "0xa9c14d3e8ECE4d924A4a4A819088F982b55F6734",
    invoice:    "0x08bacb51f405a2D793E4F4BE53Ca2B3C8b8cF0CA",
    rpc:        "https://testnet.aurora.dev",
    explorer:   "https://explorer.testnet.aurora.dev",
    isMainnet:  false,
  },
  44787: {
    name:       "Celo Alfajores",
    token:      "0x5E0F0F24af0Fe2DE23D00B8182C833C165436714",
    invoice:    "0xb84A2bC5Dd76BcD6548022Ac86e77b84acB94A87",
    rpc:        "https://alfajores-forno.celo-testnet.org",
    explorer:   "https://alfajores.celoscan.io",
    isMainnet:  false,
  },
};

export const SUPPORTED_CHAIN_IDS = Object.keys(PPT_CHAINS).map(Number);

export const MAINNET_CHAIN_IDS = SUPPORTED_CHAIN_IDS.filter(
  (id) => PPT_CHAINS[id].isMainnet
);

export const TESTNET_CHAIN_IDS = SUPPORTED_CHAIN_IDS.filter(
  (id) => !PPT_CHAINS[id].isMainnet
);

/**
 * Get config for a chain. Throws if unsupported.
 */
export function getChainConfig(chainId) {
  const cfg = PPT_CHAINS[chainId];
  if (!cfg) {
    throw new Error(
      `Chain ${chainId} not supported. Add it to chains.js after deploying.`
    );
  }
  return cfg;
}

/**
 * Check if a chainId is supported without throwing.
 */
export function isChainSupported(chainId) {
  return !!PPT_CHAINS[chainId];
}
