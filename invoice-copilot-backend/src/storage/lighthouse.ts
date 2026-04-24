import { env } from '../config/env.js';
import type { StorageReceipt } from '../types.js';

const LH_UPLOAD = 'https://node.lighthouse.storage/api/v0/add';
const LH_GATEWAY = 'https://gateway.lighthouse.storage/ipfs';

export async function lighthouseUpload(content: string, name: string): Promise<StorageReceipt> {
  // Lighthouse accepts multipart/form-data for the node API
  const form = new FormData();
  form.append('file', new Blob([content], { type: 'application/json' }), `${name}.json`);

  const res = await fetch(LH_UPLOAD, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.storage.lighthouseKey}` },
    body: form,
  });

  if (!res.ok) throw new Error(`Lighthouse upload failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { Hash: string; Size: string; Name: string };

  return {
    provider: 'lighthouse',
    cid: data.Hash,
    size: Number(data.Size),
    gatewayUrl: `${LH_GATEWAY}/${data.Hash}`,
  };
}

export async function lighthouseFetch(cid: string): Promise<string> {
  const res = await fetch(`${LH_GATEWAY}/${cid}`);
  if (!res.ok) throw new Error(`Lighthouse fetch failed: ${res.status}`);
  return res.text();
}
