// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StikSoundError, type MediaEngine, type SoundProvider } from "@stiksound/core";
import { StikSoundMinimalApp, TimelineTrimBar } from "../src/index";

afterEach(() => {
  cleanup();
});

function createTestEngine(width = 800, height = 400, isGif = false): MediaEngine {
  return {
    async probeImage() {
      return {
        format: isGif ? "gif" : "png",
        width,
        height,
        has_alpha: true,
        animated: isGif,
        frame_count: isGif ? 6 : 1,
        duration_ms: isGif ? 1200 : 0
      };
    },
    async renderSticker() {
      return { width: 400, height: 400, data: new Uint8Array(400 * 400 * 4) };
    },
    async encodeWebp() {
      return new Uint8Array([0x52, 0x49, 0x46, 0x46]);
    },
    async probeAudio() {
      return { format: "mp3", duration_ms: 12_000, sample_rate: 44100, channels: 2 };
    },
    async waveform() {
      return {
        buckets: 1024,
        mins: new Float32Array(1024).fill(-0.4),
        maxs: new Float32Array(1024).fill(0.4)
      };
    },
    async renderAudio(_bytes, edit) {
      return {
        sampleRate: 48000,
        channels: 1,
        samples: new Float32Array(48000),
        durationMs: edit.end_ms - edit.start_ms
      };
    },
    async encodeOpus() {
      return new Uint8Array([0x4f, 0x67, 0x67, 0x53]);
    },
    async renderVideo(req) {
      return {
        bytes: new Uint8Array([1, 2, 3, 4]),
        mimeType: req.container === "webm-alpha" ? "video/webm" : "video/mp4",
        extension: req.container === "webm-alpha" ? "webm" : "mp4",
        durationMs: req.endMs - req.startMs,
        hasAlpha: req.container === "webm-alpha"
      };
    },
    async zip() {
      return new Uint8Array([0x50, 0x4b]);
    },
    async unzip() {
      return [];
    }
  };
}

