import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
}

// ---------------------------------------------------------------------------------------------
// Release signing. The keystore never lives in the repo. Sources, in order:
//   1. Environment (CI): STIKSOUND_KEYSTORE_FILE, STIKSOUND_KEYSTORE_PASSWORD,
//      STIKSOUND_KEY_ALIAS, STIKSOUND_KEY_PASSWORD
//   2. apps/android/android/keystore.properties (git-ignored):
//      storeFile=..., storePassword=..., keyAlias=..., keyPassword=...
// Without either, assembleRelease still works and produces an unsigned APK.
// ---------------------------------------------------------------------------------------------
data class ReleaseKey(val storeFile: File, val storePassword: String, val keyAlias: String, val keyPassword: String)

fun releaseKey(): ReleaseKey? {
    val env = System.getenv()
    val envFile = env["STIKSOUND_KEYSTORE_FILE"]
    if (!envFile.isNullOrBlank()) {
        return ReleaseKey(
            file(envFile),
            env["STIKSOUND_KEYSTORE_PASSWORD"].orEmpty(),
            env["STIKSOUND_KEY_ALIAS"].orEmpty(),
            env["STIKSOUND_KEY_PASSWORD"]?.takeIf { it.isNotBlank() } ?: env["STIKSOUND_KEYSTORE_PASSWORD"].orEmpty(),
        )
    }
    val propsFile = rootProject.file("keystore.properties")
    if (!propsFile.isFile) return null
    val props = Properties().apply { propsFile.inputStream().use { load(it) } }
    val storeFile = props.getProperty("storeFile")?.takeIf { it.isNotBlank() } ?: return null
    return ReleaseKey(
        rootProject.file(storeFile),
        props.getProperty("storePassword").orEmpty(),
        props.getProperty("keyAlias").orEmpty(),
        props.getProperty("keyPassword")?.takeIf { it.isNotBlank() } ?: props.getProperty("storePassword").orEmpty(),
    )
}

// Version follows apps/android/package.json, which the release chore bumps with the rest of the repo.
val appVersion: String = Regex("\"version\"\\s*:\\s*\"(\\d+\\.\\d+\\.\\d+)\"")
    .find(rootProject.projectDir.parentFile.resolve("package.json").readText())
    ?.groupValues?.get(1)
    ?: throw GradleException("StikSound: could not read the version from apps/android/package.json")
val appVersionCode: Int = appVersion.split('.').map(String::toInt).let { (major, minor, patch) ->
    major * 10_000 + minor * 100 + patch
}

val releaseKey = releaseKey()
if (releaseKey == null) {
    logger.lifecycle("StikSound: no release keystore configured; assembleRelease will produce an unsigned APK.")
} else if (!releaseKey.storeFile.isFile) {
    throw GradleException("StikSound: release keystore not found at ${releaseKey.storeFile}")
}

android {
    namespace = "app.stiksound.android"
    compileSdk = 36

    defaultConfig {
        applicationId = "app.stiksound.android"
        // 29+: MediaStore Downloads without storage permissions, modern WebView with WebCodecs.
        minSdk = 29
        targetSdk = 36
        versionCode = appVersionCode
        versionName = appVersion
    }

    signingConfigs {
        if (releaseKey != null) {
            create("release") {
                storeFile = releaseKey.storeFile
                storePassword = releaseKey.storePassword
                keyAlias = releaseKey.keyAlias
                keyPassword = releaseKey.keyPassword
            }
        }
    }

    buildTypes {
        release {
            if (releaseKey != null) signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.ktx)
    implementation(libs.androidx.webkit)
    testImplementation(libs.junit)
}

// ---------------------------------------------------------------------------------------------
// Web bundle: the editor UI is the shared TypeScript app (packages/*) built by Vite from
// apps/android into src/main/assets/www. Building from Android Studio runs it automatically.
// Skip with -PskipWebBuild when the bundle was already built (for example in CI).
// ---------------------------------------------------------------------------------------------
val webAppDir = rootProject.projectDir.parentFile
val repoRoot = webAppDir.parentFile.parentFile
val webOutDir = layout.projectDirectory.dir("src/main/assets/www")

val buildWebBundle = tasks.register<Exec>("buildWebBundle") {
    group = "build"
    description = "Builds the StikSound web UI into src/main/assets/www with Vite."
    workingDir = webAppDir
    commandLine(if (System.getProperty("os.name").startsWith("Windows")) "npm.cmd" else "npm", "run", "build")
    inputs.files(
        fileTree(webAppDir.resolve("src")),
        webAppDir.resolve("index.html"),
        webAppDir.resolve("vite.config.ts"),
        fileTree(repoRoot.resolve("packages")) {
            include("*/src/**")
        }
    )
    outputs.dir(webOutDir)
    onlyIf { !project.hasProperty("skipWebBuild") }
}

val checkWebBundle = tasks.register("checkWebBundle") {
    val index = webOutDir.file("index.html").asFile
    doLast {
        if (!index.exists()) {
            throw GradleException(
                "Missing web bundle at $index. Run `npm install` at the repo root, then " +
                    "`npm run build -w @stiksound/android`."
            )
        }
    }
    dependsOn(buildWebBundle)
}

tasks.named("preBuild") { dependsOn(checkWebBundle) }
