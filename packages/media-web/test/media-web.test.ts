import { describe, expect, it } from "vitest";
import { zipSync } from "fflate";
import {
  WebMediaEngine,
  compositeRgbaOnMatte,
  cropAndFitSquareRgba,
  decodeGifFramesRgba,
  encodeWavBytes,
  extractRawAudioSpecificConfig,
  prepareAnimatedGifFrames,
  sanitizeMp4AudioChunkMeta,
  scheduleGifFramesForDuration,
  sniffImageHeader,
  trimPcmSamples
} from "../src/index";

function makeMinimalPngHeader(w: number, h: number, colorType = 6): Uint8Array {
  const buf = new Uint8Array(33);
  buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(buf.buffer);
  view.setUint32(8, 13, false);
  buf.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, w, false);
  view.setUint32(20, h, false);
  buf[24] = 8;
  buf[25] = colorType;
  return buf;
}

function makeAnimatedGifBytes(): Uint8Array {
  // GIF89a 2x2 with 2 frames, GCT [red, green, blue, transparent], LZW minCodeSize=2,
  // Frame 1 (20cs = 200ms) draws color index 0 (red), Frame 2 (30cs = 300ms) draws color index 1 (green)
  return new Uint8Array([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
    0x02, 0x00, 0x02, 0x00, 0x91, 0x00, 0x00, // 2x2, GCT 4 colors (2^(1+1)=4)
    0xff, 0x00, 0x00, // 0: red
    0x00, 0xff, 0x00, // 1: green
    0x00, 0x00, 0xff, // 2: blue
    0x00, 0x00, 0x00, // 3: transparent placeholder
    // Frame 1 GCE: disposal=0, transparent=true, index=3, delay=20cs (200ms)
    0x21, 0xf9, 0x04, 0x01, 0x14, 0x00, 0x03, 0x00,
    // Image descriptor 1 + LZW min=2: clear(4),0,0,0,0,eoi(5) -> 3-bit codes: 100,000,000,000,000,101 = [0x04, 0x80, 0x02]
    0x2c, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00, 0x02, 0x00, 0x00, 0x02, 0x03, 0x04, 0x80, 0x02, 0x00,
    // Frame 2 GCE: disposal=0, transparent=true, index=3, delay=30cs (300ms)
    0x21, 0xf9, 0x04, 0x01, 0x1e, 0x00, 0x03, 0x00,
    // Image descriptor 2 (1x1 overlay at (0,0) with index 1 = green, leaving rest red from frame 1):
    // LZW min=2: clear(4),1,eoi(5) -> 3-bit codes: 100,001,101 -> bits: 00001100=0x0c, 0x05? let's encode cleanly:
    // LSB-first: code0=4(100), code1=1(001)-> bits 0..2=100, 3..5=001, 6..7=10 -> byte0 = 0b10_001_100 = 0x8c, bit8=1 -> byte1 = 0x01
    0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x8c, 0x01, 0x00,
    0x3b
  ]);
}

