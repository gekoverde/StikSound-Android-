<div align="center">

<img src="docs/assets/app-icon.svg" alt="StikSound App Icon" width="120" height="120" />

# StikSound

**Crea stickers con sonido de hasta 5 o 10 segundos (con switch en pantalla) a partir de un PNG, JPG, WebP o GIF animado: pega tu sticker, elige un audio local o un enlace de MyInstants, recorta el fragmento exacto y exporta todo localmente.**

[![Usar en la Web](https://img.shields.io/badge/Usar%20en%20la%20Web-GitHub%20Pages-0ea5e9?style=for-the-badge&logo=githubpages&logoColor=white)](https://silverfeit.github.io/StikSound/)
[![Descargar](https://img.shields.io/github/v/release/SilverFeit/StikSound?style=for-the-badge&label=Descargar&color=25D366)](https://github.com/SilverFeit/StikSound/releases/latest)

[![Platforms](https://img.shields.io/badge/Platforms-Web%20%7C%20Windows%20%7C%20macOS%20%7C%20Chrome-25D366?style=flat-square)](#usar-en-la-web-vs-instalar)
[![Local Processing](https://img.shields.io/badge/Procesamiento-100%25%20local-10b981?style=flat-square)](#privacidad-y-seguridad)
[![License](https://img.shields.io/badge/License-MIT%20OR%20Apache--2.0-6366f1?style=flat-square)](LICENSE-MIT)

[**Usar en la Web**](https://silverfeit.github.io/StikSound/) · [**Descargar**](https://github.com/SilverFeit/StikSound/releases/latest) · [**Guía de uso**](#guía-de-uso-paso-a-paso) · [**Cómo funciona internamente**](#cómo-funciona-internamente) · [**Desarrollo**](#desarrollo)

</div>

---

## 🌐 Usar en la Web vs. Instalar

Puedes usar **StikSound directamente desde el navegador** sin instalar nada (funciona en PC, Android y iPhone como PWA), pero ten en cuenta la diferencia con **MyInstants**:

> [!IMPORTANT]
> **Versión Web ([silverfeit.github.io/StikSound](https://silverfeit.github.io/StikSound/)):** funciona **solo con audios ya descargados** en tu dispositivo (`MP3`, `WAV`, `M4A`, `OGG`, `AAC`) o el sonido de un video corto.
>
> **¿Quieres pegar enlaces directos de MyInstants?** Por seguridad de los navegadores (CORS), MyInstants bloquea la descarga directa desde páginas web. Para usar enlaces de MyInstants **toca instalar** la [app de escritorio (Windows/macOS) o la extensión de Chrome](https://github.com/SilverFeit/StikSound/releases/latest) — o bien descargar primero el MP3 desde MyInstants y elegirlo manualmente en la web.

| Característica | 🌐 Versión Web (GitHub Pages) | 💻 App Escritorio / 🧩 Extensión Chrome |
| --- | :---: | :---: |
| **Instalación requerida** | ❌ Ninguna ([abrir ahora](https://silverfeit.github.io/StikSound/)) | ✅ [Descargar release](https://github.com/SilverFeit/StikSound/releases/latest) |
| **Procesamiento 100% local** | ✅ | ✅ |
| **Stickers PNG / JPG / WebP / GIF** | ✅ | ✅ |
| **Videos cortos (`MP4`, `MOV`, `WebM`) como sticker** | ✅ | — |
| **Switch de duración `5s \| 10s`** | ✅ | ✅ |
| **Audios locales descargados** | ✅ | ✅ |
| **Pegar enlaces directos de MyInstants** | ❌ *(descarga el MP3 primero)* | ✅ |
| **WebM con transparencia** | ❌ *(solo MP4 en móvil/web)* | ✅ |

> [!TIP]
> **App Android (`apps/android`):** funciona sin conexión, permite **grabar el sonido con el micrófono**, acepta **enlaces de MyInstants** (descarga nativa sin CORS), recibe imágenes, GIF, vídeos y audios desde **Compartir** en cualquier app y envía el vídeo a **WhatsApp** con la hoja de compartir de Android. Ver [App Android](#app-android).

---

## Qué hace StikSound

StikSound combina **una imagen cuadrada** y **un fragmento de audio** en un archivo descargable o copiable. El máximo de ese fragmento se elige con el botón `5s | 10s` (por defecto, 10 segundos). Está pensado para preparar stickers con sonido para WhatsApp sin usar editores de video complejos y sin subir tus archivos a un servicio externo.

Concretamente permite:

- Usar stickers o memes en **PNG, JPG/JPEG, WebP o GIF**.
- Trabajar con **GIF animados**, reproduciéndolos en bucle durante el fragmento exportado.
- Agregar audio desde un archivo local **MP3, WAV, OGG, M4A o AAC**.
- Pegar un enlace de **MyInstants** y descargar ese sonido de forma validada.
- Seleccionar un fragmento de audio de **0,1 a 5 o 10 segundos** usando el selector integrado `5s | 10s`.
- Exportar un **MP4 compatible**, un **WebM con transparencia**, un **paquete ZIP** o un **WebP estático**.
- Guardar y reabrir proyectos `.stiksound.zip` con la imagen, el audio y la configuración del recorte.

> **Nota importante sobre WhatsApp:** El MP4 exportado es un video, no un sticker. Pegarlo en el chat lo envía como video y no lo agrega a los stickers. En algunas cuentas de la beta de Android se puede probar Crear sticker eligiendo ese video en la galería; la duración y el audio los decide WhatsApp, y esa beta no está documentada de forma oficial. El perfil `native-sound-sticker` sigue deshabilitado.

---

## Guía de uso paso a paso

### 1. Carga el sticker

Tienes tres formas de cargar la imagen:

- Pegarla directamente con `Ctrl + V` o `Cmd + V`.
- Arrastrarla sobre la zona central.
- Hacer clic en la zona central y elegir el archivo.

StikSound analiza los bytes reales del archivo, no solamente su extensión. Así comprueba el formato, las dimensiones, si tiene transparencia y si es un GIF animado.

### 2. Encuadra la imagen en formato 1:1

Los stickers usan formato cuadrado. Si la imagen original no es cuadrada:

- StikSound calcula automáticamente un recorte `1:1` centrado.
- Puedes mover el mouse sobre la imagen, **sin hacer clic**, para desplazar el encuadre horizontal o verticalmente.
- La salida nunca se escala hacia arriba artificialmente: usa el lado menor de la imagen, con un máximo de `512 × 512 px`.
- Las dimensiones se redondean a números pares para evitar incompatibilidades con codificadores de video.

### 3. Agrega el audio

También tienes tres opciones:

- Arrastrar un archivo de audio sobre la barra inferior.
- Pulsar el botón **Audio** y elegir un archivo.
- Pegar un enlace válido de MyInstants.

Límites del archivo de origen:

| Regla | Límite |
| --- | ---: |
| Tamaño máximo del audio | 25 MB |
| Duración máxima del audio importado | 3 minutos |
| Duración mínima del fragmento seleccionado | 0,1 segundos |
| Duración máxima del fragmento exportado | 5 o 10 segundos (botón; por defecto 10) |

Si el audio dura lo mismo o menos que el máximo elegido, StikSound selecciona el audio completo automáticamente. Si dura más, selecciona los primeros 5 o 10 segundos (según el botón; 10 por defecto) y te permite mover esa ventana.

### 4. Ajusta el fragmento de sonido

La barra inferior muestra una forma de onda calculada a partir del audio real:

- Las barras representan picos mínimos y máximos en 1024 divisiones del audio.
- Al hacer clic sobre la onda, la ventana de recorte se centra cerca de ese punto.
- Si el audio supera el máximo elegido (`5s` o `10s`), aparece un deslizador para mover la ventana a lo largo del archivo.
- El indicador de la derecha muestra `seleccionado / máximo`, por ejemplo `10.0s / 10.0s`.
- El botón de reproducción escucha exactamente el tramo seleccionado.

### 5. Elige el fondo

Si el sticker tiene transparencia aparecen estas opciones:

- **Transparente:** exporta WebM con canal alfa cuando el navegador o WebView lo admite.
- **Blanco / Negro / Color:** compone la imagen sobre un fondo sólido para MP4.

MP4 no conserva transparencia real; por eso la transparencia se rellena con el color elegido. WebM sí puede conservar canal alfa mediante VP9 cuando WebCodecs está disponible.

### 6. Previsualiza, copia o descarga

Botones principales:

| Botón | Acción |
| --- | --- |
| `✕` | Borra sticker, audio, recorte y vista previa para empezar de cero. |
| `➔` | Genera la vista previa compatible e intenta copiar el resultado al portapapeles. |
| `⬇` | Abre el selector de formato y descarga el archivo elegido. |
| `⋯` | Abre opciones de proyecto, idioma y licencias. |

Si el sistema operativo o el navegador no permite copiar videos al portapapeles, usa `⬇` y comparte el archivo descargado manualmente.

---

## Formatos de entrada y salida

### Entrada de imagen

| Formato | Compatibilidad |
| --- | --- |
| PNG | Compatible, incluida transparencia. |
| JPG/JPEG | Compatible, sin transparencia. |
| WebP | Compatible como imagen de entrada; la animación WebP no es el flujo principal de v1. |
| GIF | Compatible; los GIF animados se decodifican por cuadros y se repiten en bucle. |
| MP4, MOV, WebM | Solo en la versión web, como clip de entrada de hasta 60 segundos. La exportación sigue el máximo de 5 o 10 segundos. |

Límites de seguridad para imágenes:

- 20 MB por archivo.
- Máximo 8000 px de ancho o alto.
- Máximo 40 megapíxeles decodificados.

### Entrada de audio

| Formato | Compatibilidad |
| --- | --- |
| MP3 | Compatible a través del decodificador del navegador/WebView o Rust. |
| WAV | Compatible; además existe un decodificador PCM de respaldo. |
| OGG | Compatible cuando el decodificador de la plataforma lo admite. |
| M4A/AAC | Compatible cuando el decodificador de la plataforma lo admite. |

### Salida

| Formato | Uso recomendado | Qué contiene |
| --- | --- | --- |
| MP4 | Máxima compatibilidad | Video cuadrado con fondo sólido y audio AAC cuando WebCodecs está disponible. |
| WebM | Alta calidad/transparencia | Video VP9 con alfa y audio Opus cuando WebCodecs está disponible. |
| ZIP `.stiksound.zip` | Paquete portable/proyecto | Imagen, audio y metadatos del proyecto o paquete. |
| WebP | Sticker estático | Una imagen `1:1` sin audio, optimizada para entrar en el límite de 100 KB. |

La duración del video exportado sigue al fragmento de audio seleccionado, con una tolerancia de validación de ±50 ms.

---

## Cómo funciona internamente

### Flujo general

```text
Sticker/Imagen + Audio
        │
        ▼
Validación y lectura de formatos
        │
        ├─ Imagen: dimensiones, alpha, animación y recorte 1:1
        │
        └─ Audio: duración, canales, sample rate, mezcla mono y forma de onda
        │
        ▼
Proyecto en memoria
        │
        ├─ sticker
        ├─ audio
        ├─ start_ms / end_ms del fragmento
        └─ formato de exportación elegido
        │
        ▼
Validación antes de exportar
        │
        ▼
Renderizado local
        │
        ├─ video MP4/WebM
        ├─ paquete ZIP
        └─ WebP estático
        │
        ▼
Vista previa, copia o descarga
```

### Pipeline de imagen

1. Se leen los bytes del archivo y se identifica el formato por cabecera.
2. Se rechazan imágenes demasiado grandes o potencialmente peligrosas por dimensiones.
3. Se calcula el recorte cuadrado desde `crop_x` y `crop_y` normalizados.
4. En imágenes estáticas se dibuja un único cuadro.
5. En GIF animados se decodifican los cuadros y sus tiempos; luego se programa una secuencia en bucle que cubre exactamente la duración seleccionada.
6. Para MP4 se compone sobre el color de fondo elegido; para WebM se conserva el canal alfa cuando el codificador lo permite.

### Pipeline de audio

1. Se prueba el archivo y se obtiene duración, sample rate y número de canales.
2. El audio se decodifica y se mezcla a mono.
3. Se calculan 1024 picos para dibujar la forma de onda.
4. El fragmento se recorta con `start_ms` y `end_ms` enteros en milisegundos.
5. El fragmento se remuestrea a **48 kHz mono**, que es la base usada por la exportación.
6. La validación exige una selección entre **100 ms y el máximo elegido (5.000 o 10.000 ms; por defecto 10.000)**.

### Codificación de video

StikSound usa dos rutas locales, en este orden:

1. **WebCodecs + muxers TypeScript:** cuando la plataforma expone `VideoEncoder` y `AudioEncoder`, genera MP4 H.264/AAC o WebM VP9/Opus sin invocar servicios externos.
2. **Canvas + MediaRecorder:** si WebCodecs no está disponible, dibuja el canvas, captura el stream y graba audio/video con los códecs que soporte esa plataforma.

Si ninguna de las dos rutas existe, la exportación de video devuelve un error estructurado en lugar de fallar silenciosamente.

### Proyectos `.stiksound.zip`

Un proyecto guardado contiene:

```text
manifest.json
assets/<archivo-de-imagen>
assets/<archivo-de-audio>
```

El manifiesto guarda:

- identificadores y nombres de assets;
- formato, dimensiones y transparencia de la imagen;
- duración, sample rate y origen del audio;
- `start_ms`, `end_ms`, volumen y fades;
- perfil de exportación activo.

Al abrirlo se validan las rutas internas para impedir entradas maliciosas como `../` y se recalcula la forma de onda.

---

## Arquitectura del repositorio

```text
apps/
  desktop/       App Tauri para Windows/macOS
  extension/     Extensión Chrome Manifest V3
  web/           App Web / PWA desplegada en GitHub Pages
  android/       App Android: shell TS (src/) + proyecto Gradle Kotlin (android/)
packages/
  core/          Modelo de proyecto, invariantes, validación y casos de uso
  ui/            Editor React, barra de recorte y textos i18n
  media-web/     Sniffing, decodificación, trim, waveform, mux y ZIP en TypeScript
  providers/     Extracción y política de URLs de MyInstants
crates/
  audio-engine/  Probe/decodificación/trim de audio en Rust
  image-engine/  Probe y utilidades de imagen en Rust
  video-engine/  Validación y mux de video en Rust
  project-store/ Escritura atómica y paquetes en Rust
docs/            Requisitos, arquitectura, especificaciones y decisiones
```

La idea principal es que la UI no contiene reglas de negocio: React llama a casos de uso de `packages/core`, y esos casos de uso delegan el trabajo de medios en un motor intercambiable (`WebMediaEngine` o componentes Rust en desktop).

---

## Instalación

### Windows y macOS

1. Abre [**Releases**](https://github.com/SilverFeit/StikSound/releases/latest).
2. Descarga el instalador o ejecutable para tu plataforma:
   - Windows: archivo `windows-x64`.
   - macOS: archivo `macos-universal`.
3. Abre StikSound. No necesitas instalar FFmpeg ni un editor de video aparte para el flujo principal.

En macOS, si aparece el aviso de desarrollador no verificado, haz clic derecho sobre la app y elige **Abrir**.

### Extensión de Chrome, Edge o Brave

1. Descarga `StikSound-*-chrome-extension.zip` desde [**Releases**](https://github.com/SilverFeit/StikSound/releases/latest).
2. Descomprímelo en una carpeta permanente.
3. Abre `chrome://extensions/`.
4. Activa **Modo de desarrollador**.
5. Pulsa **Cargar descomprimida** y selecciona la carpeta descomprimida.
6. Haz clic en el icono de StikSound: se abrirá el editor en una pestaña.

---

## Privacidad y seguridad

- No existe un servidor de StikSound que reciba tus imágenes o audios.
- El procesamiento de medios se hace localmente en la app o en la pestaña de la extensión.
- La única descarga de red integrada es MyInstants, y solo cuando pegas explícitamente un enlace.
- MyInstants está restringido por política de URLs:
  - solo HTTPS;
  - solo `myinstants.com` y `www.myinstants.com`;
  - sin usuario/contraseña embebidos;
  - sin puertos distintos de 443;
  - máximo 2 redirecciones;
  - máximo 25 MB por audio;
  - tiempo máximo de descarga de 20 segundos.
- En desktop, la descarga se realiza desde el backend Rust para evitar limitaciones de CORS y aplica validaciones adicionales de direcciones IP privadas o reservadas.
- En Android, la descarga la hace código Kotlin nativo con la misma política (incluido el bloqueo de IPs privadas). La app pide `INTERNET` (solo para MyInstants) y `RECORD_AUDIO` (solo al pulsar **🎙 Grabar**, con el diálogo del sistema), no usa tráfico HTTP sin cifrar y el puente JS-nativo solo acepta mensajes del origen propio de la app.
- Los paquetes ZIP se validan contra path traversal antes de abrirse.
- Auditoría de seguridad del fork: [docs/security-audit-2026-11-25.md](docs/security-audit-2026-11-25.md).
- Los sonidos descargados desde MyInstants pertenecen a sus respectivos autores.

---

## Desarrollo

### Requisitos

- Node.js 22 o superior.
- npm 10 o superior.
- Rust stable (solo para la app de escritorio).
- Android Studio o JDK 17+ con el Android SDK 36 (solo para la app Android).
- Para compilar la app Tauri en Linux pueden hacer falta las dependencias nativas de WebKitGTK indicadas por la documentación de Tauri; en Windows y macOS se usan los WebViews del sistema.

### Instalar dependencias

```bash
git clone https://github.com/SilverFeit/StikSound.git
cd StikSound
npm install
```

### Ejecutar validaciones

```bash
npm run typecheck
npm test
npm run build
cargo test --workspace --exclude stiksound-desktop
```

### Ejecutar la extensión en modo desarrollo

```bash
npm run build --workspace=@stiksound/extension
```

Luego carga `apps/extension/dist` como extensión descomprimida desde `chrome://extensions/`.

Para reconstruir automáticamente al editar:

```bash
npm run dev --workspace=@stiksound/extension
```

### Ejecutar el frontend desktop con Vite

```bash
npm run dev --workspace=@stiksound/desktop
```

### Ejecutar la app Tauri completa

```bash
cd apps/desktop
npx tauri dev
```

### Compilar la app desktop

```bash
cd apps/desktop
npx tauri build
```

### App Android

Requisitos: Android Studio (o JDK 17+ y el Android SDK con la plataforma 36). No hace falta Rust.

```bash
npm install
npm run build -w @stiksound/android
```

Abre `apps/android/android` en Android Studio y pulsa **Run**, o compila desde la terminal:

```bash
cd apps/android/android
./gradlew testDebugUnitTest assembleDebug
```

El APK queda en `apps/android/android/app/build/outputs/apk/debug/app-debug.apk`. Al compilar desde Gradle, el paquete web se regenera automáticamente con Vite (sáltalo con `-PskipWebBuild`).

Cómo funciona:

- El editor es el mismo de `packages/ui` y se sirve desde los assets del APK en `https://appassets.androidplatform.net` (`WebViewAssetLoader`), así que no necesita servidor ni conexión.
- `MainActivity.kt` aloja la WebView, abre el selector de archivos del sistema y recibe lo que compartes a StikSound (imagen, GIF, vídeo, audio o un enlace de MyInstants).
- `NativeBridge.kt` expone `window.StikSoundNative` (`WebMessageListener`) para descargar de MyInstants, guardar (vídeos en la **Galería** › `Películas/StikSound`, WebP en `Imágenes/StikSound`, ZIP en `Descargas/StikSound`) y abrir la hoja de compartir (WhatsApp, Telegram…).
- `MyInstantsFetcher.kt` es un port línea a línea de la política de desktop, con tests JVM que replican los de TypeScript.
- **🎙 Grabar** usa el micrófono: la primera vez Android muestra su diálogo de permiso (`RECORD_AUDIO`). La WebView solo concede la captura de audio (nunca la cámara) a la página propia de la app. La toma se convierte a WAV de 48 kHz y se corta sola a los 30 s; después se recorta a 5 o 10 s como cualquier audio. Si deniegas el permiso dos veces, Android ya no vuelve a preguntar y la app abre los Ajustes de StikSound para activarlo a mano.

> [!NOTE]
> **¿Por qué llega como vídeo a WhatsApp?** Ninguna app de terceros puede enviar ni instalar un sticker con sonido: WhatsApp no tiene API para eso. Si compartes el MP4, WhatsApp lo manda como vídeo. Para convertirlo en sticker con sonido:
>
> 1. En StikSound pulsa **⬇ Guardar** → *Vídeo MP4 en la Galería* (elige **5s** para que WhatsApp no lo recorte).
> 2. En WhatsApp abre un chat → 😊 → **Stickers** → **Crear** (＋) y elige el vídeo de *Películas › StikSound*.
>
> Esa opción de WhatsApp solo aparece en algunas cuentas de la beta de Android y WhatsApp decide la duración y el audio. Consulta [docs/specifications/whatsapp.md](docs/specifications/whatsapp.md).

---

## Solución de problemas

| Problema | Causa probable | Qué hacer |
| --- | --- | --- |
| “Enlace rechazado por seguridad” | La URL no es HTTPS de MyInstants o tiene formato no permitido | Copia el enlace público del instante o el archivo directo desde `myinstants.com`. |
| “No se pudo leer este audio” | El archivo está corrupto o el códec no existe en esa plataforma | Prueba con MP3 o WAV, o exporta nuevamente el audio desde otra app. |
| El video transparente sale con fondo | Elegiste MP4 o la plataforma no soporta alfa VP9 | Usa la salida WebM transparente. |
| El botón copiar no pega en WhatsApp | El navegador/sistema bloquea videos en el portapapeles | Descarga el archivo con `⬇` y compártelo manualmente. |
| El audio suena recortado | El fragmento seleccionado está limitado al máximo elegido (5 o 10 segundos) | Cambia el botón `5s \| 10s`, mueve la ventana de recorte o usa un audio más corto. |
| El WebP falla por tamaño | WhatsApp exige stickers estáticos pequeños | Usa una imagen más simple o exporta como video. |

---

## Documentación adicional

- Índice técnico: [docs/README.md](docs/README.md)
- Arquitectura: [docs/architecture/overview.md](docs/architecture/overview.md)
- Requisitos funcionales: [docs/requirements/functional-requirements.md](docs/requirements/functional-requirements.md)
- Exportación: [docs/specifications/export.md](docs/specifications/export.md)
- Seguridad: [docs/specifications/security.md](docs/specifications/security.md)
- Plan de pruebas: [docs/qa/test-plan.md](docs/qa/test-plan.md)

## License

Dual-licensed under either of:

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE))
- MIT License ([LICENSE-MIT](LICENSE-MIT))

at your option (`MIT OR Apache-2.0`).
