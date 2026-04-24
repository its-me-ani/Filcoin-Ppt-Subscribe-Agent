import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initializeDataLayer } from './data';
import { initializeEdgeToEdgeStatusBar } from './hooks/useStatusBar';

// Detect if running inside Electron
const isElectron = typeof window !== 'undefined' && (window as any).electronAPI !== undefined;

// Initialize app
async function initApp() {
  try {
    // Configure edge-to-edge status bar on startup (skip on Electron)
    if (!isElectron) {
      await initializeEdgeToEdgeStatusBar();
    }

    // Initialize the data layer (localStorage-backed, instant)
    await initializeDataLayer();
    if (import.meta.env.DEV) console.log('[App] Data layer initialized');
  } catch (error) {
    console.error('[App] Failed to initialize data layer:', error);
  }

  // Render the app
  const container = document.getElementById('root');
  const root = createRoot(container!);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

initApp();
