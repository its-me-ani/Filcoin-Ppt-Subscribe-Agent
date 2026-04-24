import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
import { defineConfig, type Plugin } from "vite";
import { spawn, type ChildProcess } from "child_process";
import { createRequire } from "module";
import { build as esbuild } from "esbuild";
import path from "path";

const require = createRequire(import.meta.url);

const isElectron = process.env.ELECTRON === "true";

/**
 * Custom plugin that builds electron main/preload with esbuild (CJS output)
 * and launches Electron in dev mode.
 */
function electronPlugin(): Plugin {
  let electronProcess: ChildProcess | null = null;

  return {
    name: "electron-dev",
    apply: "serve",
    configureServer(server) {
      server.httpServer?.once("listening", async () => {
        // Build main and preload as CJS
        await buildElectronFiles();

        // Launch Electron
        const address = server.httpServer?.address();
        const port =
          typeof address === "object" && address ? address.port : 3000;

        // Get the electron binary path from the installed package
        const electronBin = require("electron") as unknown as string;

        // Must unset ELECTRON_RUN_AS_NODE so Electron initializes as an app
        const env = { ...process.env, VITE_DEV_SERVER_URL: `http://localhost:${port}` };
        delete env.ELECTRON_RUN_AS_NODE;

        electronProcess = spawn(electronBin, ["."], {
          cwd: process.cwd(),
          env,
          stdio: "inherit",
        });

        electronProcess.on("close", () => {
          server.close();
          process.exit();
        });
      });
    },
    closeBundle() {
      if (electronProcess) {
        electronProcess.kill();
      }
    },
  };
}

async function buildElectronFiles() {
  const commonOptions = {
    platform: "node" as const,
    format: "cjs" as const,
    target: "node20",
    bundle: true,
    external: ["electron"],
    outdir: path.resolve("dist-electron"),
    sourcemap: false,
  };

  await Promise.all([
    esbuild({
      ...commonOptions,
      entryPoints: ["electron/main.ts"],
      outExtension: { ".js": ".cjs" },
    }),
    esbuild({
      ...commonOptions,
      entryPoints: ["electron/preload.ts"],
      outExtension: { ".js": ".cjs" },
    }),
  ]);
}

// https://vitejs.dev/config/
export default defineConfig({
  base: "/",
  server: {
    host: true, // Listen on all addresses (needed for Docker)
    port: 3000,
    strictPort: true,
    watch: {
      usePolling: true, // Enable polling for Docker volume watches
    },
  },
  preview: {
    host: true, // Listen on all addresses for preview mode
    port: 3000,
    strictPort: true,
  },
  plugins: [
    react(),
    // legacy({
    //   targets: ['defaults', 'android >= 7', 'chrome >= 60'],
    //   additionalLegacyPolyfills: ['regenerator-runtime/runtime']
    // })
    isElectron && electronPlugin(),
  ],
  define: {
    __DATE__: `'${new Date().toISOString()}'`,
    global: "globalThis",
  },
  build: {
    target: "es2020",
    minify: "esbuild",
    sourcemap: false,
  },
  esbuild: {
    target: "es2020",
    drop: process.env.NODE_ENV === "production" ? ["console", "debugger"] : [],
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "es2020",
    },
    exclude: ["jeep-sqlite", "sql.js"],
  },
});
