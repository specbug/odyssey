// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "OdysseyMacApp",
    defaultLocalization: "en",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(
            name: "OdysseyMacApp",
            targets: ["OdysseyMacApp"]
        )
    ],
    dependencies: [
        // TODO: Pull shared TypeScript/OpenAPI generated client once available.
    ],
    targets: [
        .executableTarget(
            name: "OdysseyMacApp",
            resources: [
                .process("Resources")
            ],
            swiftSettings: [
                .enableUpcomingFeature("BareSlashRegexLiterals")
            ]
        ),
        .testTarget(
            name: "OdysseyMacAppTests",
            dependencies: ["OdysseyMacApp"]
        )
    ]
)
