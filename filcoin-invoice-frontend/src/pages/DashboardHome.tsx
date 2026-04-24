import React, { useState, useEffect } from 'react';
import {
    IonContent,
    IonPage,
    IonSpinner,
    IonGrid,
    IonRow,
    IonCol,
    IonCard,
    IonCardHeader,
    IonCardSubtitle,
    IonCardTitle,
    IonIcon,
    IonButton,
    IonBadge,
    IonToast,
} from '@ionic/react';
import {
    documentTextOutline,
    walletOutline,
    cubeOutline,
    shieldCheckmarkOutline,
    flashOutline,
    linkOutline,
} from 'ionicons/icons';

import { useInvoice } from '../contexts/InvoiceContext';
import { useWallet } from '../contexts/WalletContext';

import { parseInvoiceData, InvoiceAnalytics } from '../utils/invoiceAnalytics';
import { localTemplateService } from '../services/local-template-service';
import Files from '../components/Files/Files';
import { showBannerAd, hideBannerAd } from '../services/admob-service';
import {
    getFilesFromChain,
    subscribe as blockchainSubscribe,
    truncateAddress,
    getAddressExplorerUrl,
} from '../services/blockchain';

const DashboardHome: React.FC = () => {

    const { selectedFile, updateSelectedFile, updateBillType, currency } = useInvoice();
    const {
        isConnected,
        walletAddress,
        tokenBalance,
        isSubscribed,
        daysUntilExpiry,
        isConnecting,
        isMetaMaskAvailable,
        connectWallet,
        refreshAll,
        truncatedAddress,
    } = useWallet();


    const [analytics, setAnalytics] = useState<InvoiceAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [onChainCount, setOnChainCount] = useState<number | null>(null);
    const [subscribing, setSubscribing] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastColor, setToastColor] = useState<'success' | 'danger' | 'warning'>('success');

    // Load data
    useEffect(() => {
        loadData();
    }, []);

    // Load on-chain file count when wallet connects
    useEffect(() => {
        if (isConnected) {
            loadOnChainCount();
        }
    }, [isConnected]);

    // AdMob banner ad
    useEffect(() => {
        showBannerAd();
        return () => {
            hideBannerAd();
        };
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch all local invoices directly
            const allFiles = await localTemplateService.getSavedInvoices();

            // Calculate analytics from the same files source
            let data = parseInvoiceData(allFiles);

            setAnalytics(data);
        } catch (error) {
            console.error("Error loading dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    const loadOnChainCount = async () => {
        try {
            const files = await getFilesFromChain();
            setOnChainCount(files.length);
        } catch {
            setOnChainCount(null);
        }
    };

    const handleSubscribe = async () => {
        setSubscribing(true);
        try {
            const txHash = await blockchainSubscribe();
            setToastMessage(`Subscribed! Tx: ${txHash.slice(0, 10)}...`);
            setToastColor('success');
            setShowToast(true);
            refreshAll();
        } catch (e: any) {
            setToastMessage(e?.reason || e?.message || 'Subscription failed');
            setToastColor('danger');
            setShowToast(true);
        } finally {
            setSubscribing(false);
        }
    };

    if (loading) {
        return (
            <IonPage>
                <IonContent fullscreen className="ion-padding">
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                        <IonSpinner />
                    </div>
                </IonContent>
            </IonPage>
        );
    }

    const balanceNum = parseFloat(tokenBalance);

    return (
        <IonPage>
            <IonContent fullscreen>
                <div className="dashboard-home-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 16px', paddingTop: '24px' }}>

                    {/* Stats Section */}
                    <IonGrid className="ion-no-padding" style={{ marginBottom: '24px' }}>
                        <IonRow>
                            <IonCol size="6">
                                <IonCard style={{ margin: '0 8px 0 0', height: '100%', boxShadow: 'none', border: '1px solid var(--ion-color-step-150, #e0e0e0)' }}>
                                    <IonCardHeader>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <IonCardSubtitle style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: '600', letterSpacing: '0.05em' }}>Total Invoices</IonCardSubtitle>
                                            <IonIcon icon={documentTextOutline} style={{ fontSize: '20px', color: 'var(--ion-color-primary)', opacity: 0.8 }} />
                                        </div>
                                        <IonCardTitle style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '4px' }}>
                                            {analytics?.totalInvoices || 0}
                                        </IonCardTitle>
                                    </IonCardHeader>
                                </IonCard>
                            </IonCol>
                            <IonCol size="6">
                                <IonCard style={{ margin: '0 0 0 8px', height: '100%', boxShadow: 'none', border: '1px solid var(--ion-color-step-150, #e0e0e0)' }}>
                                    <IonCardHeader>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <IonCardSubtitle style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: '600', letterSpacing: '0.05em' }}>Total Revenue</IonCardSubtitle>
                                            <IonIcon icon={walletOutline} style={{ fontSize: '20px', color: 'var(--ion-color-success)', opacity: 0.8 }} />
                                        </div>
                                        <IonCardTitle style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '4px' }}>
                                            {new Intl.NumberFormat(undefined, {
                                                style: 'currency',
                                                currency: currency || 'INR',
                                                minimumFractionDigits: 0,
                                                maximumFractionDigits: 0
                                            }).format(analytics?.totalRevenue || 0)}
                                        </IonCardTitle>
                                    </IonCardHeader>
                                </IonCard>
                            </IonCol>
                        </IonRow>
                    </IonGrid>

                    {/* Blockchain Section */}
                    <IonCard style={{ margin: '0 0 24px 0', boxShadow: 'none', border: '1px solid var(--ion-color-step-150, #e0e0e0)' }}>
                        <IonCardHeader>
                            {!isConnected ? (
                                /* Not Connected State */
                                <div style={{ textAlign: 'center', padding: '8px 0' }}>
                                    <IonIcon
                                        icon={linkOutline}
                                        style={{ fontSize: '32px', marginBottom: '8px', color: 'var(--ion-color-primary)' }}
                                    />
                                    <IonCardSubtitle style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: '600', letterSpacing: '0.05em', marginBottom: '8px' }}>
                                        Blockchain Integration
                                    </IonCardSubtitle>
                                    <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--ion-color-medium)' }}>
                                        Connect your wallet to save invoices on-chain & manage PPT tokens
                                    </p>
                                    <IonButton
                                        onClick={connectWallet}
                                        disabled={isConnecting || !isMetaMaskAvailable}
                                        fill="outline"
                                        style={{ fontWeight: '600', fontSize: '13px' }}
                                    >
                                        {isConnecting ? (
                                            <IonSpinner name="dots" style={{ width: '18px', height: '18px' }} />
                                        ) : (
                                            <>
                                                <IonIcon icon={walletOutline} slot="start" />
                                                {isMetaMaskAvailable ? 'Connect Wallet' : 'Install MetaMask'}
                                            </>
                                        )}
                                    </IonButton>
                                </div>
                            ) : (
                                /* Connected State */
                                <div>
                                    {/* Header Row */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                        <div>
                                            <IonCardSubtitle style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: '600', letterSpacing: '0.05em' }}>
                                                Connected Wallet
                                            </IonCardSubtitle>
                                            <div
                                                style={{ fontSize: '14px', fontWeight: '600', fontFamily: 'monospace', cursor: 'pointer', color: 'var(--ion-color-primary)', marginTop: '4px' }}
                                                onClick={() => walletAddress && window.open(getAddressExplorerUrl(walletAddress), '_blank')}
                                            >
                                                {truncatedAddress}
                                                <IonIcon icon={linkOutline} style={{ fontSize: '12px', marginLeft: '4px', verticalAlign: 'middle' }} />
                                            </div>
                                        </div>
                                        {isSubscribed && (
                                            <IonBadge style={{
                                                '--background': 'var(--ion-color-success)',
                                                fontSize: '11px',
                                                padding: '4px 10px',
                                                borderRadius: '20px',
                                            } as React.CSSProperties}>
                                                <IonIcon icon={shieldCheckmarkOutline} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                                Subscribed
                                                {daysUntilExpiry !== null && ` · ${daysUntilExpiry}d`}
                                            </IonBadge>
                                        )}
                                    </div>

                                    {/* Stats Row */}
                                    <IonGrid className="ion-no-padding">
                                        <IonRow>
                                            <IonCol size="4">
                                                <div style={{
                                                    background: 'var(--ion-color-light, #f4f5f8)',
                                                    borderRadius: '8px',
                                                    padding: '12px 10px',
                                                    textAlign: 'center',
                                                }}>
                                                    <div style={{ fontSize: '10px', color: 'var(--ion-color-medium)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>PPT Balance</div>
                                                    <div style={{ fontSize: '18px', fontWeight: '700', marginTop: '2px', color: 'var(--ion-color-dark)' }}>
                                                        {balanceNum > 1000 ? `${(balanceNum / 1000).toFixed(1)}K` : balanceNum.toFixed(0)}
                                                    </div>
                                                </div>
                                            </IonCol>
                                            <IonCol size="4" style={{ padding: '0 4px' }}>
                                                <div style={{
                                                    background: 'var(--ion-color-light, #f4f5f8)',
                                                    borderRadius: '8px',
                                                    padding: '12px 10px',
                                                    textAlign: 'center',
                                                }}>
                                                    <div style={{ fontSize: '10px', color: 'var(--ion-color-medium)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>On-Chain</div>
                                                    <div style={{ fontSize: '18px', fontWeight: '700', marginTop: '2px', color: 'var(--ion-color-dark)' }}>
                                                        {onChainCount !== null ? onChainCount : '—'}
                                                    </div>
                                                </div>
                                            </IonCol>
                                            <IonCol size="4">
                                                <div style={{
                                                    background: 'var(--ion-color-light, #f4f5f8)',
                                                    borderRadius: '8px',
                                                    padding: '12px 10px',
                                                    textAlign: 'center',
                                                }}>
                                                    <div style={{ fontSize: '10px', color: 'var(--ion-color-medium)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Network</div>
                                                    <div style={{ fontSize: '12px', fontWeight: '600', marginTop: '4px', color: 'var(--ion-color-dark)' }}>
                                                        FIL Cal
                                                    </div>
                                                </div>
                                            </IonCol>
                                        </IonRow>
                                    </IonGrid>

                                    {/* Subscribe Button (if not subscribed) */}
                                    {!isSubscribed && (
                                        <IonButton
                                            expand="block"
                                            onClick={handleSubscribe}
                                            disabled={subscribing || balanceNum < 10}
                                            fill="outline"
                                            color="primary"
                                            style={{
                                                marginTop: '16px',
                                                fontWeight: '600',
                                                fontSize: '13px',
                                            } as React.CSSProperties}
                                        >
                                            {subscribing ? (
                                                <IonSpinner name="dots" style={{ width: '18px', height: '18px' }} />
                                            ) : (
                                                <>
                                                    <IonIcon icon={flashOutline} slot="start" />
                                                    Subscribe (10 PPT / year)
                                                </>
                                            )}
                                        </IonButton>
                                    )}
                                </div>
                            )}
                        </IonCardHeader>
                    </IonCard>

                    {/* Invoice List */}
                    <div style={{ marginTop: "24px" }}>
                        <Files
                            file={selectedFile}
                            updateSelectedFile={updateSelectedFile}
                            updateBillType={updateBillType}
                            onDataChange={loadData}
                        />
                    </div>

                    {/* Bottom padding for AdMob banner */}
                    <div style={{ height: '60px' }} />
                </div>
            </IonContent>

            <IonToast
                isOpen={showToast}
                message={toastMessage}
                duration={3000}
                color={toastColor}
                onDidDismiss={() => setShowToast(false)}
                position="bottom"
            />
        </IonPage>
    );
};

export default DashboardHome;
