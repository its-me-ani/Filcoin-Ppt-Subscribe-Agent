/**
 * InvoiceApp.jsx — Complete invoice DApp component
 *
 * Drop this into any React + wagmi project.
 * Handles: chain switching, subscription, file save/delete, minting.
 *
 * Requirements:
 *   npm install wagmi viem @tanstack/react-query
 */

import { useState, useEffect } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { usePPTInvoice } from "../hooks/usePPTInvoice";
import { PPT_CHAINS, SUPPORTED_CHAIN_IDS } from "../config/chains";

export default function InvoiceApp() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const {
    loading, error, isChainSupported,
    getTokenBalance, checkSubscription,
    getFiles, getMintStats,
    subscribe, renewSubscription,
    saveFile, deleteFile, mintToken,
  } = usePPTInvoice();

  // ── Local state ───────────────────────────────────────────────
  const [balance,       setBalance]       = useState(null);
  const [subscription,  setSubscription]  = useState(null);
  const [files,         setFiles]         = useState([]);
  const [mintStats,     setMintStats]     = useState(null);
  const [fileInput,     setFileInput]     = useState("");
  const [mintAmount,    setMintAmount]    = useState("10");
  const [txStatus,      setTxStatus]      = useState("");

  // ── Load data when wallet + chain is ready ────────────────────
  useEffect(() => {
    if (!isConnected || !isChainSupported) return;
    loadAll();
  }, [address, chainId, isConnected]);

  async function loadAll() {
    try {
      const [bal, sub, fileList, stats] = await Promise.all([
        getTokenBalance(),
        checkSubscription(),
        getFiles().catch(() => []), // getFiles reverts if balance=0
        getMintStats(),
      ]);
      setBalance(bal);
      setSubscription(sub);
      setFiles(fileList);
      setMintStats(stats);
    } catch (e) {
      console.error("Load error:", e);
    }
  }

  // ── Action handlers ───────────────────────────────────────────
  async function handleSubscribe() {
    setTxStatus("Subscribing...");
    try {
      await subscribe();
      setTxStatus("Subscribed! You received 10 PPT.");
      await loadAll();
    } catch (e) {
      setTxStatus(`Error: ${e.message}`);
    }
  }

  async function handleRenew() {
    setTxStatus("Renewing subscription...");
    try {
      await renewSubscription();
      setTxStatus("Renewed! You received 10 PPT.");
      await loadAll();
    } catch (e) {
      setTxStatus(`Error: ${e.message}`);
    }
  }

  async function handleSaveFile() {
    if (!fileInput.trim()) return;
    setTxStatus("Saving file...");
    try {
      await saveFile(fileInput.trim());
      setTxStatus("File saved on-chain.");
      setFileInput("");
      await loadAll();
    } catch (e) {
      setTxStatus(`Error: ${e.message}`);
    }
  }

  async function handleDeleteFile(index) {
    setTxStatus(`Deleting file at index ${index}...`);
    try {
      await deleteFile(index);
      setTxStatus("File deleted.");
      await loadAll();
    } catch (e) {
      setTxStatus(`Error: ${e.message}`);
    }
  }

  async function handleMint() {
    setTxStatus(`Minting ${mintAmount} PPT...`);
    try {
      await mintToken(mintAmount);
      setTxStatus(`Minted ${mintAmount} PPT!`);
      await loadAll();
    } catch (e) {
      setTxStatus(`Error: ${e.message}`);
    }
  }

  // ── Render: not connected ─────────────────────────────────────
  if (!isConnected) {
    return (
      <div style={styles.card}>
        <h2 style={styles.title}>PPT Invoice</h2>
        <p style={styles.muted}>Connect your wallet to continue.</p>
      </div>
    );
  }

  // ── Render: wrong chain ───────────────────────────────────────
  if (!isChainSupported) {
    return (
      <div style={styles.card}>
        <h2 style={styles.title}>Unsupported network</h2>
        <p style={styles.muted}>Switch to a supported chain:</p>
        <div style={styles.chipRow}>
          {SUPPORTED_CHAIN_IDS.map((id) => (
            <button
              key={id}
              style={styles.chip}
              onClick={() => switchChain({ chainId: id })}
            >
              {PPT_CHAINS[id].name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Render: main UI ───────────────────────────────────────────
  const cfg = PPT_CHAINS[chainId];

  return (
    <div style={styles.wrap}>

      {/* Header */}
      <div style={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={styles.title}>PPT Invoice</h2>
          <span style={styles.badge}>{cfg.name}</span>
        </div>
        <p style={styles.muted}>
          {address?.slice(0, 6)}...{address?.slice(-4)}
          {" · "}
          <strong>{balance?.formatted ?? "..."} PPT</strong>
        </p>
        {txStatus && <p style={styles.status}>{txStatus}</p>}
        {error    && <p style={styles.error}>{error}</p>}
      </div>

      {/* Subscription */}
      <div style={styles.card}>
        <h3 style={styles.section}>Subscription</h3>
        {subscription?.isSubscribed ? (
          <>
            <p style={{ color: "#1D9E75" }}>
              Active until {subscription.endDate?.toLocaleDateString()}
            </p>
          </>
        ) : subscription?.endTime > 0 ? (
          <>
            <p style={styles.muted}>Subscription expired.</p>
            <button style={styles.btn} onClick={handleRenew} disabled={loading}>
              {loading ? "..." : "Renew (get 10 PPT)"}
            </button>
          </>
        ) : (
          <>
            <p style={styles.muted}>No subscription. Subscribe to get 10 PPT + access.</p>
            <button style={styles.btn} onClick={handleSubscribe} disabled={loading}>
              {loading ? "..." : "Subscribe (get 10 PPT)"}
            </button>
          </>
        )}
      </div>

      {/* File management */}
      <div style={styles.card}>
        <h3 style={styles.section}>Invoice Files</h3>
        <div style={styles.row}>
          <input
            style={styles.input}
            placeholder="IPFS CID or file reference..."
            value={fileInput}
            onChange={(e) => setFileInput(e.target.value)}
          />
          <button style={styles.btn} onClick={handleSaveFile} disabled={loading || !fileInput}>
            {loading ? "..." : "Save"}
          </button>
        </div>
        {files.length === 0 ? (
          <p style={styles.muted}>No files saved yet.</p>
        ) : (
          <ul style={styles.list}>
            {files.map((f, i) => (
              <li key={i} style={styles.listItem}>
                <span style={styles.fileRef}>{f}</span>
                <button
                  style={styles.deleteBtn}
                  onClick={() => handleDeleteFile(i)}
                  disabled={loading}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Mint tokens */}
      {subscription?.isSubscribed && (
        <div style={styles.card}>
          <h3 style={styles.section}>Mint PPT</h3>
          {mintStats && (
            <p style={styles.muted}>
              {mintStats.minted} / {mintStats.cap} PPT minted globally
              ({mintStats.remaining} remaining)
            </p>
          )}
          <div style={styles.row}>
            <input
              style={{ ...styles.input, maxWidth: 120 }}
              type="number"
              min="1"
              max="100"
              value={mintAmount}
              onChange={(e) => setMintAmount(e.target.value)}
            />
            <button style={styles.btn} onClick={handleMint} disabled={loading}>
              {loading ? "..." : `Mint ${mintAmount} PPT`}
            </button>
          </div>
          <p style={styles.muted}>Max 100 PPT per transaction.</p>
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const styles = {
  wrap:     { display: "flex", flexDirection: "column", gap: 16, maxWidth: 600, margin: "0 auto", padding: 16 },
  card:     { background: "var(--color-background-secondary, #f9f9f9)", borderRadius: 12, padding: "20px 24px", border: "1px solid var(--color-border-tertiary, #e5e5e5)" },
  title:    { margin: "0 0 4px", fontSize: 20, fontWeight: 500 },
  section:  { margin: "0 0 12px", fontSize: 16, fontWeight: 500 },
  muted:    { color: "#888", fontSize: 14, margin: "4px 0" },
  status:   { background: "#e6f7f1", color: "#0F6E56", borderRadius: 6, padding: "8px 12px", fontSize: 13, marginTop: 8 },
  error:    { background: "#fdecea", color: "#A32D2D", borderRadius: 6, padding: "8px 12px", fontSize: 13, marginTop: 8 },
  badge:    { background: "#EEEDFE", color: "#3C3489", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 500 },
  btn:      { background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontSize: 14, fontWeight: 500 },
  deleteBtn:{ background: "transparent", color: "#A32D2D", border: "1px solid #A32D2D", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12 },
  input:    { flex: 1, border: "1px solid #ddd", borderRadius: 8, padding: "10px 14px", fontSize: 14, outline: "none" },
  row:      { display: "flex", gap: 8, alignItems: "center", marginBottom: 12 },
  list:     { listStyle: "none", padding: 0, margin: 0 },
  listItem: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #eee" },
  fileRef:  { fontSize: 13, color: "#444", fontFamily: "monospace", maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis" },
  chipRow:  { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip:     { background: "#EEEDFE", color: "#3C3489", border: "none", borderRadius: 20, padding: "6px 14px", cursor: "pointer", fontSize: 13 },
};
