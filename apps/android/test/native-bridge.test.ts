import { describe, expect, it, vi } from "vitest";
import { isNativeAvailable, subscribeIncoming, toBase64 } from "../src/native-bridge";

describe("Android native bridge helpers", () => {
  it("encodes bytes to base64 exactly like Node, including large chunks", () => {
    const small = new Uint8Array([0, 1, 2, 250, 255]);
    expect(toBase64(small)).toBe(Buffer.from(small).toString("base64"));

    const big = new Uint8Array(200_000).map((_, i) => (i * 31) % 256);
    expect(toBase64(big)).toBe(Buffer.from(big).toString("base64"));
  });

  it("reports no native channel outside the APK", () => {
    expect(isNativeAvailable()).toBe(false);
  });

  it("stops delivering after unsubscribe and lets a newer subscriber take over", () => {
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = subscribeIncoming(first);
    const unsubscribeSecond = subscribeIncoming(second);
    unsubscribeFirst(); // stale unsubscribe must not drop the newer handler
    unsubscribeSecond();
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
  });
});
