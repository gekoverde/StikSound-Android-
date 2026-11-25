import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Strict CSP for the packaged app only. The dev server needs inline scripts for React refresh.
const CSP = [
  "default-src 'self' blob: data:",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob: data:",
  "connect-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join("; ");

function cspPlugin(): Plugin {
  return {
    name: "stiksound-android-csp",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`);
    }
  };
}

// The bundle is copied into the Android assets and served by WebViewAssetLoader at
// https://appassets.androidplatform.net/www/ — fully offline, no server involved.
export default defineConfig({
  base: "./",
  plugins: [react(), cspPlugin()],
  server: {
    port: 5181,
    strictPort: true
  },
  resolve: {
    alias: {
      "@stiksound/core": path.resolve(__dirname, "../../packages/core/src/index.ts"),
      "@stiksound/providers": path.resolve(__dirname, "../../packages/providers/src/index.ts"),
      "@stiksound/media-web": path.resolve(__dirname, "../../packages/media-web/src/index.ts"),
      "@stiksound/ui": path.resolve(__dirname, "../../packages/ui/src/index.ts")
    }
  },
  build: {
    outDir: "android/app/src/main/assets/www",
    emptyOutDir: true
  }
});
