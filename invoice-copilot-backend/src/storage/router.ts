import { env } from '../config/env.js';
import type { StorageReceipt } from '../types.js';
import { pinataUpload, pinataFetch } from './pinata.js';
import { lighthouseUpload, lighthouseFetch } from './lighthouse.js';

export async function storeInvoice(
  payload: unknown,
  name: string,
): Promise<StorageReceipt> {
  const primary = env.storage.primary;
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);

  try {
    if (primary === 'lighthouse' && env.storage.lighthouseKey) {
      return await lighthouseUpload(body, name);
    }
    if (env.storage.pinataJwt) {
      return await pinataUpload(body, name);
    }
  } catch (e) {
    // Fall through to local mock
    console.warn('[storage] primary failed, falling back to local:', (e as Error).message);
  }

  // Local in-memory fallback (hash-only, good enough for a demo with no keys)
  const { keccak256, toUtf8Bytes } = await import('ethers');
  const hash = keccak256(toUtf8Bytes(body));
  const fakeCid = 'baf' + hash.slice(2, 46);
  LOCAL_STORE.set(fakeCid, body);
  return {
    provider: 'local',
    cid: fakeCid,
    size: body.length,
    gatewayUrl: `memory://${fakeCid}`,
  };
}

export async function fetchInvoice(cid: string): Promise<string> {
  if (LOCAL_STORE.has(cid)) return LOCAL_STORE.get(cid)!;
  if (env.storage.primary === 'lighthouse' && env.storage.lighthouseKey) {
    return lighthouseFetch(cid);
  }
  return pinataFetch(cid);
}

const LOCAL_STORE = new Map<string, string>();
