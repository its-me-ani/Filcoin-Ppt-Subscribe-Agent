/**
 * usePPTInvoice — React hook
 *
 * Wraps all PPTToken + MedInvoiceContract interactions.
 * Works with wagmi v2 + viem. Install:
 *   npm install wagmi viem @tanstack/react-query
 *
 * Usage:
 *   const { subscribe, saveFile, getFiles, mintToken, isSubscribed } = usePPTInvoice()
 */

import { useState, useCallback } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import { parseEther, formatEther } from "viem";
import { getChainConfig, isChainSupported } from "../config/chains";

// ── ABIs ──────────────────────────────────────────────────────────
const TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function maxSupply() view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

const INVOICE_ABI = [
  // File management
  "function saveFile(string file)",
  "function deleteFile(uint256 index)",
  "function getFiles() view returns (string[])",
  "function getFileCount() view returns (uint256)",
  "function getFile(uint256 index) view returns (string)",
  // Token
  "function getUserTokens() view returns (uint256)",
  "function getContractBalance() view returns (uint256)",
  // Subscription
  "function isSubscribed(address user) view returns (bool)",
  "function getSubscriptionDetails() view returns (bool active, uint256 endTime, uint256 remaining)",
  "function getSubscriptionEndDate(address user) view returns (uint256)",
  "function subscribe()",
  "function renewSubscription()",
  // Minting
  "function mintToken(uint256 amount)",
  "function totalMintedByUsers() view returns (uint256)",
  "function mintCap() view returns (uint256)",
  // Constants
  "function SUBSCRIPTION_AMOUNT() view returns (uint256)",
  "function MAX_MINT_PER_TX() view returns (uint256)",
  // Events
  "event FileSaved(address indexed user, string file, uint256 timestamp)",
  "event NewSubscription(address indexed subscriber, uint256 endTime)",
  "event TokensMinted(address indexed user, uint256 amount)",
];

