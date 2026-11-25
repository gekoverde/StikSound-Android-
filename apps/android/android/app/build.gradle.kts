plugins {
    alias(libs.plugins.android.application)
}

android {
    namespace = "app.stiksound.android"
    compileSdk = 36

    defaultConfig {
        applicationId = "app.stiksound.android"
        // 29+: MediaStore Downloads without storage permissions, modern WebView with WebCodecs.
        minSdk = 29
        targetSdk = 36
        versionCode = 10101
        versionName = "1.1.1"
    }

    buildTypes {
        release {
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
