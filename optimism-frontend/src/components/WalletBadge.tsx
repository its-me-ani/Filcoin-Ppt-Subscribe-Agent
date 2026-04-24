/**
 * WalletBadge — Compact wallet connection indicator for headers
 * ==============================================================
 * Shows truncated address + PPT balance when connected,
 * or "Connect" button when disconnected.
 */

import React, { useState } from "react";
import {
  IonButton,
  IonIcon,
  IonPopover,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonSpinner,
  IonBadge,
  IonChip,
} from "@ionic/react";
import {
  walletOutline,
  logOutOutline,
  refreshOutline,
  openOutline,
  shieldCheckmarkOutline,
  warningOutline,
} from "ionicons/icons";
import { useWallet } from "../contexts/WalletContext";
import { getAddressExplorerUrl } from "../services/blockchain";

interface WalletBadgeProps {
  color?: string;
  showInHeader?: boolean;
}

const WalletBadge: React.FC<WalletBadgeProps> = ({
  color = "white",
  showInHeader = true,
}) => {
  const {
    walletAddress,
    isConnected,
    isMetaMaskAvailable,
    tokenBalance,
    isSubscribed,
    daysUntilExpiry,
    isConnecting,
    isLoading,
    connectWallet,
    disconnectWallet,
    refreshAll,
    truncatedAddress,
  } = useWallet();

  const [showPopover, setShowPopover] = useState(false);

  // ─── Not connected state ──────────────────────────────────────────────
  if (!isConnected) {
    return (
      <IonButton
        fill="clear"
        size="small"
        onClick={connectWallet}
        disabled={isConnecting || !isMetaMaskAvailable}
        style={{
          color,
          fontSize: "12px",
          "--padding-start": "8px",
          "--padding-end": "8px",
        }}
      >
        {isConnecting ? (
          <IonSpinner name="dots" style={{ width: "16px", height: "16px" }} />
        ) : (
          <>
            <IonIcon icon={walletOutline} slot="start" style={{ fontSize: "16px", marginRight: "4px" }} />
            {isMetaMaskAvailable ? "Connect" : "No Wallet"}
          </>
        )}
      </IonButton>
    );
  }

  // ─── Connected state ──────────────────────────────────────────────────

  // Parse balance for display
  const balanceNum = parseFloat(tokenBalance);
  const displayBalance = balanceNum > 1000
    ? `${(balanceNum / 1000).toFixed(1)}K`
    : balanceNum > 0
    ? balanceNum.toFixed(balanceNum < 10 ? 2 : 0)
    : "0";

  return (
    <>
      <IonChip
        id="wallet-badge-trigger"
        onClick={() => setShowPopover(true)}
        style={{
          "--background": "rgba(255,255,255,0.15)",
          "--color": color,
          height: "30px",
          fontSize: "11px",
          fontWeight: "600",
          cursor: "pointer",
          margin: "0 4px",
          border: `1px solid rgba(255,255,255,0.25)`,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {isSubscribed && (
            <IonIcon
              icon={shieldCheckmarkOutline}
              style={{ fontSize: "13px", color: "#2dd36f" }}
            />
          )}
          <span>{truncatedAddress}</span>
          <span style={{ opacity: 0.7, marginLeft: "2px" }}>
            {displayBalance} PPT
          </span>
        </span>
      </IonChip>

      {/* Wallet Details Popover */}
      <IonPopover
        isOpen={showPopover}
        onDidDismiss={() => setShowPopover(false)}
        trigger="wallet-badge-trigger"
        side="bottom"
        alignment="end"
        style={{
          "--width": "280px",
          "--max-width": "90vw",
        } as React.CSSProperties}
      >
        <IonContent className="ion-padding" style={{ "--background": "#ffffff" }}>
          {/* Header */}
          <div style={{ marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: "700", fontSize: "14px", color: "#1a1a2e" }}>
                Wallet
              </span>
              {isLoading && (
                <IonSpinner name="dots" style={{ width: "16px", height: "16px" }} />
              )}
            </div>
            <div style={{ fontSize: "12px", color: "#666", marginTop: "4px", fontFamily: "monospace" }}>
              {walletAddress}
            </div>
          </div>

          {/* Balance Card */}
          <div
            style={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              borderRadius: "12px",
              padding: "16px",
              color: "#fff",
              marginBottom: "12px",
            }}
          >
            <div style={{ fontSize: "11px", opacity: 0.8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              PPT Token Balance
            </div>
            <div style={{ fontSize: "22px", fontWeight: "700", marginTop: "4px" }}>
              {parseFloat(tokenBalance).toLocaleString(undefined, { maximumFractionDigits: 2 })} PPT
            </div>
          </div>

          {/* Subscription Status */}
          <div
            style={{
              background: isSubscribed ? "#f0fdf4" : "#fefce8",
              border: `1px solid ${isSubscribed ? "#bbf7d0" : "#fef08a"}`,
              borderRadius: "10px",
              padding: "12px",
              marginBottom: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <IonIcon
                icon={isSubscribed ? shieldCheckmarkOutline : warningOutline}
                style={{
                  fontSize: "18px",
                  color: isSubscribed ? "#16a34a" : "#ca8a04",
                }}
              />
              <span style={{ fontWeight: "600", fontSize: "13px", color: isSubscribed ? "#16a34a" : "#ca8a04" }}>
                {isSubscribed ? "Active Subscription" : "No Subscription"}
              </span>
            </div>
            {isSubscribed && daysUntilExpiry !== null && (
              <div style={{ fontSize: "12px", color: "#666", marginTop: "4px", marginLeft: "24px" }}>
                {daysUntilExpiry} days remaining
              </div>
            )}
            {!isSubscribed && (
              <div style={{ fontSize: "12px", color: "#92400e", marginTop: "4px", marginLeft: "24px" }}>
                Subscribe for 10 PPT / year
              </div>
            )}
          </div>

          {/* Actions */}
          <IonList lines="none" style={{ padding: 0 }}>
            <IonItem
              button
              detail={false}
              onClick={() => {
                refreshAll();
                setShowPopover(false);
              }}
            >
              <IonIcon icon={refreshOutline} slot="start" style={{ fontSize: "18px" }} />
              <IonLabel style={{ fontSize: "13px" }}>Refresh</IonLabel>
            </IonItem>

            <IonItem
              button
              detail={false}
              onClick={() => {
                if (walletAddress) {
                  window.open(getAddressExplorerUrl(walletAddress), "_blank");
                }
                setShowPopover(false);
              }}
            >
              <IonIcon icon={openOutline} slot="start" style={{ fontSize: "18px" }} />
              <IonLabel style={{ fontSize: "13px" }}>View on Explorer</IonLabel>
            </IonItem>

            <IonItem
              button
              detail={false}
              onClick={() => {
                disconnectWallet();
                setShowPopover(false);
              }}
              style={{ "--color": "#ef4444" } as React.CSSProperties}
            >
              <IonIcon icon={logOutOutline} slot="start" style={{ fontSize: "18px", color: "#ef4444" }} />
              <IonLabel style={{ fontSize: "13px", color: "#ef4444" }}>Disconnect</IonLabel>
            </IonItem>
          </IonList>
        </IonContent>
      </IonPopover>
    </>
  );
};

export default WalletBadge;