describe("packages/media-web", () => {
  it("sniffs PNG alpha, animated GIF frames, and rejects 40MP decompression bombs (SEC-009)", () => {
    const png = sniffImageHeader(makeMinimalPngHeader(400, 300, 6));
    expect(png).toEqual({
      format: "png",
      width: 400,
      height: 300,
      has_alpha: true,
      animated: false,
      frame_count: 1,
      duration_ms: 0
    });

    const gif = sniffImageHeader(makeAnimatedGifBytes());
    expect(gif.format).toBe("gif");
    expect(gif.animated).toBe(true);
    expect(gif.has_alpha).toBe(true);
    expect(gif.frame_count).toBe(2);
    expect(gif.duration_ms).toBe(500);

    expect(() => sniffImageHeader(makeMinimalPngHeader(9000, 9000, 6))).toThrowError(/file-too-large/);
  });

  it("decodes animated GIF frames with distinct RGBA content and compositing (Issue #3)", () => {
    const gifBytes = makeAnimatedGifBytes();
    const decoded = decodeGifFramesRgba(gifBytes);
    expect(decoded).toHaveLength(2);
    expect(decoded[0]!.delayMs).toBe(200);
    expect(decoded[1]!.delayMs).toBe(300);

    // Frame 1 pixel (0,0) is red [255, 0, 0, 255]
    expect(Array.from(decoded[0]!.rgba.slice(0, 4))).toEqual([255, 0, 0, 255]);
    // Frame 2 pixel (0,0) is green [0, 255, 0, 255], while pixel (1,0) retains red from Frame 1
    expect(Array.from(decoded[1]!.rgba.slice(0, 4))).toEqual([0, 255, 0, 255]);
    expect(Array.from(decoded[1]!.rgba.slice(4, 8))).toEqual([255, 0, 0, 255]);

    const prepared = prepareAnimatedGifFrames({
      stickerBytes: gifBytes,
      cropX: 0.5,
      cropY: 0.5,
      container: "mp4",
      matteColor: "#FFFFFF"
    });
    expect(prepared).toHaveLength(2);
    expect(Array.from(prepared[0]!.rgba.slice(0, 4))).not.toEqual(Array.from(prepared[1]!.rgba.slice(0, 4)));

    const schedule = scheduleGifFramesForDuration(
      prepared.map((f, frameIndex) => ({ frameIndex, delayMs: f.delayMs })),
      1_000
    );
    expect(schedule.some((s) => s.frameIndex === 0)).toBe(true);
    expect(schedule.some((s) => s.frameIndex === 1)).toBe(true);
  });

  it("preserves alpha during 1:1 input-driven crop and cleanly composites onto matte", () => {
    const src = new Uint8Array(8 * 4 * 4);
    // Left half (x 0..3) red, right half (x 4..7) transparent
    for (let y = 1; y <= 2; y++) {
      for (let x = 1; x <= 2; x++) {
        const i = (y * 8 + x) * 4;
        src[i] = 255;
        src[i + 3] = 255;
      }
    }
    // cropX = 0 picks the left 4x4 square -> output is 4x4 (never upscaled)
    const leftSquare = cropAndFitSquareRgba(src, 8, 4, 0, 0.5);
    expect(leftSquare.width).toBe(4);
    expect(leftSquare.height).toBe(4);
    expect(leftSquare.data[3]).toBe(0); // corner transparent
    const centerIdx = (1 * 4 + 1) * 4;
    expect(leftSquare.data[centerIdx]).toBe(255);
    expect(leftSquare.data[centerIdx + 3]).toBe(255);

    const matted = compositeRgbaOnMatte(leftSquare, "#FFFFFF");
    expect(matted[0]).toBe(255);
    expect(matted[1]).toBe(255);
    expect(matted[2]).toBe(255);
    expect(matted[3]).toBe(255);
  });

  it("schedules looping GIF frames across exact 10-second video duration", () => {
    const schedule = scheduleGifFramesForDuration(
      [
        { frameIndex: 0, delayMs: 500 },
        { frameIndex: 1, delayMs: 500 }
      ],
      10_000
    );
    expect(schedule).toHaveLength(20);
    const totalUs = schedule.reduce((sum, s) => sum + s.durationUs, 0);
    expect(totalUs).toBe(10_000_000);
  });

  it("trims WAV audio within 50 ms tolerance and rejects Zip-Slip (SEC-006)", async () => {
    const samples = new Float32Array(48000 * 12).fill(0.25);
    const wav = encodeWavBytes({ sampleRate: 48000, channels: 1, samples, durationMs: 12_000 });
    const engine = new WebMediaEngine();

    const probe = await engine.probeAudio(wav);
    expect(probe.format).toBe("wav");
    expect(probe.duration_ms).toBe(12_000);

    const peaks = await engine.waveform(wav);
    expect(peaks.buckets).toBe(1024);

    const trimmed = trimPcmSamples(samples, 48000, 1000, 11_000, 1);
    expect(Math.abs(trimmed.durationMs - 10_000)).toBeLessThanOrEqual(50);
    expect(() => trimPcmSamples(samples, 48000, 1000, 11_001, 1)).toThrowError(/trim-out-of-range/);

    const evilZip = zipSync({ "../outside.txt": new Uint8Array([1, 2, 3]) });
    await expect(engine.unzip(evilZip)).rejects.toMatchObject({ code: "package-invalid" });
  });

  it("extracts raw AudioSpecificConfig from Apple ES_Descriptor without double-wrapping MP4 esds", () => {
    const appleEsDescriptor = Uint8Array.from(
      Buffer.from("038080802200000004808080144014001800000000000000000005808080021188068080800102", "hex")
    );
    const extracted = extractRawAudioSpecificConfig(appleEsDescriptor);
    expect(Array.from(extracted ?? [])).toEqual([0x11, 0x88]);

    const rawAsc = new Uint8Array([0x11, 0x88]);
    expect(Array.from(extractRawAudioSpecificConfig(rawAsc) ?? [])).toEqual([0x11, 0x88]);

    const sanitized = sanitizeMp4AudioChunkMeta({
      decoderConfig: {
        codec: "mp4a.40.2",
        sampleRate: 48000,
        numberOfChannels: 1,
        description: appleEsDescriptor
      }
    });
    expect(Array.from(new Uint8Array(sanitized?.decoderConfig?.description as ArrayBuffer))).toEqual([0x11, 0x88]);
  });

  it("TC-018: reports unsupported-codec when WebCodecs is absent without writing files", async () => {
    const engine = new WebMediaEngine();
    await expect(
      engine.renderVideo({
        stickerBytes: makeMinimalPngHeader(64, 64),
        stickerFormat: "png",
        animated: false,
        audioBytes: new Uint8Array(100),
        audioFormat: "wav",
        startMs: 0,
        endMs: 3000,
        volume: 1,
        matteColor: "#FFFFFF",
        container: "mp4"
      })
    ).rejects.toMatchObject({ code: "unsupported-codec" });
  });
});

describe("microphone error mapping", () => {
  it("maps permission failures to microphone-denied and the rest to microphone-unavailable", async () => {
    const { microphoneError } = await import("../src/audio-recorder");
    expect(microphoneError({ name: "NotAllowedError" }).code).toBe("microphone-denied");
    expect(microphoneError({ name: "SecurityError" }).code).toBe("microphone-denied");
    expect(microphoneError({ name: "NotFoundError" }).code).toBe("microphone-unavailable");
    expect(microphoneError({ name: "NotReadableError" }).code).toBe("microphone-unavailable");
    expect(microphoneError(null).code).toBe("microphone-unavailable");
  });

  it("refuses to start where the browser has no recorder", async () => {
    const { startMicrophoneRecording } = await import("../src/audio-recorder");
    await expect(startMicrophoneRecording()).rejects.toMatchObject({ code: "microphone-unavailable" });
  });
});
