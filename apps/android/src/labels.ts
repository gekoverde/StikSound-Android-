import type { LocaleCode } from "@stiksound/core";
import type { UiLabels } from "@stiksound/ui";

/** Android wording: output goes to the share sheet or Download/StikSound, input can come from "Share". */
export const androidLabels: Record<LocaleCode, Partial<UiLabels>> = {
  es: {
    exportTooltip: "Crear el video y compartirlo (WhatsApp, Telegram…)",
    exportDisabledMissingSticker: "Elige o comparte un sticker primero",
    exportDisabledMissingAudio: "Agrega un audio o un enlace de MyInstants",
    stickerDropTitle: "Toca para elegir tu sticker",
    stickerDropHint: "Imagen, GIF o video corto. También puedes compartirlo a StikSound desde la galería",
    hoverCropHint: "Arrastra para encuadrar",
    audioInputPlaceholder: "Pega un enlace de MyInstants…",
    audioPickBtn: "🎵 Audio",
    copyAgainBtn: "Compartir",
    downloadTooltip: "Guardar en Descargas/StikSound",
    downloadBtnLabel: "Guardar",
    downloadChooseFormat: "Elige qué guardar:",
    exportSuccessVideo:
      "Guardado en Descargas/StikSound. WhatsApp no lo importa como sticker. En algunas cuentas de la beta de Android puedes probar Crear sticker y elegir este video en la galería; la duración y el audio los decide WhatsApp.",
    exportSuccessWebp: "Sticker WebP guardado en Descargas/StikSound. Es una imagen estática, sin audio.",
    exportSuccessBundle: "Paquete guardado en Descargas/StikSound. Contiene la imagen y el audio por separado.",
    aboutRights:
      "App Android. Todo se procesa en tu teléfono; solo se conecta a internet para descargar el enlace de MyInstants que pegues o compartas. Los sonidos de MyInstants pertenecen a sus autores. El video dura como máximo 5 o 10 segundos (por defecto, 10)."
  },
  en: {
    exportTooltip: "Make the video and share it (WhatsApp, Telegram…)",
    exportDisabledMissingSticker: "Pick or share a sticker first",
    exportDisabledMissingAudio: "Add a sound or a MyInstants link",
    stickerDropTitle: "Tap to choose your sticker",
    stickerDropHint: "Image, GIF or short video. You can also share it to StikSound from your gallery",
    hoverCropHint: "Drag to frame",
    audioInputPlaceholder: "Paste a MyInstants link…",
    audioPickBtn: "🎵 Sound",
    copyAgainBtn: "Share",
    downloadTooltip: "Save to Downloads/StikSound",
    downloadBtnLabel: "Save",
    downloadChooseFormat: "Choose what to save:",
    exportSuccessVideo:
      "Saved to Downloads/StikSound. WhatsApp does not import it as a sticker. Some Android beta accounts can try Create sticker and pick this video from the gallery; WhatsApp decides the duration and the audio.",
    exportSuccessWebp: "WebP sticker saved to Downloads/StikSound. It is a still image with no audio.",
    exportSuccessBundle: "Bundle saved to Downloads/StikSound. It holds the image and the sound as separate files.",
    aboutRights:
      "Android app. Everything runs on your phone; it only goes online to download a MyInstants link you paste or share. MyInstants sounds belong to their authors. The video lasts at most 5 or 10 seconds (10 by default)."
  }
};