describe("StikSoundMinimalApp UI", () => {
  it("supports GIF/PNG, zero-click hover 1:1 crop, arrow preview/copy, download format picker, and X reset", async () => {
    const saveArtifact = vi.fn().mockResolvedValue(undefined);
    const copyArtifactToClipboard = vi.fn().mockResolvedValue(undefined);
    const provider: SoundProvider = {
      id: "myinstants",
      canResolve: (u) => u.includes("myinstants.com"),
      resolve: async (u) => ({
        page_url: u,
        media_url: "https://www.myinstants.com/media/sounds/test.mp3",
        title: "Test Sound",
        bytes: new Uint8Array([0x49, 0x44, 0x33, 0x03])
      })
    };

    const { container } = render(
      <StikSoundMinimalApp
        engine={createTestEngine(800, 400, true)}
        providers={[provider]}
        shell={{ saveArtifact, copyArtifactToClipboard }}
        initialLocale="es"
      />
    );

    const okArrowBtn = screen.getByTestId("export-ok-btn") as HTMLButtonElement;
    const downloadBtn = screen.getByTestId("download-btn") as HTMLButtonElement;
    expect(okArrowBtn.disabled).toBe(true);
    expect(downloadBtn.disabled).toBe(true);

    // Drop a non-square 800x400 GIF onto the center sticker zone
    const stickerZone = screen.getByTestId("sticker-zone");
    Object.defineProperty(stickerZone, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200 })
    });
    const gifFile = new File([new Uint8Array([0x47, 0x49, 0x46, 0x38])], "dance.gif", { type: "image/gif" });
    Object.defineProperty(gifFile, "arrayBuffer", {
      value: async () => new Uint8Array([0x47, 0x49, 0x46, 0x38]).buffer
    });
    fireEvent.drop(stickerZone, { dataTransfer: { files: [gifFile] } });

    await waitFor(() => expect(screen.getByTestId("sticker-loaded-badge")).toBeTruthy());
    // Resolution badge shows input-driven 1:1 400x400 + hover hint
    expect(screen.getByTestId("resolution-pill").textContent).toContain("400×400");
    // Transparency picker is shown directly when alpha exists
    expect(screen.getByTestId("transparency-picker")).toBeTruthy();

    // Zero-click hover move to right side updates crop without any click
    fireEvent.mouseMove(stickerZone, { clientX: 200, clientY: 100 });

    // Submit MyInstants URL in bottom timeline bar
    const urlInput = screen.getByTestId("myinstants-url-input");
    fireEvent.change(urlInput, { target: { value: "https://www.myinstants.com/en/instant/test/" } });
    fireEvent.submit(urlInput.closest("form")!);

    await waitFor(() => expect(screen.getByTestId("duration-readout").textContent).toContain("10.0s / 10.0s"));
    expect(okArrowBtn.disabled).toBe(false);
    expect(downloadBtn.disabled).toBe(false);

    // Click Arrow (➔) -> generates most compatible preview & copies to clipboard without downloading
    fireEvent.click(okArrowBtn);
    await waitFor(() => expect(copyArtifactToClipboard).toHaveBeenCalledTimes(1));
    expect(copyArtifactToClipboard.mock.calls[0]![0].profile).toBe("video-mp4");
    expect(saveArtifact).not.toHaveBeenCalled();
    expect(screen.getByTestId("video-preview-ready")).toBeTruthy();

    // Click Download (⬇) -> opens format picker; pick High Quality / Transparent WebM
    fireEvent.click(downloadBtn);
    expect(screen.getByTestId("download-format-picker")).toBeTruthy();
    fireEvent.click(screen.getByTestId("download-fmt-video-webm-alpha"));
    await waitFor(() => expect(saveArtifact).toHaveBeenCalledTimes(1));
    expect(saveArtifact.mock.calls[0]![0].profile).toBe("video-webm-alpha");

    // Click X (✕) -> resets everything back to 0
    fireEvent.click(screen.getByTestId("reset-all-btn"));
    await waitFor(() => expect(screen.getByTestId("myinstants-url-input")).toBeTruthy());
    expect(okArrowBtn.disabled).toBe(true);
    expect(container.querySelector('[data-testid="sticker-loaded-badge"]')).toBeNull();
  });

  it("imports a sticker and a MyInstants link handed over by the shell (Android share sheet)", async () => {
    const saveArtifact = vi.fn().mockResolvedValue(undefined);
    const resolve = vi.fn(async (u: string) => ({
      page_url: u,
      media_url: "https://www.myinstants.com/media/sounds/shared.mp3",
      title: "Shared",
      bytes: new Uint8Array([0x49, 0x44, 0x33, 0x03])
    }));
    const provider: SoundProvider = { id: "myinstants", canResolve: (u) => u.includes("myinstants.com"), resolve };
    let deliver: ((item: import("../src/index").IncomingItem) => void) | null = null;
    const unsubscribe = vi.fn();
    const subscribeIncoming = vi.fn((handler: (item: import("../src/index").IncomingItem) => void) => {
      deliver = handler;
      return unsubscribe;
    });

    const { unmount } = render(
      <StikSoundMinimalApp
        engine={createTestEngine(512, 512)}
        providers={[provider]}
        shell={{ saveArtifact, subscribeIncoming }}
        initialLocale="es"
      />
    );
    expect(subscribeIncoming).toHaveBeenCalledTimes(1);

    // Both arrive at once, like an image and a link shared together; they must import in order.
    act(() => {
      deliver!({ kind: "sticker", bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]), name: "shared.png" });
      deliver!({ kind: "url", url: "https://www.myinstants.com/en/instant/shared/" });
    });
    await waitFor(() => expect(screen.getByTestId("sticker-loaded-badge")).toBeTruthy());
    await waitFor(() => expect(resolve).toHaveBeenCalledWith("https://www.myinstants.com/en/instant/shared/"));
    await waitFor(() => expect((screen.getByTestId("export-ok-btn") as HTMLButtonElement).disabled).toBe(false));
    // Re-renders must not create extra subscriptions.
    expect(subscribeIncoming).toHaveBeenCalledTimes(1);

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("records from the microphone through the shell and imports the take", async () => {
    const take = { bytes: new Uint8Array([0x52, 0x49, 0x46, 0x46]), name: "mic-test.wav" };
    const stop = vi.fn().mockResolvedValue(take);
    const cancel = vi.fn();
    const startAudioRecording = vi.fn().mockResolvedValue({ stop, cancel });

    render(
      <StikSoundMinimalApp
        engine={createTestEngine(512, 512)}
        shell={{ saveArtifact: vi.fn(), startAudioRecording }}
        initialLocale="es"
      />
    );

    fireEvent.click(screen.getByTestId("record-btn"));
    await waitFor(() => expect(screen.getByTestId("record-stop-btn")).toBeTruthy());
    expect(startAudioRecording).toHaveBeenCalledTimes(1);
    // The file picker and the link field are locked while the microphone is open.
    expect((screen.getByTestId("audio-pick-btn") as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByTestId("record-stop-btn"));
    await waitFor(() => expect(screen.getByTestId("duration-readout")).toBeTruthy());
    expect(stop).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();
  });

  it("explains how to allow the microphone when the permission is denied", async () => {
    const startAudioRecording = vi
      .fn()
      .mockRejectedValue(new StikSoundError("microphone-denied", "denied by the user"));

    render(
      <StikSoundMinimalApp
        engine={createTestEngine(512, 512)}
        shell={{ saveArtifact: vi.fn(), startAudioRecording }}
        initialLocale="es"
      />
    );

    fireEvent.click(screen.getByTestId("record-btn"));
    await waitFor(() => expect(screen.getByTestId("error-banner").textContent).toContain("micrófono"));
    expect(screen.getByTestId("error-banner").textContent).toContain("Ajustes");
    expect(screen.getByTestId("record-btn")).toBeTruthy();
  });

  it("hides the record button when the shell cannot record", () => {
    render(<StikSoundMinimalApp engine={createTestEngine()} shell={{ saveArtifact: vi.fn() }} initialLocale="en" />);
    expect(screen.queryByTestId("record-btn")).toBeNull();
  });

  it("preserves a shorter saved trim when repositioning audio under the 10s cap", () => {
    const onChangeRange = vi.fn();
    render(
      <TimelineTrimBar
        hasAudio
        durationMs={8_037}
        startMs={1_000}
        endMs={6_000}
        maxWindowMs={10_000}
        peaks={null}
        isPlaying={false}
        isBusy={false}
        urlInput=""
        onUrlInputChange={vi.fn()}
        onSubmitUrl={vi.fn()}
        onSelectAudioFile={vi.fn()}
        onChangeRange={onChangeRange}
        onTogglePlay={vi.fn()}
        labels={{ placeholder: "Audio", pickBtn: "Audio", play: "Play", stop: "Stop" }}
      />
    );

    const slider = screen.getByTestId("trim-slider") as HTMLInputElement;
    expect(slider.max).toBe("3037");
    expect(slider.step).toBe("1");
    fireEvent.change(slider, { target: { value: "2500" } });
    expect(onChangeRange).toHaveBeenLastCalledWith(2_500, 7_500);
    fireEvent.change(slider, { target: { value: "3037" } });
    expect(onChangeRange).toHaveBeenLastCalledWith(3_037, 8_037);

    const track = screen.getByTestId("waveform-track");
    Object.defineProperty(track, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, width: 200, height: 40, right: 200, bottom: 40 })
    });
    fireEvent.click(track, { clientX: 100 });
    expect(onChangeRange).toHaveBeenLastCalledWith(1_519, 6_519);
  });

  it("shows localized error banner when an invalid URL is submitted", async () => {
    const provider: SoundProvider = {
      id: "myinstants",
      canResolve: () => false,
      resolve: async () => {
        throw new StikSoundError("url-rejected");
      }
    };

    render(
      <StikSoundMinimalApp
        engine={createTestEngine()}
        providers={[provider]}
        shell={{ saveArtifact: vi.fn() }}
        initialLocale="es"
      />
    );

    const urlInput = screen.getByTestId("myinstants-url-input");
    fireEvent.change(urlInput, { target: { value: "https://evil.example/sound.mp3" } });
    fireEvent.submit(urlInput.closest("form")!);

    await waitFor(() => expect(screen.getByTestId("error-banner").textContent).toContain("MyInstants"));
  });

  it("switches max duration between 5s and 10s, clamps/expands selection, and updates exported filename", async () => {
    const baseEngine = createTestEngine();
    const longEngine = {
      ...baseEngine,
      probeAudio: async (bytes: Uint8Array) => ({
        ...(await baseEngine.probeAudio(bytes)),
        duration_ms: 15_000
      })
    };
    const saved: Array<{ fileName: string }> = [];
    const provider: SoundProvider = {
      id: "myinstants",
      canResolve: () => true,
      resolve: async (url) => ({
        page_url: url,
        media_url: "https://www.myinstants.com/media/sounds/long.mp3",
        title: "Long Clip",
        bytes: new Uint8Array([1, 2, 3, 4])
      })
    };

    render(
      <StikSoundMinimalApp
        engine={longEngine}
        providers={[provider]}
        shell={{
          saveArtifact: async (artifact) => {
            saved.push({ fileName: artifact.fileName });
          }
        }}
        initialLocale="es"
      />
    );

    // Load a valid PNG sticker via file input inside the app shell
    const appShell = screen.getByTestId("stiksound-minimal-app");
    const stickerInput = appShell.querySelector('input[accept*="image/png"]') as HTMLInputElement;
    const pngFile = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "ok.png", {
      type: "image/png"
    });
    Object.defineProperty(pngFile, "arrayBuffer", {
      value: async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer
    });
    fireEvent.change(stickerInput, { target: { files: [pngFile] } });
    await waitFor(() => expect(screen.getByTestId("sticker-loaded-badge")).toBeTruthy());

    // Switch to 5s before importing audio
    fireEvent.click(screen.getByTestId("max-duration-5s"));
    expect(screen.getByTestId("max-duration-5s").getAttribute("aria-pressed")).toBe("true");

    const urlInput = screen.getByTestId("myinstants-url-input");
    fireEvent.change(urlInput, { target: { value: "https://www.myinstants.com/en/instant/test-1/" } });
    fireEvent.submit(urlInput.closest("form")!);

    await waitFor(() => expect(screen.getByTestId("duration-readout").textContent).toBe("5.0s / 5.0s"));

    // Download MP4 at 5s cap
    fireEvent.click(screen.getByTestId("download-btn"));
    const mp4Choice = screen.getByTestId("download-fmt-video-mp4");
    expect(mp4Choice.textContent ?? "").toMatch(/video mp4/i);
    expect(mp4Choice.textContent ?? "").not.toMatch(/whatsapp/i);
    fireEvent.click(mp4Choice);
    await waitFor(() => {
      expect(saved).toHaveLength(1);
      expect(screen.getByTestId("status-banner").textContent ?? "").toMatch(/no lo importa como sticker/i);
    });
    expect(screen.getByTestId("status-banner").textContent ?? "").not.toMatch(/sticker con audio/i);
    expect(saved[0]!.fileName).toMatch(/-5s\.mp4$/);

    // Switch to 10s -> selection expands automatically to 10.0s
    fireEvent.click(screen.getByTestId("max-duration-10s"));
    await waitFor(() => expect(screen.getByTestId("duration-readout").textContent).toBe("10.0s / 10.0s"));

    // Download MP4 at 10s cap
    fireEvent.click(screen.getByTestId("download-btn"));
    fireEvent.click(screen.getByTestId("download-fmt-video-mp4"));
    await waitFor(() => expect(saved).toHaveLength(2));
    expect(saved[1]!.fileName).toMatch(/-10s\.mp4$/);

    // Switch back to 5s -> selection clamps back to 5.0s
    fireEvent.click(screen.getByTestId("max-duration-5s"));
    await waitFor(() => expect(screen.getByTestId("duration-readout").textContent).toBe("5.0s / 5.0s"));
  });
});
