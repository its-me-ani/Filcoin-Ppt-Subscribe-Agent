/**
 * Blockchain Service Layer
 * ========================
 * Integrates PPTToken (ERC-20) and MedInvoiceContract with the frontend.
 * Uses ethers.js v6 for all blockchain interactions.
 * 
 * Network: Optimism Sepolia Testnet
 */

import { BrowserProvider, Contract, formatUnits, parseUnits } from "ethers";

// ─── Network Configuration ──────────────────────────────────────────────────
export const OPTIMISM_SEPOLIA = {
  chainId: "0xaa37dc", // 11155420 in hex
  chainIdDecimal: 11155420,
  chainName: "Optimism Sepolia Testnet",
  rpcUrls: ["https://sepolia.optimism.io"],
  blockExplorerUrls: ["https://sepolia-optimism.etherscan.io"],
  nativeCurrency: {
    name: "Sepolia Ether",
    symbol: "ETH",
    decimals: 18,
  },
};

// ─── Contract Addresses ─────────────────────────────────────────────────────
// These will be auto-updated by the deploy script
export const PPT_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000";
export const INVOICE_CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";

// ─── Minimal ABIs (only functions we call) ──────────────────────────────────

const PPT_TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

const INVOICE_CONTRACT_ABI = [
  "function saveFile(string file) public",
  "function getFiles() public view returns (string[])",
  "function getUserTokens() public view returns (uint256)",
  "function isSubscribed(address user) public view returns (bool)",
  "function getSubscriptionDetails() public view returns (bool exists, uint256 endTime)",
  "function getSubscriptionEndDate(address user) public view returns (uint256)",
  "function subscribe() external",
  "function pptToken() public view returns (address)",
  "function SUBSCRIPTION_AMOUNT() public view returns (uint256)",
  "function SUBSCRIPTION_PERIOD() public view returns (uint256)",
  "event FileSaved(address indexed user, string file, uint256 timestamp)",
  "event NewSubscription(address indexed subscriber, uint256 endTime)",
];

// ─── Utility Types ──────────────────────────────────────────────────────────

export interface WalletInfo {
  address: string;
  balance: string; // formatted PPT balance
  balanceRaw: bigint;
  isSubscribed: boolean;
  subscriptionEndTime: number; // unix timestamp, 0 if not subscribed
}



// ─── Provider / Signer Helpers ──────────────────────────────────────────────

function getEthereum(): any {
  if (typeof window !== "undefined" && (window as any).ethereum) {
    return (window as any).ethereum;
  }
  return null;
}

export function isMetaMaskInstalled(): boolean {
  return !!getEthereum();
}

function getBrowserProvider(): BrowserProvider {
  const ethereum = getEthereum();
  if (!ethereum) {
    throw new Error("MetaMask is not installed. Please install MetaMask to use blockchain features.");
  }
  return new BrowserProvider(ethereum);
}

// ─── Network Switching ──────────────────────────────────────────────────────

export async function addOptimismNetwork(): Promise<void> {
  const ethereum = getEthereum();
  if (!ethereum) throw new Error("MetaMask not found");

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: OPTIMISM_SEPOLIA.chainId }],
    });
  } catch (switchError: any) {
    // Chain not added yet — add it
    if (switchError.code === 4902) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: OPTIMISM_SEPOLIA.chainId,
            chainName: OPTIMISM_SEPOLIA.chainName,
            rpcUrls: OPTIMISM_SEPOLIA.rpcUrls,
            blockExplorerUrls: OPTIMISM_SEPOLIA.blockExplorerUrls,
            nativeCurrency: OPTIMISM_SEPOLIA.nativeCurrency,
          },
        ],
      });
    } else {
      throw switchError;
    }
  }
}

// ─── Wallet Connection ──────────────────────────────────────────────────────

export async function connectWallet(): Promise<string> {
  const provider = getBrowserProvider();

  // Request account access
  const accounts = await provider.send("eth_requestAccounts", []);
  if (!accounts || accounts.length === 0) {
    throw new Error("No accounts found. Please unlock MetaMask.");
  }

  // Ensure correct network
  await addOptimismNetwork();

  const address = accounts[0];
  // Persist connected state
  localStorage.setItem("blockchain_wallet_connected", "true");
  localStorage.setItem("blockchain_wallet_address", address);

  return address;
}

