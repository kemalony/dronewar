import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

plugins {
    id("java-library")
    id("org.jetbrains.kotlin.jvm")
}

// Pure JVM. No `com.android.*` plugin, no Android on the classpath -- an accidental
// `import android.*` in this module is a compile error, not a code-review finding.

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
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.1")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher:1.10.1")
}

val generatedConfigDir: Provider<Directory> = layout.buildDirectory.dir("generated/config/kotlin")

val generateConfig by tasks.registering(GenerateConfigTask::class) {
    group = "build"
    description = "Parses config/*.toml into one flat key space and emits Config.kt."
    tomlFiles.from(layout.projectDirectory.dir("config").asFileTree.matching { include("*.toml") })
    outputDir.set(generatedConfigDir)
}

kotlin.sourceSets.named("main") {
    kotlin.srcDir(generatedConfigDir)
}

tasks.named("compileKotlin") {
    dependsOn(generateConfig)
}

// The test measures the generated constants against the web dump. The dump is
// read-only input here; :rules never writes to android/harness/golden/.
val goldenConfig: File = rootProject.file("harness/golden/config.json")

tasks.named<Test>("test") {
    useJUnitPlatform()
    systemProperty("dronewar.golden.config", goldenConfig.absolutePath)

    // Declared as a task input so that changing the dump re-runs the tests. Without
    // this the task reports FROM-CACHE and the gate goes green against a golden file
    // it never read: exactly what happened when the web's ownership split shifted and
    // config_parity kept saying PASS. A gate that cannot see its own reference change
    // is decoration.
    inputs.file(goldenConfig).withPropertyName("goldenConfig")

    testLogging { showStandardStreams = true }
}

// ---------------------------------------------------------------------------
// generateConfig
// ---------------------------------------------------------------------------
//
// One constant, one place. Every dotted key in config/*.toml must be defined in
// exactly one file; a second definition stops the build and names both files.
// The web build shipped the bug this prevents: CONFIG.SUBDRONE was written by two
// packages and the second Object.assign silently erased the first one's `pool`.

/** A value parsed out of a TOML file, remembering where it came from. */
data class TomlValue(val value: Any, val file: String, val line: Int)

/** Tree node: either a leaf (`value != null`) or a table (`children`). Never both. */
class ConfigNode {
    var leaf: TomlValue? = null
    val children: LinkedHashMap<String, ConfigNode> = LinkedHashMap()
}

abstract class GenerateConfigTask : DefaultTask() {

    @get:InputFiles
    abstract val tomlFiles: ConfigurableFileCollection

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    @TaskAction
    fun generate() {
        val files = tomlFiles.files.sortedBy { it.name }
        if (files.isEmpty()) throw GradleException("no config/*.toml files found for :rules")

        // ---- 1. parse + merge into ONE flat dotted key space -------------------
        val flat = LinkedHashMap<String, TomlValue>()
        val owners = LinkedHashMap<String, String>()
        for (file in files) {
            val parsed = parseToml(file)
            owners[file.name] = parsed.ownerPackage
            for ((key, value) in parsed.config) {
                val previous = flat[key]
                if (previous != null) {
                    // AC-3: the ownership gate. No merging, no last-writer-wins.
                    throw GradleException(
                        "duplicate config key $key: ${previous.file} and ${value.file} " +
                            "(${previous.file}:${previous.line} and ${value.file}:${value.line}). " +
                            "A constant lives in exactly one TOML; delete one of the two definitions."
                    )
                }
                flat[key] = value
            }
        }
        logger.lifecycle(
            "generateConfig: ${flat.size} keys from ${files.size} files " +
                owners.entries.joinToString(prefix = "(", postfix = ")") { "${it.key}=${it.value}" }
        )

        // ---- 2. flat keys -> tree ---------------------------------------------
        val root = ConfigNode()
        for ((key, value) in flat) insert(root, key, value)

        // ---- 3. emit ----------------------------------------------------------
        val body = StringBuilder()
        val index = ArrayList<Pair<String, String>>()
        emitMembers(root, "    ", "Config", "", body, index)

        val out = StringBuilder()
        out.append("// GENERATED by :rules:generateConfig from android/rules/config/*.toml -- do not edit.\n")
        out.append("// Source of truth is the TOML; this file is not committed (build/ is gitignored).\n")
        out.append("// Numbers are Double everywhere: JS has one number type and it is float64, and\n")
        out.append("// rounding a constant to Float would put the parity gate permanently out of reach.\n")
        out.append("// Arrays of scalars become DoubleArray/Array<String>; arrays of objects become\n")
        out.append("// nested objects _0.._n with a `length`.\n")
        out.append("package dev.dronewar.rules\n\n")
        out.append("public object Config {\n").append(body).append("}\n\n")
        out.append(renderIndex(index))

        val dir = outputDir.get().asFile
        dir.deleteRecursively()
        val target = File(dir, "dev/dronewar/rules/Config.kt")
        target.parentFile.mkdirs()
        target.writeText(out.toString(), Charsets.UTF_8)
        logger.lifecycle("generateConfig: wrote ${index.size} constants to ${target.absolutePath}")
    }

