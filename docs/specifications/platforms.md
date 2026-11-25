# Platform specification

StikSound ships four clients (desktop, Chrome extension, web PWA and Android). They share the project schema, the validation rules, and the screen flow. They do not share one media engine.

## Capability matrix

| Capability | Windows app | macOS app | Chrome extension | Android app |
| --- | --- | --- | --- | --- |
| Paste image | Yes, Ctrl+V | Yes, Cmd+V | Yes, while the editor tab is focused | Share sheet: "Share to StikSound" from any app |
| Paste MyInstants URL | Yes | Yes | Yes | Yes, typed or shared as text |
| Drag and drop files | Yes | Yes | Yes, onto the editor page | No |
| System file picker | Yes | Yes | Yes, through the page file input | Yes, `ACTION_GET_CONTENT` (gallery, Files) |
| Choose an output folder | Yes | Yes | No. The browser downloads files | No. `Download/StikSound` or the share sheet |
| Local project index | SQLite | SQLite | IndexedDB for the open project only | None. Portable package only |
| Portable package | Read and write | Read and write | Read and write | Read and write |
| MP3 decode and trim | Yes | Yes | Yes, when the browser can decode the file | Yes, Android System WebView decoders |
| Ogg Opus encode | Yes | Yes | Best effort via the web encoder. Otherwise AC-014 | Same as the extension |
| WebP encode with alpha | Yes | Yes | Yes, via the shared web encoder | Yes, via the shared web encoder |
| MyInstants fetch | Rust HTTP client | Rust HTTP client | Extension host permission, same allowlist | Kotlin `HttpURLConnection`, same allowlist and IP checks |
| Install into WhatsApp | No | No | No | No. The MP4 goes through the share sheet as a video |
| Script WhatsApp Web | No | No | No | No |

## Windows

- Package as an installed application with a Start menu shortcut and an uninstaller.
- Use the system WebView2. The installer documents the WebView2 dependency and may run the Microsoft evergreen bootstrapper when the runtime is missing.
- File paths and exported names are Unicode-safe and do not contain `<>:"/\|?*`.
- Clipboard image priority: PNG, then DIB with alpha when offered, then a file path if the clipboard contains a file drop.
- The app writes working files under the per-user local app data directory.

## macOS

- Package as a `.app` inside a `.dmg`.
- v1 build target is `aarch64-apple-darwin`.
- Request no special entitlements in v1 beyond what Tauri needs for file dialogs and network client access. No microphone entitlement.
- Clipboard image priority matches Windows: PNG first.
- Working files live in the per-user Application Support directory.
- Keyboard shortcut for paste is Cmd+V. The rest of the editing keys follow the same commands as Windows, with Command in place of Control.

Behavior that must match Windows: import rules, trim semantics, manifest, WebP limits, error texts (same catalog), and the disabled state of the native adapter.

## Android

- `apps/android`: a TypeScript shell (`src/`) built by Vite into the assets of a Kotlin Gradle project (`android/`). There is no Rust and no server.
- The page is served by `WebViewAssetLoader` from `https://appassets.androidplatform.net/assets/www/`, a secure context where WebCodecs and MediaRecorder work offline.
- `minSdk 29`, `targetSdk 36`. The only permission is `INTERNET`. Cleartext traffic is off and backups are off.
- WebView hardening: no `file://` access (`content://` is allowed only so the file input can read what the system picker returns; the page CSP still blocks loading it), navigation outside the app origin opens the system browser, and remote debugging is on in debug builds only.
- The native bridge (`window.StikSoundNative`, `WebMessageListener`) is injected only for the app origin. Its operations are `fetchMyInstants`, `uploadChunk`, `save` (MediaStore `Download/StikSound`) and `share` (FileProvider over `cache/share` + `ACTION_SEND` chooser).
- Incoming `ACTION_SEND` and `ACTION_SEND_MULTIPLE`: images and video clips become the sticker, audio becomes the sound, and text with a link becomes a MyInstants import. Incoming files are capped at 100 MB.
- Transparent WebM is not offered (`transparentVideo: false`), matching the mobile web.

## Chrome extension

### Surface

The primary UI is a full browser tab opened by the toolbar action. A popup is only a launcher. The editor is not squeezed into the popup.

The extension does not add a content script. It does not request access to `web.whatsapp.com`.

### Permissions

Request only:

- `downloads`, to save the WebP, the audio, and the ZIP
- `storage`, for the small last-project pointer
- host permission for the MyInstants hosts listed in the MyInstants specification

Do not request `<all_urls>`, `tabs`, `scripting`, `webRequest`, or `nativeMessaging` in v1.

Clipboard images use the standard clipboard API inside the editor page on a user gesture. If Chrome denies the read, the UI tells the user to drop the file instead.

### Processing

The extension runs the web media engine defined in the architecture overview. It implements the same use cases as the desktop app.

When the engine returns `unsupported-codec` or `encode-failed`, the UI keeps the project intact and offers two actions: try another file, or download the portable package and open it in the desktop app.

### Distribution

Development loads the extension unpacked. The release artifact is a zip of the built extension. Chrome Web Store listing is a later milestone and must repeat the privacy statement: media stays on the device except for the MyInstants fetch the user requested.

## Parity rule

A project saved by any client opens in the other clients. Media bytes inside the package are the source of truth. A client may rebuild waveform peaks. It must not silently re-encode stored assets on open.

## Handoff to WhatsApp, all clients

v1 handoff is manual:

1. The user exports the bundle or the separate WebP and audio.
2. The user sends or attaches those files with whatever WhatsApp client they already use.

StikSound does not automate that step. The official third-party sticker API is an Android and iOS app contract and cannot be called from Windows, macOS, or Chrome.