export async function disconnectWallet(): Promise<void> {
  localStorage.removeItem("blockchain_wallet_connected");
  localStorage.removeItem("blockchain_wallet_address");
}

export async function getConnectedAddress(): Promise<string | null> {
  const ethereum = getEthereum();
  if (!ethereum) return null;

  try {
    const accounts = await ethereum.request({ method: "eth_accounts" });
    if (accounts && accounts.length > 0) {
      return accounts[0];
    }
  } catch {
    // ignore
  }
  return null;
}

// ─── Token Balance ──────────────────────────────────────────────────────────

export async function getTokenBalance(address: string): Promise<{ formatted: string; raw: bigint }> {
  const provider = getBrowserProvider();
  const tokenContract = new Contract(PPT_TOKEN_ADDRESS, PPT_TOKEN_ABI, provider);

  const balance: bigint = await tokenContract.balanceOf(address);
  const decimals: number = await tokenContract.decimals();
  const formatted = formatUnits(balance, decimals);

  return { formatted, raw: balance };
}

// ─── Subscription ───────────────────────────────────────────────────────────

export async function checkSubscription(address: string): Promise<boolean> {
  const provider = getBrowserProvider();
  const contract = new Contract(INVOICE_CONTRACT_ADDRESS, INVOICE_CONTRACT_ABI, provider);

  return await contract.isSubscribed(address);
}

export async function getSubscriptionDetails(): Promise<{ exists: boolean; endTime: number }> {
  const provider = getBrowserProvider();
  const signer = await provider.getSigner();
  const contract = new Contract(INVOICE_CONTRACT_ADDRESS, INVOICE_CONTRACT_ABI, signer);

  const [exists, endTime] = await contract.getSubscriptionDetails();
  return {
    exists,
    endTime: Number(endTime),
  };
}

export async function subscribe(): Promise<string> {
  const provider = getBrowserProvider();
  const signer = await provider.getSigner();

  // First approve the invoice contract to spend PPT tokens
  const tokenContract = new Contract(PPT_TOKEN_ADDRESS, PPT_TOKEN_ABI, signer);
  const subscriptionAmount = parseUnits("10", 18); // 10 PPT

  // Check allowance
  const signerAddress = await signer.getAddress();
  const currentAllowance: bigint = await tokenContract.allowance(signerAddress, INVOICE_CONTRACT_ADDRESS);

  if (currentAllowance < subscriptionAmount) {
    const approveTx = await tokenContract.approve(INVOICE_CONTRACT_ADDRESS, subscriptionAmount);
    await approveTx.wait();
  }

  // Now subscribe
  const invoiceContract = new Contract(INVOICE_CONTRACT_ADDRESS, INVOICE_CONTRACT_ABI, signer);
  const tx = await invoiceContract.subscribe();
  const receipt = await tx.wait();

  return receipt.hash;
}

// ─── File Save / Retrieve (via Pinata IPFS) ────────────────────────────────
//
// Flow:
//   Save:  Invoice content → Pinata IPFS → CID → on-chain (saveFile(cid))
//   Load:  on-chain CIDs → Pinata Gateway → Invoice content
//

import {
  uploadToIPFS,
  fetchFromIPFS,
  getIPFSUrl,
  isPinataConfigured,
  isValidCID,
  type IPFSInvoiceData,
} from "./pinata-ipfs";

// Re-export IPFS utilities for convenience
export { getIPFSUrl, isPinataConfigured, isValidCID };
export type { IPFSInvoiceData };

/**
 * Save an invoice to IPFS (via Pinata) and store the CID on-chain.
 * 
 * @param fileContent - The invoice spreadsheet content
 * @param metadata - Optional metadata (invoice name/ID)
 * @returns Object with txHash (on-chain) and cid (IPFS)
 */
