// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "BreakFlow",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(name: "BreakFlow", path: "Sources/BreakFlow")
    ]
)
