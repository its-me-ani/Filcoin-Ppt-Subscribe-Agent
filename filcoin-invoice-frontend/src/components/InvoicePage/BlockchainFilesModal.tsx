/**
 * BlockchainFilesModal — List and load on-chain invoice files (IPFS-backed)
 * ==========================================================================
 * Fetches CIDs from MedInvoiceContract, resolves content from Pinata IPFS,
 * and allows loading them into the editor.
 */

import React, { useState, useEffect } from "react";
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonButtons,
  IonIcon,
  IonSpinner,
  IonBadge,
  IonToast,
  IonChip,
} from "@ionic/react";
import {
  closeOutline,
  cloudDownloadOutline,
  documentTextOutline,
  cubeOutline,
  refreshOutline,
  walletOutline,
  linkOutline,
  alertCircleOutline,
} from "ionicons/icons";
import { useWallet } from "../../contexts/WalletContext";
import {
  getFilesFromChain,
  getIPFSUrl,
  type BlockchainIPFSFile,
} from "../../services/blockchain";

interface BlockchainFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadFile: (content: string, index: number) => void;
}

const BlockchainFilesModal: React.FC<BlockchainFilesModalProps> = ({
  isOpen,
  onClose,
  onLoadFile,
}) => {
  const { isConnected, connectWallet, isConnecting, tokenBalance } = useWallet();

  const [files, setFiles] = useState<BlockchainIPFSFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Fetch files when modal opens and wallet is connected
  useEffect(() => {
    if (isOpen && isConnected) {
      fetchFiles();
    }
  }, [isOpen, isConnected]);

  const fetchFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const chainFiles = await getFilesFromChain();
      setFiles(chainFiles.reverse()); // newest first
    } catch (e: any) {
      const message = e?.reason || e?.message || "Failed to fetch files from blockchain";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadFile = (file: BlockchainIPFSFile) => {
    if (!file.content) {
      setToastMessage("File content not available (IPFS fetch failed)");
      setShowToast(true);
      return;
    }

    setLoadingIndex(file.index);
    try {
      onLoadFile(file.content, file.index);
      setToastMessage(`File #${file.index + 1} loaded from IPFS`);
      setShowToast(true);
      onClose();
    } catch (e: any) {
      setToastMessage("Failed to load file");
      setShowToast(true);
    } finally {
      setLoadingIndex(null);
    }
  };

  return (
    <>
      <IonModal isOpen={isOpen} onDidDismiss={onClose}>
        <IonHeader>
          <IonToolbar color="primary">
            <IonTitle style={{ fontSize: "16px" }}>
              <IonIcon icon={cubeOutline} style={{ marginRight: "8px", verticalAlign: "middle" }} />
              On-Chain Invoices (IPFS)
            </IonTitle>
            <IonButtons slot="end">
              {isConnected && (
                <IonButton onClick={fetchFiles} disabled={loading}>
                  <IonIcon icon={refreshOutline} />
                </IonButton>
              )}
              <IonButton onClick={onClose}>
                <IonIcon icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>

        <IonContent>
          {/* Not connected */}
          {!isConnected && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "60%",
                padding: "40px 20px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "20px",
                }}
              >
                <IonIcon icon={walletOutline} style={{ fontSize: "36px", color: "#fff" }} />
              </div>
              <h2 style={{ fontSize: "20px", fontWeight: "600", margin: "0 0 8px 0" }}>
                Connect Your Wallet
              </h2>
              <p style={{ color: "#666", fontSize: "14px", margin: "0 0 24px 0", maxWidth: "300px" }}>
                Connect MetaMask to access your on-chain invoices stored via IPFS. You need at least 1 PPT token.
              </p>
              <IonButton
                onClick={connectWallet}
                disabled={isConnecting}
                style={{ "--border-radius": "12px" } as React.CSSProperties}
              >
                {isConnecting ? (
                  <IonSpinner name="dots" />
                ) : (
                  <>
                    <IonIcon icon={walletOutline} slot="start" />
                    Connect MetaMask
                  </>
                )}
              </IonButton>
            </div>
          )}

          {/* Loading */}
          {isConnected && loading && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "60%",
                gap: "16px",
              }}
            >
              <IonSpinner name="crescent" style={{ width: "42px", height: "42px" }} />
              <p style={{ color: "#666", fontSize: "14px" }}>Fetching CIDs from chain & resolving from IPFS...</p>
            </div>
          )}

          {/* Error */}
          {isConnected && error && !loading && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "60%",
                padding: "40px 20px",
                textAlign: "center",
              }}
            >
              <p style={{ color: "#ef4444", fontSize: "14px", marginBottom: "16px" }}>{error}</p>
              <IonButton fill="outline" onClick={fetchFiles}>
                <IonIcon icon={refreshOutline} slot="start" />
                Retry
              </IonButton>
            </div>
          )}

          {/* Files List */}
          {isConnected && !loading && !error && (
            <>
              {files.length === 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "60%",
                    padding: "40px 20px",
                    textAlign: "center",
                  }}
                >
                  <IonIcon
                    icon={documentTextOutline}
                    style={{ fontSize: "64px", color: "#ccc", marginBottom: "16px" }}
                  />
                  <h3 style={{ margin: "0 0 8px 0", color: "#333" }}>No Files Yet</h3>
                  <p style={{ color: "#666", fontSize: "14px" }}>
                    Save an invoice via the Share menu → "Save to Blockchain" to pin it on IPFS.
                  </p>
                </div>
              ) : (
                <>
                  {/* Stats Bar */}
                  <div
                    style={{
                      padding: "12px 16px",
                      background: "#f8f9fa",
                      borderBottom: "1px solid #e0e0e0",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: "13px", fontWeight: "600", color: "#333" }}>
                      {files.length} file{files.length !== 1 ? "s" : ""} on-chain
                    </span>
                    <IonBadge
                      style={{
                        "--background": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        fontSize: "11px",
                        padding: "4px 10px",
                        borderRadius: "12px",
                      }}
                    >
                      {parseFloat(tokenBalance).toFixed(0)} PPT
                    </IonBadge>
                  </div>

                  <IonList>
                    {files.map((file) => (
                      <IonItem key={file.index} lines="full">
                        <IonIcon
                          icon={file.fetchError ? alertCircleOutline : documentTextOutline}
                          slot="start"
                          style={{
                            color: file.fetchError ? "#f59e0b" : "#667eea",
                            fontSize: "22px",
                          }}
                        />
                        <IonLabel>
                          <h3 style={{ fontWeight: "600", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                            {file.metadata?.invoiceId
                              ? `Invoice: ${file.metadata.invoiceId}`
                              : `Invoice #${file.index + 1}`}
                          </h3>

                          {/* CID */}
                          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "3px" }}>
                            <span style={{ fontSize: "11px", color: "#888", fontFamily: "monospace" }}>
                              CID: {file.cid.slice(0, 16)}...
                            </span>
                            <IonIcon
                              icon={linkOutline}
                              style={{ fontSize: "12px", color: "#667eea", cursor: "pointer" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(file.ipfsUrl, "_blank");
                              }}
                            />
                          </div>

                          {/* Status */}
                          {file.fetchError ? (
                            <p style={{ fontSize: "12px", color: "#f59e0b", marginTop: "2px" }}>
                              ⚠ IPFS fetch failed: {file.fetchError.slice(0, 50)}
                            </p>
                          ) : (
                            <p style={{ fontSize: "11px", color: "#aaa", marginTop: "2px" }}>
                              {file.metadata?.timestamp
                                ? new Date(file.metadata.timestamp).toLocaleString()
                                : ""}
                              {file.content ? ` · ${(file.content.length / 1024).toFixed(1)} KB` : ""}
                            </p>
                          )}
                        </IonLabel>
                        <IonButton
                          fill="outline"
                          size="small"
                          slot="end"
                          onClick={() => handleLoadFile(file)}
                          disabled={loadingIndex === file.index || !!file.fetchError}
                          style={{ "--border-radius": "8px" } as React.CSSProperties}
                        >
                          {loadingIndex === file.index ? (
                            <IonSpinner name="dots" style={{ width: "16px", height: "16px" }} />
                          ) : (
                            <>
                              <IonIcon icon={cloudDownloadOutline} slot="start" />
                              Load
                            </>
                          )}
                        </IonButton>
                      </IonItem>
                    ))}
                  </IonList>
                </>
              )}
            </>
          )}
        </IonContent>
      </IonModal>

      <IonToast
        isOpen={showToast}
        message={toastMessage}
        duration={3000}
        onDidDismiss={() => setShowToast(false)}
        position="bottom"
      />
    </>
  );
};

export default BlockchainFilesModal;

