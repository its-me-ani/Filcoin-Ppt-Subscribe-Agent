/**
 * Pinata IPFS Service
 * ====================
 * Handles uploading invoice content to IPFS via Pinata
 * and retrieving content from IPFS via Pinata Gateway.
 * 
 * Flow:
 *  1. Save: Invoice content → Pinata IPFS → CID → On-chain (MedInvoiceContract.saveFile(cid))
 *  2. Load: On-chain CID → Pinata Gateway → Invoice content
 */

// ─── Configuration ──────────────────────────────────────────────────────────

const PINATA_API_KEY = import.meta.env.VITE_PINATA_API_KEY || "";
const PINATA_SECRET_KEY = import.meta.env.VITE_PINATA_SECRET_KEY || "";
const PINATA_JWT = import.meta.env.VITE_PINATA_JWT || "";
const PINATA_GATEWAY = import.meta.env.VITE_PINATA_GATEWAY || "https://gateway.pinata.cloud";

const PINATA_API_URL = "https://api.pinata.cloud";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PinataUploadResult {
  IpfsHash: string; // The CID
  PinSize: number;
  Timestamp: string;
  isDuplicate?: boolean;
}

export interface IPFSInvoiceData {
  cid: string;
  content: string;
  metadata?: {
    name?: string;
    timestamp?: string;
    invoiceId?: string;
  };
}

// ─── Upload to IPFS ─────────────────────────────────────────────────────────

/**
 * Upload invoice content to IPFS via Pinata.
 * Returns the CID (Content Identifier) that can be stored on-chain.
 * 
 * @param content - The invoice spreadsheet content (can be URL-encoded)
 * @param metadata - Optional metadata for the pin (name, invoice ID, etc.)
 * @returns The CID hash from Pinata
 */
export async function uploadToIPFS(
  content: string,
  metadata?: { name?: string; invoiceId?: string }
): Promise<PinataUploadResult> {
  if (!PINATA_JWT && !PINATA_API_KEY) {
    throw new Error("Pinata API credentials not configured. Please set VITE_PINATA_JWT or VITE_PINATA_API_KEY in .env");
  }

  if (!content || content.trim().length === 0) {
    throw new Error("Content cannot be empty");
  }

  // Build the JSON payload for pinning
  const pinataBody = {
    pinataContent: {
      type: "invoice",
      version: "1.0",
      timestamp: new Date().toISOString(),
      invoiceId: metadata?.invoiceId || "",
      content: content,
    },
    pinataMetadata: {
      name: metadata?.name || `invoice-${Date.now()}`,
      keyvalues: {
        app: "EdgeBilling",
        type: "invoice",
        invoiceId: metadata?.invoiceId || "",
        timestamp: new Date().toISOString(),
      },
    },
    pinataOptions: {
      cidVersion: 1,
    },
  };

  // Build headers — prefer JWT over API key
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (PINATA_JWT) {
    headers["Authorization"] = `Bearer ${PINATA_JWT}`;
  } else {
    headers["pinata_api_key"] = PINATA_API_KEY;
    headers["pinata_secret_api_key"] = PINATA_SECRET_KEY;
  }

  const response = await fetch(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, {
    method: "POST",
    headers,
    body: JSON.stringify(pinataBody),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Pinata upload failed (${response.status}): ${errorText}`);
  }

  const result: PinataUploadResult = await response.json();
  return result;
}

// ─── Retrieve from IPFS ─────────────────────────────────────────────────────

/**
 * Fetch invoice content from IPFS via Pinata Gateway using the CID.
 * 
 * @param cid - The IPFS Content Identifier (hash)
 * @returns The invoice data including content
 */
export async function fetchFromIPFS(cid: string): Promise<IPFSInvoiceData> {
  if (!cid || cid.trim().length === 0) {
    throw new Error("CID cannot be empty");
  }

  // Clean the CID (remove any ipfs:// prefix)
  const cleanCid = cid.replace(/^ipfs:\/\//, "").trim();

  // Fetch from Pinata gateway
  const gatewayUrl = `${PINATA_GATEWAY}/ipfs/${cleanCid}`;
  
  const response = await fetch(gatewayUrl, {
    method: "GET",
    headers: {
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch from IPFS (${response.status}): CID ${cleanCid}`);
  }

  const data = await response.json();

  // Handle the pinned JSON structure
  if (data.content) {
    return {
      cid: cleanCid,
      content: data.content,
      metadata: {
        name: data.invoiceId || undefined,
        timestamp: data.timestamp || undefined,
        invoiceId: data.invoiceId || undefined,
      },
    };
  }

  // Fallback: if the response is the raw content itself
  return {
    cid: cleanCid,
    content: typeof data === "string" ? data : JSON.stringify(data),
  };
}

// ─── Utility ────────────────────────────────────────────────────────────────

/**
 * Get the full IPFS gateway URL for a given CID.
 */
export function getIPFSUrl(cid: string): string {
  const cleanCid = cid.replace(/^ipfs:\/\//, "").trim();
  return `${PINATA_GATEWAY}/ipfs/${cleanCid}`;
}

/**
 * Check if Pinata credentials are configured.
 */
export function isPinataConfigured(): boolean {
  return !!(PINATA_JWT || (PINATA_API_KEY && PINATA_SECRET_KEY));
}

/**
 * Validate that a string looks like an IPFS CID (basic check).
 */
export function isValidCID(str: string): boolean {
  if (!str || str.trim().length === 0) return false;
  const clean = str.replace(/^ipfs:\/\//, "").trim();
  // CIDv0 starts with Qm (46 chars), CIDv1 starts with bafy... (59+ chars)
  return /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(clean) || /^bafy[a-z2-7]{55,}$/.test(clean);
}