export async function saveFileOnChain(
  fileContent: string,
  metadata?: { name?: string; invoiceId?: string }
): Promise<{ txHash: string; cid: string }> {
  if (!fileContent || fileContent.trim().length === 0) {
    throw new Error("File content cannot be empty");
  }

  if (!isPinataConfigured()) {
    throw new Error("Pinata IPFS not configured. Please set VITE_PINATA_JWT in .env");
  }

  // Step 1: Upload content to IPFS via Pinata
  const ipfsResult = await uploadToIPFS(fileContent, metadata);
  const cid = ipfsResult.IpfsHash;

  // Step 2: Store the CID on-chain
  const provider = getBrowserProvider();
  const signer = await provider.getSigner();
  const contract = new Contract(INVOICE_CONTRACT_ADDRESS, INVOICE_CONTRACT_ABI, signer);

  const tx = await contract.saveFile(cid);
  const receipt = await tx.wait();

  return {
    txHash: receipt.hash,
    cid,
  };
}

export interface BlockchainIPFSFile {
  index: number;
  cid: string;
  ipfsUrl: string;
  content?: string;       // Populated when fetched from IPFS
  metadata?: {
    name?: string;
    timestamp?: string;
    invoiceId?: string;
  };
  fetchError?: string;    // If IPFS fetch failed
}

/**
 * Get all file CIDs from the blockchain.
 * Returns CIDs only (cheap, no IPFS fetch).
 */
export async function getFileCIDsFromChain(): Promise<string[]> {
  const provider = getBrowserProvider();
  const signer = await provider.getSigner();
  const contract = new Contract(INVOICE_CONTRACT_ADDRESS, INVOICE_CONTRACT_ABI, signer);

  const files: string[] = await contract.getFiles();
  return files;
}

/**
 * Get all files from blockchain + fetch their content from IPFS.
 * Fetches CIDs from chain, then resolves each via Pinata gateway.
 */
export async function getFilesFromChain(): Promise<BlockchainIPFSFile[]> {
  const cids = await getFileCIDsFromChain();

  // Resolve each CID from IPFS (in parallel, with error handling per-file)
  const files: BlockchainIPFSFile[] = await Promise.all(
    cids.map(async (cid, index) => {
      const baseFile: BlockchainIPFSFile = {
        index,
        cid,
        ipfsUrl: getIPFSUrl(cid),
      };

      try {
        const ipfsData = await fetchFromIPFS(cid);
        return {
          ...baseFile,
          content: ipfsData.content,
          metadata: ipfsData.metadata,
        };
      } catch (e: any) {
        return {
          ...baseFile,
          fetchError: e?.message || "Failed to fetch from IPFS",
        };
      }
    })
  );

  return files;
}


// ─── Full Wallet Info ───────────────────────────────────────────────────────

export async function getWalletInfo(address: string): Promise<WalletInfo> {
  const [balanceData, isSubscribedResult, subDetails] = await Promise.all([
    getTokenBalance(address),
    checkSubscription(address).catch(() => false),
    getSubscriptionDetails().catch(() => ({ exists: false, endTime: 0 })),
  ]);

  return {
    address,
    balance: balanceData.formatted,
    balanceRaw: balanceData.raw,
    isSubscribed: isSubscribedResult,
    subscriptionEndTime: subDetails.endTime,
  };
}

// ─── Event Listeners ────────────────────────────────────────────────────────

export function onAccountsChanged(callback: (accounts: string[]) => void): () => void {
  const ethereum = getEthereum();
  if (!ethereum) return () => {};

  ethereum.on("accountsChanged", callback);
  return () => ethereum.removeListener("accountsChanged", callback);
}

export function onChainChanged(callback: (chainId: string) => void): () => void {
  const ethereum = getEthereum();
  if (!ethereum) return () => {};

  ethereum.on("chainChanged", callback);
  return () => ethereum.removeListener("chainChanged", callback);
}

// ─── Utilities ──────────────────────────────────────────────────────────────

export function truncateAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function getExplorerUrl(txHash: string): string {
  return `${OPTIMISM_SEPOLIA.blockExplorerUrls[0]}/tx/${txHash}`;
}

export function getAddressExplorerUrl(address: string): string {
  return `${OPTIMISM_SEPOLIA.blockExplorerUrls[0]}/address/${address}`;
}
