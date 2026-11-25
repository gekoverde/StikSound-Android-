# WhatsApp constraints

This document separates published sticker rules from observations about sound stickers. Implementation follows the published rules for ordinary stickers. It does not invent a sound-sticker file from the observations.

## Published static and animated stickers

Sources, checked 2026-11-24:

- WhatsApp Help Center, custom stickers and sticker packs
- WhatsApp sticker app requirements on GitHub (`WhatsApp/stickers`, Android and iOS READMEs)
- WhatsApp Cloud API sticker message limits

| Rule | Static | Animated |
| --- | --- | --- |
| Format | WebP | WebP |
| Pixel size | 512 x 512 | 512 x 512 |
| Maximum file size | 100 KB | 500 KB |
| Animation | None | Total duration at most 10 seconds. Frame duration at least 8 ms |
| First frame | The full image | The full image, because playback ends on the first frame |
| Pack size | 3 to 30 stickers | 3 to 30 stickers, and a pack cannot mix static and animated |
| Tray icon | 96 x 96 static image, maximum 50 KB, when building a pack | Same |

WhatsApp recommends an 8 px white stroke so art stays readable on different backgrounds. StikSound leaves that stroke off unless the user opts in (P2).

The third-party pack contract is an Android content provider plus an iOS pasteboard flow inside a mobile app. Windows, macOS, and Chrome cannot register a pack through that contract. v1 does not generate a pack installer. It generates files.

`SEND_STICKER` on Android accepts `image/webp`. It is not a desktop API and it has no audio attachment.

## Sound stickers, as publicly reported

As of 2026-11-24:

- WABetaInfo and Android Authority reported a sound-sticker feature in Android development builds around October 2026 (beta series 2.26.41). Reported authoring behavior: attach a recording or a file to a still sticker, trim to about 10 seconds, and show a volume icon. Video-based stickers were reported to keep about 5 seconds of audio.
- On 2026-11-24, users in some regions reported receiving stickers that play audio from a speaker icon. Meta had not published a schedule or a third-party specification. Press reports that day still had not confirmed custom creation by end users.

Update, 2026-11-25: WABetaInfo reported that creating a sound sticker from a gallery video is a gradual Android beta. It is associated with some accounts on Android beta 2.26.47.1, not with every Android version. Meta has not published a format, codec, duration limit, audio rule, or version matrix. There is no API contract. WhatsApp reconverts the chosen video and decides the duration and the audio. StikSound cannot guarantee that path.

The published sticker contract remains WebP at 512×512 without audio. The `native-sound-sticker` profile stays disabled. An exported MP4 is a video (H.264 + AAC, square, at most the selected preset of 5 or 10 seconds, default 10, solid background), not a sticker. Pasting or sharing that file in a chat sends a video. WhatsApp does not add it to the sticker tray.

StikSound treats the press reports as product context for the 10 second default limit. The editor can switch that limit to 5 seconds. They are not an API.

## Unofficial client observations

Public reverse-engineering notes of Android 2.26.41.x describe an `audioMessage` field on the sticker message and a client encoder named like an Opus encoder. Those notes describe the private message protocol.

Consequences for StikSound:

- A sound sticker, if the notes are right, is a chat message with an image plus an audio attachment. It is not a WebP with an MP3 inside it.
- Writing a special WebP will not make WhatsApp play audio.
- Producing a raw protocol message would mean speaking WhatsApp's private transport. That is out of scope and is not a planned feature. See decision 003.
- The bundle's Ogg Opus file is a practical interchange format and a plausible future input to an official importer. It is not a claim of protocol compatibility.

## What v1 tells the user

After a video export, the success text says the file downloaded, that WhatsApp does not import it as a sticker, and that only some Android beta accounts can try Create sticker by picking the video from the gallery. It also says WhatsApp decides the duration and the audio, and that the beta is not officially documented. The copy toast says that pasting the file in the chat sends a video and does not add it to stickers.

On Android, Save puts the MP4 in the Gallery (`Movies/StikSound`) so it shows up in WhatsApp's Create sticker picker, and the success text lists those steps. After Share, a notice says WhatsApp receives a video and points to Save + Create sticker. Neither text promises that the option exists on every account.

After a sound-bundle export, the success text says the ZIP contains the sticker and the sound as two files, and that WhatsApp may still treat the image as a normal sticker.

The success text does not call the MP4 a WhatsApp sound sticker.

## Future verification record

When someone tests native import, add `docs/specifications/whatsapp-native-verification.md` with:

- date
- WhatsApp version and operating system
- exact user action used to import
- whether a second device played the audio
- the adapter version

Enabling `native-sound-sticker` requires that file and a passing test on at least one current Android build and one current iOS build.
