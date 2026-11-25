import type { IncomingItem } from "@stiksound/ui";

/**
 * Typed wrapper over the Android native channel.
 *
 * MainActivity registers `StikSoundNative` with WebViewCompat.addWebMessageListener, restricted to
 * the app's own asset origin. Requests are JSON strings with an `id`; replies echo the `id`.
 * Native can also push `{ event: "incoming", ... }` messages after the page says "hello".
 *
 * Binary data never travels as one huge string:
 * - native -> JS: bytes are parked in a native blob store and read with fetch("/blob/<id>").
 * - JS -> native: bytes are sent in base64 chunks, then committed with "save" or "share".
 */

interface NativeChannel {
  postMessage(message: string): void;
  onmessage: ((event: MessageEvent) => void) | null;
}

declare global {
  interface Window {
    StikSoundNative?: NativeChannel;
  }
}

interface NativeReply {
  id?: string;
  ok?: boolean;
  result?: unknown;
  error?: string;
  event?: string;
  kind?: "sticker" | "audio" | "url";
  blobId?: string;
  name?: string;
  url?: string;
}

const pending = new Map<string, { resolve(value: unknown): void; reject(err: Error): void }>();
const incomingBacklog: IncomingItem[] = [];
let incomingHandler: ((item: IncomingItem) => void) | null = null;
let sequence = 0;
let initialized = false;

// Chunks are a multiple of 3 bytes so each base64 chunk decodes on its own.
const UPLOAD_CHUNK_BYTES = 384 * 1024;

export function isNativeAvailable(): boolean {
  return typeof window !== "undefined" && window.StikSoundNative !== undefined;
}

function channel(): NativeChannel {
  const c = window.StikSoundNative;
  if (!c) throw new Error("native-unavailable");
  return c;
}

function call<T>(op: string, payload: Record<string, unknown> = {}): Promise<T> {
  sequence += 1;
  const id = `${Date.now().toString(36)}-${sequence}`;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
    try {
      channel().postMessage(JSON.stringify({ id, op, ...payload }));
    } catch (err) {
      pending.delete(id);
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

async function takeBlob(blobId: string): Promise<Uint8Array> {
  const res = await fetch(`/blob/${encodeURIComponent(blobId)}`, { cache: "no-store" });
  if (!res.ok) throw new Error("remote-unavailable: native blob missing");
  return new Uint8Array(await res.arrayBuffer());
}

function emitIncoming(item: IncomingItem): void {
  if (incomingHandler) incomingHandler(item);
  else incomingBacklog.push(item);
}

// Items are fetched in arrival order so an image and a sound shared together keep their order.
let incomingChain: Promise<void> = Promise.resolve();

function handleIncoming(msg: NativeReply): void {
  incomingChain = incomingChain.then(async () => {
    try {
      if (msg.kind === "url" && msg.url) {
        emitIncoming({ kind: "url", url: msg.url });
      } else if ((msg.kind === "sticker" || msg.kind === "audio") && msg.blobId) {
        const bytes = await takeBlob(msg.blobId);
        emitIncoming({ kind: msg.kind, bytes, name: msg.name ?? msg.kind });
      }
    } catch {
      // The item expired (for example after a reload). Nothing to import.
    }
  });
}

function onNativeMessage(raw: unknown): void {
  if (typeof raw !== "string") return;
  let msg: NativeReply;
  try {
    msg = JSON.parse(raw) as NativeReply;
  } catch {
    return;
  }
  if (msg.event === "incoming") {
    handleIncoming(msg);
    return;
  }
  if (!msg.id) return;
  const waiter = pending.get(msg.id);
  if (!waiter) return;
  pending.delete(msg.id);
  if (msg.ok) waiter.resolve(msg.result);
  else waiter.reject(new Error(msg.error ?? "native-error"));
}

/** Connects to the native side. Safe to call more than once. */
export function initNativeBridge(): void {
  if (initialized || !isNativeAvailable()) return;
  initialized = true;
  channel().onmessage = (event) => onNativeMessage(event.data);
  void call("hello").catch(() => undefined);
}

export function subscribeIncoming(handler: (item: IncomingItem) => void): () => void {
  incomingHandler = handler;
  while (incomingBacklog.length > 0) handler(incomingBacklog.shift()!);
  return () => {
    if (incomingHandler === handler) incomingHandler = null;
  };
}

/** Downloads a MyInstants page or sound through the native allowlisted client (no CORS). */
export async function fetchMyInstants(url: string): Promise<Uint8Array> {
  const result = await call<{ blobId: string }>("fetchMyInstants", { url });
  return takeBlob(result.blobId);
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

async function upload(bytes: Uint8Array): Promise<string> {
  const uploadId = crypto.randomUUID();
  for (let offset = 0; offset < bytes.length; offset += UPLOAD_CHUNK_BYTES) {
    await call("uploadChunk", { uploadId, data: toBase64(bytes.subarray(offset, offset + UPLOAD_CHUNK_BYTES)) });
  }
  return uploadId;
}

/** Saves into Download/StikSound through MediaStore. Resolves with the visible path. */
export async function saveFile(name: string, mime: string, bytes: Uint8Array): Promise<string> {
  const uploadId = await upload(bytes);
  const result = await call<{ path: string }>("save", { uploadId, name, mime });
  return result.path;
}

/** Opens the Android share sheet (WhatsApp, Telegram, Drive…) with the file. */
export async function shareFile(name: string, mime: string, bytes: Uint8Array): Promise<void> {
  const uploadId = await upload(bytes);
  await call("share", { uploadId, name, mime });
}