    // -- TOML ---------------------------------------------------------------

    inner class ParsedToml(val ownerPackage: String, val config: LinkedHashMap<String, TomlValue>)

    /**
     * Parser for exactly the subset tools/android/bootstrap_rules_config.py emits:
     * `[owner]` / `[config]` tables, flat dotted bare keys, and string / boolean /
     * float / integer scalars. Duplicate detection is exact -- keys are compared as
     * whole dotted strings, never matched by pattern.
     */
    private fun parseToml(file: File): ParsedToml {
        val config = LinkedHashMap<String, TomlValue>()
        val owner = LinkedHashMap<String, TomlValue>()
        var table = ""

        file.readLines(Charsets.UTF_8).forEachIndexed { zeroBased, raw ->
            val lineNo = zeroBased + 1
            val line = stripComment(raw, file.name, lineNo).trim()
            if (line.isEmpty()) return@forEachIndexed

            if (line.startsWith("[")) {
                if (!line.endsWith("]")) err(file, lineNo, "malformed table header: $line")
                table = line.substring(1, line.length - 1).trim()
                if (table.isEmpty()) err(file, lineNo, "empty table header")
                return@forEachIndexed
            }

            val eq = indexOfAssign(line)
            if (eq < 0) err(file, lineNo, "expected `key = value`, got: $line")
            val key = line.substring(0, eq).trim()
            val rawValue = line.substring(eq + 1).trim()
            if (key.isEmpty()) err(file, lineNo, "empty key")
            for (segment in key.split(".")) {
                if (segment.isEmpty() || !segment.all { it.isLetterOrDigit() || it == '_' || it == '-' }) {
                    err(file, lineNo, "key segment '$segment' is not a bare key")
                }
            }
            val value = TomlValue(parseValue(rawValue, file, lineNo), file.name, lineNo)

            val target = when (table) {
                "owner" -> owner
                "config" -> config
                else -> err(file, lineNo, "unknown table [$table]; only [owner] and [config] are allowed")
            }
            if (target.put(key, value) != null) {
                val first = if (table == "owner") owner[key] else config[key]
                throw GradleException(
                    "duplicate config key ${qualify(table, key)}: ${file.name} and ${file.name} " +
                        "(defined twice in the same file, second at ${file.name}:$lineNo, first at line ${first?.line})"
                )
            }
        }

        // AC-4: every TOML declares who owns it. A headerless TOML breaks the build.
        val pkg = owner["package"]?.value as? String
            ?: throw GradleException(
                "${file.name} has no [owner] header: every config TOML must start with " +
                    "`[owner]` and `package = \"<name>\"` naming the package that owns its keys."
            )
        if (pkg.isBlank()) throw GradleException("${file.name}: [owner] package must not be empty")
        return ParsedToml(pkg, config)
    }

    private fun qualify(table: String, key: String) = if (table == "config") key else "$table.$key"

    private fun stripComment(raw: String, file: String, lineNo: Int): String {
        var inString = false
        var i = 0
        while (i < raw.length) {
            val c = raw[i]
            when {
                inString && c == '\\' -> i++
                c == '"' -> inString = !inString
                c == '#' && !inString -> return raw.substring(0, i)
            }
            i++
        }
        if (inString) throw GradleException("$file:$lineNo: unterminated string")
        return raw
    }

    private fun indexOfAssign(line: String): Int {
        var inString = false
        var i = 0
        while (i < line.length) {
            val c = line[i]
            when {
                inString && c == '\\' -> i++
                c == '"' -> inString = !inString
                c == '=' && !inString -> return i
            }
            i++
        }
        return -1
    }

