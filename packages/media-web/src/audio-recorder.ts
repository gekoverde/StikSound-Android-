import { StikSoundError } from "@stiksound/core";
import { encodeWavBytes, resampleMonoLinear } from "./audio-utils";

/** A microphone take in progress. `stop()` resolves with a 48 kHz mono WAV ready to import. */
export interface MicrophoneRecording {
  stop(): Promise<{ bytes: Uint8Array; name: string }>;
  cancel(): void;
}

// The first type the browser can record wins. Android WebView picks WebM/Opus, Safari picks MP4/AAC.
const CANDIDATE_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

/** Maps getUserMedia / MediaRecorder failures to the StikSound error catalog. */
export function microphoneError(err: unknown): StikSoundError {
  if (err instanceof StikSoundError) return err;
  const name = (err as { name?: string } | null)?.name;
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") {
    return new StikSoundError("microphone-denied", "Microphone permission was denied.");
  }
  return new StikSoundError("microphone-unavailable", `Microphone could not start (${name ?? "unknown error"}).`);
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return undefined;
  return CANDIDATE_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
}

function timestampName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `mic-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.wav`;
}

/** Decodes whatever the recorder produced and re-encodes it as WAV, a format every client imports. */
export async function recordedBlobToWav(blob: Blob): Promise<Uint8Array> {
  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const mono = new Float32Array(decoded.length);
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      const channel = decoded.getChannelData(c);
      for (let i = 0; i < decoded.length; i++) mono[i] = (mono[i] ?? 0) + channel[i]! / decoded.numberOfChannels;
    }
    const samples = decoded.sampleRate === 48_000 ? mono : resampleMonoLinear(mono, decoded.sampleRate, 48_000);
    return encodeWavBytes({
      sampleRate: 48_000,
      channels: 1,
      samples,
      durationMs: Math.round((samples.length / 48_000) * 1000)
    });
  } catch (err) {
    if (err instanceof StikSoundError) throw err;
    throw new StikSoundError("unsupported-audio", "The recorded audio could not be decoded.");
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

/**
 * Starts recording from the default microphone. The caller enforces the maximum length
 * (LIMITS.MAX_RECORDING_MS) and must call `stop()` or `cancel()`, which release the microphone.
 * On Android the shell asks for the RECORD_AUDIO permission before calling this.
 */
export async function startMicrophoneRecording(): Promise<MicrophoneRecording> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    throw new StikSoundError("microphone-unavailable", "This browser cannot record audio.");
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
  } catch (err) {
    throw microphoneError(err);
  }
  const release = () => stream.getTracks().forEach((t) => t.stop());

  let recorder: MediaRecorder;
  try {
    const mimeType = pickMimeType();
    recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  } catch (err) {
    release();
    throw microphoneError(err);
  }

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  recorder.start(250);

  let finished = false;
  return {
    stop() {
      if (finished) return Promise.reject(new StikSoundError("microphone-unavailable", "Recording already finished."));
      finished = true;
      return new Promise<{ bytes: Uint8Array; name: string }>((resolve, reject) => {
        recorder.onstop = async () => {
          release();
          try {
            const blob = new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type || "audio/webm" });
            if (blob.size === 0) throw new StikSoundError("microphone-unavailable", "Nothing was recorded.");
            resolve({ bytes: await recordedBlobToWav(blob), name: timestampName() });
          } catch (err) {
            reject(err instanceof StikSoundError ? err : microphoneError(err));
          }
        };
        try {
          recorder.stop();
        } catch (err) {
          release();
          reject(microphoneError(err));
        }
      });
    },
    cancel() {
      if (finished) return;
      finished = true;
      recorder.onstop = null;
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } finally {
        release();
      }
    }
  };
}
