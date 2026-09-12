import org.gradle.api.tasks.testing.logging.TestExceptionFormat
import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

plugins {
    id("java-library")
    id("org.jetbrains.kotlin.jvm")
}

// Pure JVM, exactly like :rules. The measurement runs on a plain JVM so a red gate
// can never be blamed on an emulator, a device, or a graphics driver.

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
    implementation(project(":core-sim"))
    implementation(project(":rules"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.1")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher:1.10.1")
}

// The golden trace is read-only input to this module. :harness measures against it
// and never writes to android/harness/golden/ -- bending the ruler to fit the port
// is the one move that would make every other number in this project meaningless.
val goldenTrace: File = rootProject.file("harness/golden/trace_player.ndjson.gz")

// `-Pdronewar.trace=<path>` points the suite at a *copy* of the trace, which is how
// the comparator gets falsified (corrupt a copy by one ulp, watch parity go red)
// without anyone ever editing android/harness/golden/. The gate passes no such
// property, so the gate always measures against the real thing; and the suite prints
// the path it actually read, so a run against a doctored copy says so in its own log.
val traceOverride: String? = providers.gradleProperty("dronewar.trace").orNull
val tracePath: String = traceOverride ?: goldenTrace.absolutePath

tasks.named<Test>("test") {
    useJUnitPlatform()
    systemProperty("dronewar.golden.trace", tracePath)

    // Declared as a task input so that changing the trace re-runs the tests. The gate
    // corrupts one step by a single ulp and demands a red run; an UP-TO-DATE skip
    // there would report green and prove nothing.
    inputs.file(tracePath).withPropertyName("goldenTrace")

    // AllocationTest reads this thread's allocation counter. One fork, one thread.
    maxParallelForks = 1

    testLogging {
        showStandardStreams = true
        exceptionFormat = TestExceptionFormat.FULL
        events("failed")
    }
}
