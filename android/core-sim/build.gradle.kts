import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

plugins {
    id("java-library")
    id("org.jetbrains.kotlin.jvm")
}

// Pure JVM, exactly like :rules. No `com.android.*` plugin and no Android on the
// classpath -- an accidental `import android.*` here is a compile error, not a
// code-review finding. The only dependency is :rules; constants have one home.

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

tasks.withType<KotlinCompile>().configureEach {
    kotlinOptions.jvmTarget = "17"
}

tasks.withType<JavaCompile>().configureEach {
    options.encoding = "UTF-8"
}

dependencies {
    // `api`: :harness sees Config through :core-sim, so the two agree on constants.
    api(project(":rules"))
}
