pluginManagement {
    repositories { google(); mavenCentral(); gradlePluginPortal() }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories { google(); mavenCentral() }
}
rootProject.name = "dronewar-bench"
include(":bench-core", ":bench-canvas", ":bench-gl")
include(":rules")
include(":core-sim")
include(":harness")
include(":game")
