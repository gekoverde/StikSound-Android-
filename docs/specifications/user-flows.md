# User flows and screens

v1 uses one editor. Extra screens exist only where a separate context is clearer.

## Primary flow

1. Open StikSound. The editor starts on an unsaved project named "Untitled sticker".
2. Put a sticker on the canvas by paste, drop, or file picker.
3. Add audio by file picker, drop, or a pasted MyInstants URL.
4. Listen, then trim on the waveform until the duration is within the profile limit.
5. Play the preview. The sticker stays visible while the trimmed audio plays.
6. Export. Default profile is `sound-bundle`. The user can also export `standard-webp`.
7. The app writes the files and offers to reveal them on desktop, or downloads them in Chrome.

Any step except the first can be repeated. Replacing the sticker keeps the audio trim. Replacing the audio keeps the sticker fit.

## Screens

| Screen | What the user can do | v1 |
| --- | --- | --- |
| Editor | Import, preview, trim, export | Yes. This is the product |
| Export sheet | Choose profile and destination, see validation errors | Yes, as a panel or dialog on the editor |
| Settings | Language, last folder, about and licenses | Language is P1. About and open-source notices are P0 |
| Recent projects | Open or delete a local project | P1 on desktop |

There is no separate home wizard in v1. An empty editor with two drop zones is the start state.

## Editor layout

| Zone | Content |
| --- | --- |
| Top bar | Project name, save, export |
| Left | Sticker drop zone, file actions, source metadata |
| Center | Sticker preview and playback |
| Bottom | Waveform, range handles, duration, play selection, reset |
| Right | Audio source metadata, volume when implemented, export profile, limit, validation messages |

The layout collapses in a narrow Chrome window: preview on top, waveform under it, details in a drawer. The actions stay the same.

## Empty states

| State | Copy intent |
| --- | --- |
| No sticker | Invite paste or drop. Mention PNG, JPG, and WebP |
| No audio | Invite an audio file or a MyInstants link |
| Selection too long | Show the current duration and the limit. Export stays disabled |
| Native profile | Not shown as a selectable profile in v1 |

## Save behavior

- The first save asks for a place to write the portable package on desktop.
- Later saves overwrite that package using temp-file replace.
- Chrome autosaves the open project into IndexedDB and still requires an explicit download for a package the desktop app can open.
- Unsaved changes prompt on close in the desktop app.

## Error shape

Every failed operation returns a code the UI maps to a sentence:

| Code | When |
| --- | --- |
| `unsupported-image` | Content is not a supported image |
| `unsupported-audio` | Content is not a supported audio, or this client cannot decode it |
| `file-too-large` | Over the limit in NFR-014 |
| `url-rejected` | Host, scheme, or redirect failed the policy |
| `remote-unavailable` | HTTP error or timeout while fetching an allowed URL |
| `trim-out-of-range` | Selection is empty or over the profile limit |
| `sticker-too-large` | WebP could not be brought under 100 KB |
| `package-invalid` | Imported package failed schema, path, or size checks |
| `export-unsupported` | The selected profile is not implemented |
| `microphone-denied` | The user or the OS refused microphone access |
| `microphone-unavailable` | No microphone, it is busy, or the recorder failed |

The sentence includes the next action. Example: "This build of the Chrome extension cannot encode this clip. Download the project and open it in the StikSound desktop app."
