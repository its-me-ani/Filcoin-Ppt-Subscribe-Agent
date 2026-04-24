import 'dotenv/config';

function str(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

function num(name: string, fallback: number): number {
  const v = process.env[name];
  return v ? Number(v) : fallback;
}

export const env = {
  port: num('PORT', 8787),
  // Force restart
  nodeEnv: str('NODE_ENV', 'development'),

  ai: {
    provider: str('AI_PROVIDER', 'mock') as 'openai' | 'anthropic' | 'ollama' | 'mock' | 'gemini',
    model: str('AI_MODEL', 'claude-sonnet-4-6'),
    apiKey: str('AI_API_KEY'),
    endpoint: str('AI_ENDPOINT'),
  },

  storage: {
    primary: str('STORAGE_PRIMARY', 'pinata') as 'pinata' | 'lighthouse',
    lighthouseKey: str('LIGHTHOUSE_API_KEY'),
    pinataJwt: str('PINATA_JWT'),
    pinataGateway: str('PINATA_GATEWAY', 'https://gateway.pinata.cloud'),
  },

  chain: {
    chainId: num('CHAIN_ID', 11155420),
    rpcUrl: str('RPC_URL', 'https://sepolia.optimism.io'),
    registry: str('INVOICE_REGISTRY_ADDRESS'),
    signerKey: str('BACKEND_SIGNER_PRIVATE_KEY'),
  },

  payments: {
    x402Gateway: str('X402_GATEWAY_URL'),
    mppEndpoint: str('MPP_TEMPO_ENDPOINT'),
    erc8004Agent: str('ERC8004_AGENT_ADDRESS'),
  },
};