    private fun parseValue(text: String, file: File, lineNo: Int): Any {
        if (text.isEmpty()) err(file, lineNo, "missing value")
        if (text.startsWith("\"")) {
            if (text.length < 2 || !text.endsWith("\"")) err(file, lineNo, "malformed string: $text")
            return unescape(text.substring(1, text.length - 1), file, lineNo)
        }
        if (text == "true") return true
        if (text == "false") return false
        if (Regex("^[+-]?[0-9_]+$").matches(text)) {
            return text.replace("_", "").toLongOrNull() ?: err(file, lineNo, "bad integer: $text")
        }
        val d = text.replace("_", "").toDoubleOrNull() ?: err(file, lineNo, "bad value: $text")
        if (d.isNaN() || d.isInfinite()) err(file, lineNo, "non-finite number: $text")
        return d
    }

    private fun unescape(text: String, file: File, lineNo: Int): String {
        if (!text.contains('\\')) return text
        val sb = StringBuilder(text.length)
        var i = 0
        while (i < text.length) {
            val c = text[i]
            if (c != '\\') { sb.append(c); i++; continue }
            i++
            if (i >= text.length) err(file, lineNo, "dangling escape")
            when (val e = text[i]) {
                '"' -> sb.append('"')
                '\\' -> sb.append('\\')
                'n' -> sb.append('\n')
                'r' -> sb.append('\r')
                't' -> sb.append('\t')
                'u' -> { sb.append(text.substring(i + 1, i + 5).toInt(16).toChar()); i += 4 }
                else -> err(file, lineNo, "unsupported escape \\$e")
            }
            i++
        }
        return sb.toString()
    }

    private fun err(file: File, lineNo: Int, message: String): Nothing =
        throw GradleException("${file.name}:$lineNo: $message")

    // -- tree ---------------------------------------------------------------

    private fun insert(root: ConfigNode, key: String, value: TomlValue) {
        val segments = key.split(".")
        var node = root
        for ((i, segment) in segments.withIndex()) {
            val last = i == segments.lastIndex
            val child = node.children.getOrPut(segment) { ConfigNode() }
            if (last) {
                if (child.children.isNotEmpty()) {
                    throw GradleException("config key $key is used as both a value and a table")
                }
                child.leaf = value
            } else {
                if (child.leaf != null) {
                    throw GradleException(
                        "config key ${segments.take(i + 1).joinToString(".")} is used as both " +
                            "a value (${child.leaf!!.file}:${child.leaf!!.line}) and a table (by $key)"
                    )
                }
                node = child
            }
        }
    }

    /** Elements 0..n-1 plus an integer `length` == n means this table is an array. */
    private fun arrayElements(node: ConfigNode): List<ConfigNode>? {
        val length = (node.children["length"]?.leaf?.value as? Long)?.toInt() ?: return null
        if (node.children.size != length + 1) return null
        val elements = ArrayList<ConfigNode>(length)
        for (i in 0 until length) elements.add(node.children[i.toString()] ?: return null)
        return elements
    }

    private fun allDoubleLeaves(nodes: List<ConfigNode>) =
        nodes.isNotEmpty() && nodes.all { it.leaf?.value is Double }

    private fun allStringLeaves(nodes: List<ConfigNode>) =
        nodes.isNotEmpty() && nodes.all { it.leaf?.value is String }

    // -- emission -----------------------------------------------------------

