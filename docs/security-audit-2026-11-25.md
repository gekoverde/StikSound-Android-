# Security audit, 2026-11-25

Scope: the whole fork at commit `708af00` (v1.1.1). That covers the TypeScript packages, the three existing clients (Tauri desktop, Chrome extension, web PWA), the Rust crates, the lockfiles and the GitHub workflows. The question was whether anything could harm the people who use the app.

## Verdict

Nothing malicious turned up: no telemetry, no hidden network calls, no obfuscated or encoded payloads, no credential handling. One unused desktop command was risky enough to remove. Two small hardening changes were made.

## What was checked

| Area | Result |
| --- | --- |
| Outbound network | The only remote host is `myinstants.com`, and only when the user pastes a link. Both the TS (`packages/providers/src/url-policy.ts`) and the Rust (`apps/desktop/src-tauri/src/lib.rs`) policies allow only https on port 443, reject userinfo, revalidate every redirect (max 2), reject private and reserved IPs, time out after 20 s and stop at 25 MB. |
| npm dependencies | Every `resolved` URL in `package-lock.json` points at `registry.npmjs.org`. Only `esbuild` and `fsevents` have install scripts, and both are well known. |
| Rust dependencies | `reqwest` (rustls), `tauri`, `symphonia`, `image`, `gif`, `zip`, `tokio`, `url`, all from crates.io. |
| Dangerous JS | No `eval`, `new Function`, `innerHTML`, `dangerouslySetInnerHTML`, `document.write`, WebSocket, beacons or analytics. |
| Chrome extension | MV3. Permissions are `downloads`, `storage` and the MyInstants hosts. No content scripts, no `<all_urls>`, and a test enforces this (`apps/extension/test/manifest-security.test.ts`). |
| Tauri desktop | Capabilities are `core:default` only, with no shell or global filesystem plugin. The CSP limits `connect-src` to MyInstants. The WebView2 profile is isolated per process. |
| Clipboard command | The file name is sanitized to `[A-Za-z0-9._-]`, and the PowerShell and AppleScript strings are escaped correctly. |
| PWA service worker | Caches same-origin GET requests only. |
| CI workflows | No secrets beyond the default `GITHUB_TOKEN`. Pages and release permissions are scoped. |

## Findings and fixes

### 1. Unused `cmd_render_video` Tauri command (medium, fixed)

`cmd_render_video` was registered in the IPC handler but never called from the frontend. Rendering happens in the WebView through WebCodecs and MediaRecorder. The command:

- built file names from `sticker_format` and `audio_format` without sanitizing them (`sticker.{format}`);
- wrote those files with `fs::write` **before** `video-engine` checked the paths for `..`, so a value like `png/../../../x` could write outside the work directory;
- ran `ffmpeg` resolved from `PATH`.

Exploiting it required script execution inside the app's WebView, and the CSP makes that hard. Still, it was dead code with a dangerous capability. **Fix:** removed the command, its registration and the `stiksound-video-engine` dependency of the desktop app. The crate itself stays in the workspace with its tests.

### 2. Web dev server exposed to the LAN (low, fixed)

`apps/web` ran `vite --host` for `dev` and `preview`, so anyone on the same network could reach the dev server. **Fix:** `dev` and `preview` now bind to localhost. `dev:lan` and `preview:lan` keep the old behavior for testing on a phone.

### 3. CSP hardening (informational, fixed)

Added `object-src 'none'; base-uri 'none'; frame-ancestors 'none'` to the Tauri CSP.

## Notes for the Android client

The Android app added in `apps/android` follows the same rules. It asks only for `INTERNET`, uses no cleartext traffic and keeps the WebView off `file://` (it reads `content://` only for files the user picks, and the CSP blocks loading such URLs). Its native bridge accepts messages only from the app's own asset origin, and it ports the desktop MyInstants policy line for line, with JVM tests that mirror the TypeScript cases.
