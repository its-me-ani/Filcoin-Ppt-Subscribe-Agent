import { env } from '../config/env.js';
import type { StorageReceipt } from '../types.js';

const PINATA_API = 'https://api.pinata.cloud';

export async function pinataUpload(content: string, name: string): Promise<StorageReceipt> {
  const body = {
    pinataContent: {
      type: 'invoice',
      version: '1.0',
      timestamp: new Date().toISOString(),
      content,
    },
    pinataMetadata: { name, keyvalues: { app: 'invoice-copilot' } },
    pinataOptions: { cidVersion: 1 },
  };

  const res = await fetch(`${PINATA_API}/pinning/pinJSONToIPFS`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.storage.pinataJwt}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Pinata upload failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { IpfsHash: string; PinSize: number };

  return {
    provider: 'pinata',
    cid: data.IpfsHash,
    size: data.PinSize,
    gatewayUrl: `${env.storage.pinataGateway}/ipfs/${data.IpfsHash}`,
  };
}

export async function pinataFetch(cid: string): Promise<string> {
  const url = `${env.storage.pinataGateway}/ipfs/${cid}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pinata fetch failed: ${res.status}`);
  return res.text();
}