    private fun emitMembers(
        node: ConfigNode,
        indent: String,
        accessor: String,
        dotted: String,
        out: StringBuilder,
        index: MutableList<Pair<String, String>>,
    ) {
        for ((name, child) in node.children) {
            val id = kotlinName(name)
            val childDotted = if (dotted.isEmpty()) name else "$dotted.$name"
            val childAccessor = "$accessor.$id"
            val leaf = child.leaf
            if (leaf != null) {
                val v = leaf.value
                if (v is Long && name != "length") {
                    throw GradleException(
                        "$childDotted is an integer literal in ${leaf.file}:${leaf.line}; numbers in " +
                            ":rules are Double (write ${v}.0). Integers are only the `length` of an array."
                    )
                }
                out.append(indent).append("public const val ").append(id).append(": ")
                    .append(kotlinType(v)).append(" = ").append(literal(v, childDotted)).append("\n")
                index.add(childDotted to childAccessor)
                continue
            }

            val elements = arrayElements(child)
            when {
                elements != null && allDoubleLeaves(elements) -> {
                    val values = elements.map { literal(it.leaf!!.value, childDotted) }
                    out.append(indent).append("@JvmField public val ").append(id)
                        .append(": DoubleArray = doubleArrayOf(").append(values.joinToString(", ")).append(")\n")
                    elements.indices.forEach { index.add("$childDotted.$it" to "$childAccessor[$it]") }
                    index.add("$childDotted.length" to "$childAccessor.size")
                }
                elements != null && allStringLeaves(elements) -> {
                    val values = elements.map { literal(it.leaf!!.value, childDotted) }
                    out.append(indent).append("@JvmField public val ").append(id)
                        .append(": Array<String> = arrayOf(").append(values.joinToString(", ")).append(")\n")
                    elements.indices.forEach { index.add("$childDotted.$it" to "$childAccessor[$it]") }
                    index.add("$childDotted.length" to "$childAccessor.size")
                }
                elements != null && elements.all { row ->
                    arrayElements(row)?.let { allDoubleLeaves(it) } == true
                } -> {
                    val rows = elements.map { row ->
                        arrayElements(row)!!.joinToString(", ") { literal(it.leaf!!.value, childDotted) }
                    }
                    out.append(indent).append("@JvmField public val ").append(id)
                        .append(": Array<DoubleArray> = arrayOf(")
                        .append(rows.joinToString(", ") { "doubleArrayOf($it)" }).append(")\n")
                    elements.forEachIndexed { i, row ->
                        val cells = arrayElements(row)!!
                        cells.indices.forEach { j -> index.add("$childDotted.$i.$j" to "$childAccessor[$i][$j]") }
                        index.add("$childDotted.$i.length" to "$childAccessor[$i].size")
                    }
                    index.add("$childDotted.length" to "$childAccessor.size")
                }
                else -> {
                    // Plain table, or an array of objects: elements become _0.._n-1.
                    out.append(indent).append("public object ").append(id).append(" {\n")
                    emitMembers(child, "$indent    ", childAccessor, childDotted, out, index)
                    out.append(indent).append("}\n")
                }
            }
        }
    }

    /** `DRONES.0.id` -> `Config.DRONES._0.id`; digits are not Kotlin identifiers. */
    private fun kotlinName(segment: String) = if (segment.first().isDigit()) "_$segment" else segment

    private fun kotlinType(v: Any) = when (v) {
        is Double -> "Double"
        is String -> "String"
        is Boolean -> "Boolean"
        is Long -> "Int"
        else -> throw GradleException("unsupported value type ${v.javaClass.name}")
    }

    private fun literal(v: Any, key: String): String = when (v) {
        is Double -> {
            // Double.toString is the shortest decimal that parses back to the same
            // bits, but assert it rather than trust it -- a one-ulp drift here is
            // invisible in review and fatal to parity.
            val text = v.toString()
            if (text.toDouble().toRawBits() != v.toRawBits()) {
                throw GradleException("$key: double literal $text does not round-trip")
            }
            text
        }
        is String -> "\"" + v.replace("\\", "\\\\").replace("\"", "\\\"")
            .replace("$", "\\$").replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t") + "\""
        is Boolean -> v.toString()
        is Long -> v.toString()
        else -> throw GradleException("$key: unsupported value type ${v.javaClass.name}")
    }

    /**
     * A flat dotted-key -> value view of the constants above, for ConfigParityTest.
     * Every entry *references* the single definition in [Config]; it is a view, not
     * a second copy, so there is still exactly one place each constant is written.
     */
    private fun renderIndex(index: List<Pair<String, String>>): String {
        val sorted = index.sortedBy { it.first }
        val chunks = sorted.chunked(120)
        val sb = StringBuilder()
        sb.append("/** Flat `dotted key -> value` view of [Config]. Values are references, not copies. */\n")
        sb.append("public object ConfigIndex {\n")
        sb.append("    @JvmField public val ALL: Map<String, Any> =\n")
        sb.append("        LinkedHashMap<String, Any>(${index.size * 2}).also { m ->\n")
        chunks.indices.forEach { sb.append("            fill$it(m)\n") }
        sb.append("        }\n\n")
        chunks.forEachIndexed { i, chunk ->
            sb.append("    private fun fill$i(m: MutableMap<String, Any>) {\n")
            for ((key, accessor) in chunk) {
                sb.append("        m[\"").append(key).append("\"] = ").append(accessor).append("\n")
            }
            sb.append("    }\n")
        }
        sb.append("}\n")
        return sb.toString()
    }
}
