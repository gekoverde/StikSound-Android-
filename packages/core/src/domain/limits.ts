export const LIMITS = {
  MAX_IMAGE_BYTES: 20 * 1024 * 1024, // 20 MB (NFR-014)
  MAX_VIDEO_BYTES: 100 * 1024 * 1024, // 100 MB short clip used as a sticker
  MAX_VIDEO_DURATION_MS: 60_000, // 60 s input clip; export uses the 5 s or 10 s preset
  MAX_AUDIO_BYTES: 25 * 1024 * 1024, // 25 MB (NFR-014)
  MAX_AUDIO_DURATION_MS: 180_000, // 3 minutes (NFR-014)
  MIN_AUDIO_DURATION_MS: 100,
  MAX_IMAGE_PIXELS: 40_000_000, // 40 MP decompression bomb cap (SEC-009)
  MAX_IMAGE_DIMENSION: 8000, // 8000 px max width or height
  MAX_PACKAGE_BYTES: 100 * 1024 * 1024, // 100 MB uncompressed (NFR-014)
  MAX_PACKAGE_FILES: 32, // (NFR-014)
  DEFAULT_VIDEO_MAX_AUDIO_MS: 10_000, // 10-second video sticker audio cap
  DEFAULT_BUNDLE_MAX_AUDIO_MS: 10_000, // Aligned to 10s framing rule
  MIN_TRIM_DURATION_MS: 100,
  DURATION_TOLERANCE_MS: 50,
  STICKER_DIMENSION_PX: 512,
  MAX_AUDIO_TRIM_MS: 10_000,
  MAX_RECORDING_MS: 30_000, // microphone recordings stop on their own after 30 s; the editor trims to 5 or 10 s
  AUDIO_DURATION_PRESETS: [5_000, 10_000] as const,
  MAX_STATIC_WEBP_BYTES: 102_400, // 100 KB
  MAX_REDIRECTS: 2,
  FETCH_TIMEOUT_MS: 20_000,
  WAVEFORM_BUCKETS: 1024,
  OPUS_SAMPLE_RATE: 48_000,
  OPUS_CHANNELS: 1,
  OPUS_BITRATE_BPS: 64_000,
  DEFAULT_MATTE_COLOR: "#FFFFFF"
} as const;

export const ALLOWED_MYINSTANTS_HOSTS = ["www.myinstants.com", "myinstants.com"] as const;
