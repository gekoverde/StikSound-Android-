package app.stiksound.android

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.webkit.MimeTypeMap
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import androidx.core.content.IntentCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import java.io.File
import java.util.concurrent.Executors

/**
 * Hosts the shared StikSound editor (packages/ui) in a WebView served from the APK assets.
 * Everything runs on the device; the only network use is a MyInstants link the user provides.
 */
class MainActivity : ComponentActivity(), NativeBridge.Host {

    private lateinit var webView: WebView
    private lateinit var bridge: NativeBridge
    private val blobs = BlobStore()
    private val ioExecutor = Executors.newSingleThreadExecutor()

    private var fileCallback: ValueCallback<Array<Uri>>? = null

    private val pickFiles = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val callback = fileCallback ?: return@registerForActivityResult
        fileCallback = null
        callback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data))
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(BACKGROUND),
            navigationBarStyle = SystemBarStyle.dark(BACKGROUND),
        )
        super.onCreate(savedInstanceState)

        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            Toast.makeText(this, R.string.webview_missing, Toast.LENGTH_LONG).show()
            finish()
            return
        }

        val root = FrameLayout(this).apply { setBackgroundColor(BACKGROUND) }
        webView = WebView(this).apply { setBackgroundColor(BACKGROUND) }
        root.addView(webView, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        setContentView(root)

        // Keep the editor clear of the status bar, navigation bar, cutouts and keyboard.
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime(),
            )
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            // The page is served from the APK through WebViewAssetLoader, so it never needs file://.
            allowFileAccess = false
            // Required so <input type=file> can read the content:// URI the system picker returns.
            // The page CSP (default-src 'self' blob: data:) still blocks loading content:// URLs.
            allowContentAccess = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setSupportMultipleWindows(false)
            javaScriptCanOpenWindowsAutomatically = false
        }

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/blob/", blobs.pathHandler)
            .build()

        webView.webViewClient = object : WebViewClientCompat() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assetLoader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                if (url.host == APP_HOST && url.scheme == "https") return false
                // Any other link (licenses, MyInstants pages) opens in the user's browser, never in-app.
                if (url.scheme == "https") {
                    try {
                        startActivity(Intent(Intent.ACTION_VIEW, url).addCategory(Intent.CATEGORY_BROWSABLE))
                    } catch (_: ActivityNotFoundException) {
                    }
                }
                return true
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams,
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                return try {
                    pickFiles.launch(buildPickerIntent(params))
                    true
                } catch (_: ActivityNotFoundException) {
                    fileCallback = null
                    false
                }
            }
        }

        bridge = NativeBridge(blobs, this)
        WebViewCompat.addWebMessageListener(webView, "StikSoundNative", setOf(NativeBridge.ORIGIN), bridge)

        webView.loadUrl(START_URL)
        if (savedInstanceState == null) handleShareIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleShareIntent(intent)
    }

    override fun onDestroy() {
        if (::bridge.isInitialized) bridge.shutdown()
        ioExecutor.shutdownNow()
        if (::webView.isInitialized) webView.destroy()
        super.onDestroy()
    }

    // ----- "Share to StikSound" ---------------------------------------------------------------

    private fun handleShareIntent(intent: Intent?) {
        if (intent == null) return
        when (intent.action) {
            Intent.ACTION_SEND -> {
                val stream = IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java)
                if (stream != null) {
                    importUris(listOf(stream), intent.type)
                } else {
                    val text = intent.getStringExtra(Intent.EXTRA_TEXT).orEmpty()
                    val url = IncomingReader.extractUrl(text)
                    if (url != null) bridge.pushIncomingUrl(url) else toast(R.string.incoming_unsupported)
                }
            }
            Intent.ACTION_SEND_MULTIPLE -> {
                val streams = IntentCompat.getParcelableArrayListExtra(intent, Intent.EXTRA_STREAM, Uri::class.java)
                if (!streams.isNullOrEmpty()) importUris(streams, intent.type)
            }
        }
    }

    private fun importUris(uris: List<Uri>, fallbackMime: String?) {
        ioExecutor.execute {
            // One sticker and one sound at most: the editor holds a single pair.
            val seenKinds = mutableSetOf<String>()
            for (uri in uris) {
                try {
                    val item = IncomingReader.read(contentResolver, uri, fallbackMime)
                    if (!seenKinds.add(item.kind)) continue
                    bridge.pushIncomingBlob(item.kind, item.bytes, item.mime, item.name)
                } catch (e: BridgeException) {
                    toast(if (e.code == "file-too-large") R.string.incoming_too_large else R.string.incoming_unsupported)
                } catch (_: Exception) {
                    toast(R.string.incoming_read_failed)
                }
            }
        }
    }

    // ----- File picker for <input type="file"> -------------------------------------------------

    private fun buildPickerIntent(params: WebChromeClient.FileChooserParams): Intent {
        val mimes = acceptToMimes(params.acceptTypes)
        val intent = Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE)
        val families = mimes.map { it.substringBefore('/') }.toSet()
        intent.type = when {
            mimes.size == 1 -> mimes.first()
            families.size == 1 && mimes.isNotEmpty() -> "${families.first()}/*"
            else -> "*/*"
        }
        if (mimes.size > 1) intent.putExtra(Intent.EXTRA_MIME_TYPES, mimes.toTypedArray())
        if (params.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) {
            intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
        }
        return intent
    }

    // Turns `accept` values such as "image/png,.gif" or an audio wildcard into MIME types the picker understands.
    private fun acceptToMimes(acceptTypes: Array<String>?): List<String> {
        val map = MimeTypeMap.getSingleton()
        return acceptTypes.orEmpty()
            .flatMap { it.split(',') }
            .map { it.trim().lowercase() }
            .filter { it.isNotEmpty() }
            .mapNotNull { entry ->
                when {
                    entry.contains('/') -> entry
                    entry.startsWith('.') -> map.getMimeTypeFromExtension(entry.removePrefix(".").substringAfterLast('.'))
                    else -> null
                }
            }
            .distinct()
    }

    // ----- NativeBridge.Host --------------------------------------------------------------------

    override fun saveToDownloads(name: String, mime: String, bytes: ByteArray): String =
        ExportStore.saveToDownloads(this, name, mime, bytes)

    override fun stageForShare(name: String, bytes: ByteArray): File =
        ExportStore.stageForShare(this, name, bytes)

    override fun launchShare(file: File, mime: String) {
        val uri = FileProvider.getUriForFile(this, "$packageName.files", file)
        val send = Intent(Intent.ACTION_SEND).apply {
            type = mime
            putExtra(Intent.EXTRA_STREAM, uri)
            clipData = ClipData.newRawUri(file.name, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        try {
            startActivity(Intent.createChooser(send, getString(R.string.share_chooser_title)))
        } catch (_: ActivityNotFoundException) {
            toast(R.string.no_share_target)
        }
    }

    private fun toast(resId: Int) {
        runOnUiThread { Toast.makeText(this, resId, Toast.LENGTH_LONG).show() }
    }

    companion object {
        private const val APP_HOST = "appassets.androidplatform.net"
        private const val START_URL = "https://$APP_HOST/assets/www/index.html"
        private val BACKGROUND = Color.parseColor("#111318")
    }
}