// ── Hook ─────────────────────────────────────────────────────────
export function usePPTInvoice() {
  const { address: userAddress, isConnected } = useAccount();
  const chainId      = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  // ── Get contract addresses for current chain ─────────────────
  const getContracts = useCallback(() => {
    if (!isChainSupported(chainId)) {
      throw new Error(`Switch to a supported network. Current chainId: ${chainId}`);
    }
    return getChainConfig(chainId);
  }, [chainId]);

  // ── Helper: execute a write transaction ─────────────────────
  const execute = useCallback(async (fn) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      return result;
    } catch (err) {
      const msg = err?.shortMessage || err?.message || "Transaction failed";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ════════════════════════════════════════════════════════════
  //  READ FUNCTIONS
  // ════════════════════════════════════════════════════════════

  /** Get caller's PPT balance */
  const getTokenBalance = useCallback(async (addr) => {
    const { token } = getContracts();
    const balance = await publicClient.readContract({
      address: token,
      abi: TOKEN_ABI,
      functionName: "balanceOf",
      args: [addr || userAddress],
    });
    return { raw: balance, formatted: formatEther(balance) };
  }, [publicClient, userAddress, getContracts]);

  /** Get contract's PPT balance (subscription fund pool) */
  const getContractBalance = useCallback(async () => {
    const { invoice } = getContracts();
    const balance = await publicClient.readContract({
      address: invoice,
      abi: INVOICE_ABI,
      functionName: "getContractBalance",
    });
    return { raw: balance, formatted: formatEther(balance) };
  }, [publicClient, getContracts]);

  /** Check if an address is subscribed */
  const checkSubscription = useCallback(async (addr) => {
    const { invoice } = getContracts();
    const [subscribed, details] = await Promise.all([
      publicClient.readContract({
        address: invoice,
        abi: INVOICE_ABI,
        functionName: "isSubscribed",
        args: [addr || userAddress],
      }),
      publicClient.readContract({
        address: invoice,
        abi: INVOICE_ABI,
        functionName: "getSubscriptionDetails",
      }),
    ]);
    return {
      isSubscribed: subscribed,
      active:    details[0],
      endTime:   details[1],
      remaining: details[2], // seconds
      endDate:   new Date(Number(details[1]) * 1000),
    };
  }, [publicClient, userAddress, getContracts]);

  /** Get all saved files for the caller */
  const getFiles = useCallback(async () => {
    const { invoice } = getContracts();
    return publicClient.readContract({
      address: invoice,
      abi: INVOICE_ABI,
      functionName: "getFiles",
    });
  }, [publicClient, getContracts]);

  /** Get number of files saved */
  const getFileCount = useCallback(async () => {
    const { invoice } = getContracts();
    const count = await publicClient.readContract({
      address: invoice,
      abi: INVOICE_ABI,
      functionName: "getFileCount",
    });
    return Number(count);
  }, [publicClient, getContracts]);

  /** Get mint pool stats */
  const getMintStats = useCallback(async () => {
    const { invoice } = getContracts();
    const [minted, cap, maxPerTx] = await Promise.all([
      publicClient.readContract({ address: invoice, abi: INVOICE_ABI, functionName: "totalMintedByUsers" }),
      publicClient.readContract({ address: invoice, abi: INVOICE_ABI, functionName: "mintCap" }),
      publicClient.readContract({ address: invoice, abi: INVOICE_ABI, functionName: "MAX_MINT_PER_TX" }),
    ]);
    return {
      minted:      formatEther(minted),
      cap:         formatEther(cap),
      maxPerTx:    formatEther(maxPerTx),
      remaining:   formatEther(cap - minted),
      percentUsed: Number((minted * 100n) / cap),
    };
  }, [publicClient, getContracts]);

  // ════════════════════════════════════════════════════════════
  //  WRITE FUNCTIONS
  // ════════════════════════════════════════════════════════════

  /**
   * Subscribe and receive 10 PPT reward.
   * Contract must be pre-funded by owner.
   */
  const subscribe = useCallback(() => execute(async () => {
    const { invoice } = getContracts();
    const hash = await walletClient.writeContract({
      address:      invoice,
      abi:          INVOICE_ABI,
      functionName: "subscribe",
    });
    return publicClient.waitForTransactionReceipt({ hash });
  }), [execute, walletClient, publicClient, getContracts]);

  /**
   * Renew an expired subscription.
   */
  const renewSubscription = useCallback(() => execute(async () => {
    const { invoice } = getContracts();
    const hash = await walletClient.writeContract({
      address:      invoice,
      abi:          INVOICE_ABI,
      functionName: "renewSubscription",
    });
    return publicClient.waitForTransactionReceipt({ hash });
  }), [execute, walletClient, publicClient, getContracts]);

  /**
   * Save an invoice file reference (IPFS CID or encrypted string).
   * Caller must hold >= 1 wei PPT.
   * @param {string} fileRef IPFS CID or reference string
   */
  const saveFile = useCallback((fileRef) => execute(async () => {
    if (!fileRef || fileRef.trim() === "") throw new Error("File reference is empty");
    const { invoice } = getContracts();
    const hash = await walletClient.writeContract({
      address:      invoice,
      abi:          INVOICE_ABI,
      functionName: "saveFile",
      args:         [fileRef],
    });
    return publicClient.waitForTransactionReceipt({ hash });
  }), [execute, walletClient, publicClient, getContracts]);

  /**
   * Delete a saved file by index.
   * @param {number} index Position in the file array
   */
  const deleteFile = useCallback((index) => execute(async () => {
    const { invoice } = getContracts();
    const hash = await walletClient.writeContract({
      address:      invoice,
      abi:          INVOICE_ABI,
      functionName: "deleteFile",
      args:         [BigInt(index)],
    });
    return publicClient.waitForTransactionReceipt({ hash });
  }), [execute, walletClient, publicClient, getContracts]);

  /**
   * Mint PPT tokens (requires active subscription).
   * Max 100 PPT per call.
   * @param {string} amount Amount in whole tokens e.g. "50"
   */
  const mintToken = useCallback((amount) => execute(async () => {
    const amountWei = parseEther(amount.toString());
    const { invoice } = getContracts();
    const hash = await walletClient.writeContract({
      address:      invoice,
      abi:          INVOICE_ABI,
      functionName: "mintToken",
      args:         [amountWei],
    });
    return publicClient.waitForTransactionReceipt({ hash });
  }), [execute, walletClient, publicClient, getContracts]);

  // ── Return ────────────────────────────────────────────────────
  return {
    // State
    loading,
    error,
    isConnected,
    chainId,
    userAddress,
    isChainSupported: isChainSupported(chainId),

    // Reads
    getTokenBalance,
    getContractBalance,
    checkSubscription,
    getFiles,
    getFileCount,
    getMintStats,

    // Writes
    subscribe,
    renewSubscription,
    saveFile,
    deleteFile,
    mintToken,
  };
}
