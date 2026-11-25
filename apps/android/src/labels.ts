import type { LocaleCode } from "@stiksound/core";
import type { UiLabels } from "@stiksound/ui";

/**
 * Android wording. Saved videos go to the Gallery (Movies/StikSound) because WhatsApp's own
 * "Create sticker" only lists gallery media; sharing a file to WhatsApp always sends a video.
 */
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
    downloadTooltip: "Guardar en la Galería (para crear el sticker en WhatsApp)",
    downloadBtnLabel: "Guardar",
    downloadChooseFormat: "Elige qué guardar:",
    downloadFmtMp4: "Vídeo MP4 en la Galería (para Crear sticker en WhatsApp)",
    exportSuccessVideo:
      "Guardado en la Galería (Películas › StikSound). Para convertirlo en sticker con sonido: en WhatsApp abre un chat → 😊 → Stickers → Crear (＋) y elige este vídeo. Esa opción solo aparece en algunas cuentas de la beta de Android y WhatsApp decide la duración y el audio (usa 5s para que no lo recorte).",
    exportSuccessWebp: "Sticker WebP guardado en la Galería (Imágenes › StikSound). Es una imagen estática, sin audio.",
    shareDoneToast:
      "Al compartirlo, WhatsApp lo envía como vídeo: ninguna app puede mandar un sticker con sonido. Para crear el sticker, guárdalo con ⬇ (va a la Galería) y créalo desde WhatsApp → 😊 → Stickers → Crear.",
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
    downloadTooltip: "Save to the Gallery (to create the sticker in WhatsApp)",
    downloadBtnLabel: "Save",
    downloadChooseFormat: "Choose what to save:",
    downloadFmtMp4: "MP4 video to the Gallery (for Create sticker in WhatsApp)",
    exportSuccessVideo:
      "Saved to the Gallery (Movies › StikSound). To turn it into a sound sticker: in WhatsApp open a chat → 😊 → Stickers → Create (＋) and pick this video. That option only shows up on some Android beta accounts, and WhatsApp decides the duration and the audio (use 5s so it isn't cut).",
    exportSuccessWebp: "WebP sticker saved to the Gallery (Pictures › StikSound). It is a still image with no audio.",
    shareDoneToast:
      "When shared, WhatsApp sends it as a video: no app can send a sound sticker. To create the sticker, save it with ⬇ (it goes to the Gallery) and create it from WhatsApp → 😊 → Stickers → Create.",
    exportSuccessBundle: "Bundle saved to Downloads/StikSound. It holds the image and the sound as separate files.",
    aboutRights:
      "Android app. Everything runs on your phone; it only goes online to download a MyInstants link you paste or share. MyInstants sounds belong to their authors. The video lasts at most 5 or 10 seconds (10 by default)."
  }
};
