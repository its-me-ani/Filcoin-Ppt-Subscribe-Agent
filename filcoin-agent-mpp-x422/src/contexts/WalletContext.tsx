/**
 * WalletContext — Global blockchain wallet state management
 * ==========================================================
 * Provides wallet connection, token balance, and subscription status
 * across the entire app.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import {
  connectWallet as connectWalletService,
  disconnectWallet as disconnectWalletService,
  getConnectedAddress,
  getTokenBalance,
  checkSubscription,
  getSubscriptionDetails,
  onAccountsChanged,
  onChainChanged,
  isMetaMaskInstalled,
  truncateAddress,
} from "../services/blockchain";

// ─── Types ──────────────────────────────────────────────────────────────────

interface WalletContextType {
  // State
  walletAddress: string | null;
  isConnected: boolean;
  isMetaMaskAvailable: boolean;
  tokenBalance: string;
  tokenBalanceRaw: bigint;
  isSubscribed: boolean;
  subscriptionEndDate: Date | null;
  isLoading: boolean;
  isConnecting: boolean;
  error: string | null;

  // Actions
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  refreshAll: () => Promise<void>;
  clearError: () => void;

  // Computed
  truncatedAddress: string;
  daysUntilExpiry: number | null;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
};

// ─── Provider ───────────────────────────────────────────────────────────────

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [tokenBalance, setTokenBalance] = useState<string>("0");
  const [tokenBalanceRaw, setTokenBalanceRaw] = useState<bigint>(BigInt(0));
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [subscriptionEndTime, setSubscriptionEndTime] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isConnected = !!walletAddress;
  const isMetaMaskAvailable = isMetaMaskInstalled();

  const truncatedAddress = walletAddress ? truncateAddress(walletAddress) : "";

  const subscriptionEndDate =
    subscriptionEndTime > 0 ? new Date(subscriptionEndTime * 1000) : null;

  const daysUntilExpiry =
    subscriptionEndDate
      ? Math.max(
          0,
          Math.ceil(
            (subscriptionEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          )
        )
      : null;

  // ─── Refresh Balance ────────────────────────────────────────────────────
  const refreshBalance = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const { formatted, raw } = await getTokenBalance(walletAddress);
      setTokenBalance(formatted);
      setTokenBalanceRaw(raw);
    } catch (e) {
      console.warn("Failed to refresh token balance:", e);
    }
  }, [walletAddress]);

  // ─── Refresh Subscription ──────────────────────────────────────────────
  const refreshSubscription = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const [subscribed, details] = await Promise.all([
        checkSubscription(walletAddress).catch(() => false),
        getSubscriptionDetails().catch(() => ({ exists: false, endTime: 0 })),
      ]);
      setIsSubscribed(subscribed);
      setSubscriptionEndTime(details.endTime);
    } catch (e) {
      console.warn("Failed to refresh subscription:", e);
    }
  }, [walletAddress]);

  // ─── Refresh All ───────────────────────────────────────────────────────
  const refreshAll = useCallback(async () => {
    if (!walletAddress) return;
    setIsLoading(true);
    try {
      await Promise.all([refreshBalance(), refreshSubscription()]);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress, refreshBalance, refreshSubscription]);

  // ─── Connect Wallet ────────────────────────────────────────────────────
  const connectWallet = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const address = await connectWalletService();
      setWalletAddress(address);
    } catch (e: any) {
      const message =
        e?.message || "Failed to connect wallet. Please try again.";
      setError(message);
      console.error("Wallet connection error:", e);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // ─── Disconnect Wallet ─────────────────────────────────────────────────
  const disconnectWallet = useCallback(async () => {
    await disconnectWalletService();
    setWalletAddress(null);
    setTokenBalance("0");
    setTokenBalanceRaw(BigInt(0));
    setIsSubscribed(false);
    setSubscriptionEndTime(0);
    setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  // ─── Auto-reconnect on mount ──────────────────────────────────────────
  useEffect(() => {
    const tryReconnect = async () => {
      const wasConnected = localStorage.getItem("blockchain_wallet_connected");
      if (wasConnected !== "true") return;

      try {
        const address = await getConnectedAddress();
        if (address) {
          setWalletAddress(address);
        } else {
          // Wallet was connected before but no accounts now — clear state
          localStorage.removeItem("blockchain_wallet_connected");
          localStorage.removeItem("blockchain_wallet_address");
        }
      } catch (e) {
        console.warn("Auto-reconnect failed:", e);
      }
    };

    if (isMetaMaskAvailable) {
      tryReconnect();
    }
  }, [isMetaMaskAvailable]);

  // ─── Refresh data when wallet address changes ─────────────────────────
  useEffect(() => {
    if (walletAddress) {
      refreshAll();
    }
  }, [walletAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── MetaMask event listeners ─────────────────────────────────────────
  useEffect(() => {
    if (!isMetaMaskAvailable) return;

    const cleanupAccounts = onAccountsChanged((accounts) => {
      if (accounts.length === 0) {
        // User disconnected
        disconnectWallet();
      } else {
        setWalletAddress(accounts[0]);
        localStorage.setItem("blockchain_wallet_address", accounts[0]);
      }
    });

    const cleanupChain = onChainChanged(() => {
      // Refresh data on chain change
      if (walletAddress) {
        refreshAll();
      }
    });

    return () => {
      cleanupAccounts();
      cleanupChain();
    };
  }, [isMetaMaskAvailable, walletAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Context Value ────────────────────────────────────────────────────

  const value: WalletContextType = {
    walletAddress,
    isConnected,
    isMetaMaskAvailable,
    tokenBalance,
    tokenBalanceRaw,
    isSubscribed,
    subscriptionEndDate,
    isLoading,
    isConnecting,
    error,
    connectWallet,
    disconnectWallet,
    refreshBalance,
    refreshSubscription,
    refreshAll,
    clearError,
    truncatedAddress,
    daysUntilExpiry,
  };

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
};
