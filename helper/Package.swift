// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "BreakFlowHelper",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(name: "BreakFlowHelper", path: "Sources/BreakFlowHelper")
    ]
)
