import { AdMob, BannerAdOptions, BannerAdSize, BannerAdPosition, BannerAdPluginEvents, AdOptions, InterstitialAdPluginEvents } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

// Google AdMob Test IDs
// See: https://developers.google.com/admob/android/test-ads
const TEST_BANNER_ID = 'ca-app-pub-3940256099942544/9214589741';
const TEST_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';

let isInitialized = false;
let isBannerShowing = false;
let isInterstitialLoaded = false;

/**
 * Initialize AdMob. Should be called once at app startup.
 */
export const initializeAdMob = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  if (isInitialized) return;

  try {
    await AdMob.initialize({
      initializeForTesting: true,
    });
    isInitialized = true;
    console.log('[AdMob] Initialized successfully');

    // Pre-load an interstitial ad so it's ready when needed
    await prepareInterstitial();
  } catch (error) {
    console.error('[AdMob] Initialization failed:', error);
  }
};

/**
 * Show a banner ad at the bottom of the screen.
 */
export const showBannerAd = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  if (isBannerShowing) return;

  try {
    if (!isInitialized) {
      await initializeAdMob();
    }

    const options: BannerAdOptions = {
      adId: TEST_BANNER_ID,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: true,
    };

    await AdMob.showBanner(options);
    isBannerShowing = true;
    console.log('[AdMob] Banner ad shown');
  } catch (error) {
    console.error('[AdMob] Failed to show banner:', error);
  }
};

/**
 * Hide and remove the banner ad.
 */
export const hideBannerAd = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  if (!isBannerShowing) return;

  try {
    await AdMob.removeBanner();
    isBannerShowing = false;
    console.log('[AdMob] Banner ad hidden');
  } catch (error) {
    console.error('[AdMob] Failed to hide banner:', error);
  }
};

/**
 * Check if a banner ad is currently showing.
 */
export const isBannerAdShowing = (): boolean => isBannerShowing;

/**
 * Pre-load an interstitial ad so it can be shown instantly later.
 */
export const prepareInterstitial = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    if (!isInitialized) {
      await initializeAdMob();
      return; // initializeAdMob already calls prepareInterstitial
    }

    const options: AdOptions = {
      adId: TEST_INTERSTITIAL_ID,
      isTesting: true,
    };

    await AdMob.prepareInterstitial(options);
    isInterstitialLoaded = true;
    console.log('[AdMob] Interstitial ad preloaded');
  } catch (error) {
    console.error('[AdMob] Failed to preload interstitial:', error);
    isInterstitialLoaded = false;
  }
};

/**
 * Show a full-screen interstitial ad. 
 * Call this at natural transition points (e.g. after saving, navigating back).
 * Automatically preloads the next interstitial after showing.
 */
export const showInterstitialAd = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    if (!isInitialized) {
      await initializeAdMob();
    }

    // If no interstitial is preloaded, try to load one first
    if (!isInterstitialLoaded) {
      await prepareInterstitial();
    }

    await AdMob.showInterstitial();
    isInterstitialLoaded = false;
    console.log('[AdMob] Interstitial ad shown');

    // Pre-load the next interstitial for future use
    setTimeout(() => {
      prepareInterstitial();
    }, 1000);
  } catch (error) {
    console.error('[AdMob] Failed to show interstitial:', error);
    isInterstitialLoaded = false;
    // Try to preload for next time
    prepareInterstitial();
  }
};

