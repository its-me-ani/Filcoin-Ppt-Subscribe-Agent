import React, { useState, useRef, useEffect } from "react";
import {
  IonPopover,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonToast,
  IonBadge,
} from "@ionic/react";
import {
  addOutline,
  arrowUndo,
  arrowRedo,
  colorPaletteOutline,
  cloudDownloadOutline,
  walletOutline,
} from "ionicons/icons";
import * as AppGeneral from "../socialcalc/index.js";

// import { DATA } from "../../templates.js";
import { useInvoice } from "../../../contexts/InvoiceContext.js";
import { useWallet } from "../../../contexts/WalletContext";

import { localTemplateService } from "../../../services/local-template-service";
import BlockchainFilesModal from "../BlockchainFilesModal";


interface FileOptionsProps {
  showActionsPopover: boolean;
  setShowActionsPopover: (show: boolean) => void;
  showColorModal: boolean;
  setShowColorPicker: (show: boolean) => void;
  fileName: string;
}

const FileOptions: React.FC<FileOptionsProps> = ({
  showActionsPopover,
  setShowActionsPopover,
  setShowColorPicker,
}) => {

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const actionsPopoverRef = useRef<HTMLIonPopoverElement>(null);
  const [showBlockchainFiles, setShowBlockchainFiles] = useState(false);

  // Template modal state
  const {
    activeTemplateId, // Get from context
  } = useInvoice();

  const {
    isConnected,
    truncatedAddress,
    tokenBalance,
    connectWallet,
    isConnecting,
  } = useWallet();



  const handleUndo = () => {
    AppGeneral.undo();
  };

  const handleRedo = () => {
    AppGeneral.redo();
  };

  const handleNewFileClick = async () => {
    setShowActionsPopover(false);

    // Redirect using window.location.href instead of history hook
    try {
      let templateId = activeTemplateId;
      if (!templateId) {
        templateId = await localTemplateService.getActiveTemplateId();
      }

      if (templateId) {
        window.location.href = `/app/editor/invoice?template=${templateId}`;
      } else {
        window.location.href = '/app/dashboard/templates';
      }
    } catch (e) {
      window.location.href = '/app/dashboard/templates';
    }
  };

  const handleLoadFromBlockchain = () => {
    setShowActionsPopover(false);
    if (!isConnected) {
      connectWallet();
      return;
    }
    setShowBlockchainFiles(true);
  };

  const handleLoadBlockchainFile = (content: string, index: number) => {
    try {
      // Decode the content if it was URL-encoded
      let decodedContent = content;
      try {
        decodedContent = decodeURIComponent(content);
      } catch {
        // Not encoded, use as-is
      }

      // Load into the editor
      const currentControl = AppGeneral.getWorkbookInfo();
      if (currentControl && currentControl.workbook) {
        AppGeneral.viewFile(`blockchain-${index}`, decodedContent);
      } else {
        AppGeneral.initializeApp(decodedContent);
      }

      setToastMessage(`Loaded on-chain file #${index + 1}`);
      setShowToast(true);
    } catch (e) {
      console.error("Failed to load blockchain file:", e);
      setToastMessage("Failed to load file from blockchain");
      setShowToast(true);
    }
  };

  const handleWalletClick = async () => {
    setShowActionsPopover(false);
    if (!isConnected) {
      await connectWallet();
    }
    // If already connected, the WalletBadge in the header handles the popover
  };

  const balanceNum = parseFloat(tokenBalance);

  return (
    <>
      {/* Actions Popover */}
      <IonPopover
        ref={actionsPopoverRef}
        isOpen={showActionsPopover}
        onDidDismiss={() => setShowActionsPopover(false)}
        trigger="actions-trigger"
        side="bottom"
        alignment="end"
        style={{
          '--width': 'auto',
          '--min-width': '200px',
          '--max-width': '280px',
        } as React.CSSProperties}
      >
        <IonContent className="ion-padding-vertical" style={{ '--background': '#ffffff' }}>
          <IonList lines="none" style={{ padding: '0' }}>
            <IonItem button onClick={handleNewFileClick} detail={false}>
              <IonIcon icon={addOutline} slot="start" />
              <IonLabel>New</IonLabel>
            </IonItem>



            <IonItem button onClick={handleUndo} detail={false}>
              <IonIcon icon={arrowUndo} slot="start" />
              <IonLabel>Undo</IonLabel>
            </IonItem>

            <IonItem button onClick={handleRedo} detail={false}>
              <IonIcon icon={arrowRedo} slot="start" />
              <IonLabel>Redo</IonLabel>
            </IonItem>

            <IonItem button onClick={() => setShowColorPicker(true)} detail={false}>
              <IonIcon icon={colorPaletteOutline} slot="start" />
              <IonLabel>Sheet Colors</IonLabel>
            </IonItem>

            {/* Divider */}
            <div style={{ height: '1px', background: '#e0e0e0', margin: '4px 16px' }} />

            {/* Blockchain Items */}
            <IonItem button onClick={handleLoadFromBlockchain} detail={false}>
              <IonIcon icon={cloudDownloadOutline} slot="start" style={{ color: '#667eea' }} />
              <IonLabel>
                <span>Load from Blockchain</span>
              </IonLabel>
            </IonItem>

            <IonItem button onClick={handleWalletClick} detail={false}>
              <IonIcon icon={walletOutline} slot="start" style={{ color: isConnected ? '#2dd36f' : '#666' }} />
              <IonLabel>
                <span>{isConnected ? truncatedAddress : 'Connect Wallet'}</span>
                {isConnected && (
                  <span style={{ fontSize: '11px', color: '#888', marginLeft: '6px' }}>
                    {balanceNum.toFixed(0)} PPT
                  </span>
                )}
              </IonLabel>
            </IonItem>
          </IonList>
        </IonContent>
      </IonPopover>

      {/* Blockchain Files Modal */}
      <BlockchainFilesModal
        isOpen={showBlockchainFiles}
        onClose={() => setShowBlockchainFiles(false)}
        onLoadFile={handleLoadBlockchainFile}
      />

      {/* Toast for notifications */}
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

export default FileOptions;
