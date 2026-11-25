import React from "react";
import { createRoot } from "react-dom/client";
import { StikSoundError, type ExportArtifact, type LocaleCode } from "@stiksound/core";
import { WebMediaEngine, startMicrophoneRecording } from "@stiksound/media-web";
import { MyInstantsProvider, type FetchLike } from "@stiksound/providers";
import { StikSoundMinimalApp, type ShellBridge } from "@stiksound/ui";
import "../../../packages/ui/src/styles.css";
// Same phone layer as the PWA (touch targets, dvh, safe areas).
import "../../web/src/mobile.css";
import { androidLabels } from "./labels";
import {
  fetchMyInstants,
  initNativeBridge,
  isNativeAvailable,
  openAppSettings,
  requestMicrophonePermission,
  saveFile,
  shareFile,
  subscribeIncoming
} from "./native-bridge";

/**
 * StikSound Android shell. The page runs inside a WebView served from the APK assets
 * (https://appassets.androidplatform.net), so everything works offline. Native code adds
 * MyInstants downloads without CORS, the Android share sheet, Download/StikSound and
 * "Share to StikSound" from other apps. Outside the APK (npm run dev) it falls back to the browser.
 */

initNativeBridge();

/** Same contract as the desktop shell: native errors become the HTTP codes the provider expects. */
const androidFetch: FetchLike = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (!isNativeAvailable()) {
    return globalThis.fetch(input, init);
  }
  try {
    const bytes = await fetchMyInstants(url);
    return new Response(new Uint8Array(bytes), { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err ?? "");
    if (msg.includes("file-too-large")) return new Response(null, { status: 413 });
    if (msg.includes("url-rejected")) return new Response(null, { status: 403 });
    throw new Error(msg || "remote-unavailable");
  }
};

function browserDownload(bytes: Uint8Array, fileName: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: mimeType }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

const shell: ShellBridge = {
  async shareArtifact(artifact: ExportArtifact) {
    if (!isNativeAvailable()) {
      browserDownload(artifact.bytes, artifact.fileName, artifact.mimeType);
      return "shared";
    }
    await shareFile(artifact.fileName, artifact.mimeType, artifact.bytes);
    return "shared";
  },
  async saveArtifact(artifact: ExportArtifact) {
    if (!isNativeAvailable()) {
      browserDownload(artifact.bytes, artifact.fileName, artifact.mimeType);
      return;
    }
    return saveFile(artifact.fileName, artifact.mimeType, artifact.bytes);
  },
  async saveProjectZip(zipBytes: Uint8Array, suggestedName: string) {
    if (!isNativeAvailable()) {
      browserDownload(zipBytes, suggestedName, "application/zip");
      return;
    }
    await saveFile(suggestedName, "application/zip", zipBytes);
  },
  subscribeIncoming,
  async startAudioRecording() {
    if (isNativeAvailable()) {
      // Android asks for RECORD_AUDIO first; the WebView then grants getUserMedia to this page only.
      const permission = await requestMicrophonePermission();
      if (!permission.granted) {
        // After "Don't allow" twice Android stops showing the dialog, so take the user to Settings.
        if (!permission.canAskAgain) await openAppSettings().catch(() => undefined);
        throw new StikSoundError("microphone-denied", "RECORD_AUDIO was not granted.");
      }
    }
    return startMicrophoneRecording();
  }
};

const locale: LocaleCode = navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
const engine = new WebMediaEngine();
const providers = [new MyInstantsProvider(androidFetch)];

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <StikSoundMinimalApp
      engine={engine}
      providers={providers}
      shell={shell}
      initialLocale={locale}
      platform={{ transparentVideo: false, myInstantsUrl: true, videoStickers: true }}
      labelOverrides={androidLabels}
    />
  </React.StrictMode>
);
