// Draws the app icon and writes build-resources/icon.icns.
// Run from the repo root: swift scripts/make-app-icon.swift
//
// Black rounded square with a white "waveform" SF Symbol, laid out on Apple's macOS icon grid
// (an 824-pt tile centered in a 1024-pt canvas, leaving room for the system shadow).
import AppKit

func render(pixels: Int) -> Data {
    let canvas = CGFloat(pixels)
    let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil, pixelsWide: pixels, pixelsHigh: pixels,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
    )!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)

    let scale = canvas / 1024
    let tile = NSRect(x: 100 * scale, y: 100 * scale, width: 824 * scale, height: 824 * scale)
    let shape = NSBezierPath(roundedRect: tile, xRadius: 185 * scale, yRadius: 185 * scale)

    // Soft drop shadow under the tile.
    let shadow = NSShadow()
    shadow.shadowColor = NSColor.black.withAlphaComponent(0.35)
    shadow.shadowBlurRadius = 24 * scale
    shadow.shadowOffset = NSSize(width: 0, height: -10 * scale)
    NSGraphicsContext.saveGraphicsState()
    shadow.set()
    NSColor.black.setFill()
    shape.fill()
    NSGraphicsContext.restoreGraphicsState()

    // Subtle top-to-bottom gradient so it doesn't read as a flat hole in the Dock.
    NSGradient(starting: NSColor(white: 0.20, alpha: 1), ending: NSColor(white: 0.04, alpha: 1))!
        .draw(in: shape, angle: -90)

    // White waveform, centered.
    let config = NSImage.SymbolConfiguration(pointSize: 430 * scale, weight: .semibold)
    let symbol = NSImage(systemSymbolName: "waveform", accessibilityDescription: nil)!
        .withSymbolConfiguration(config)!
    let size = symbol.size
    let glyphRect = NSRect(
        x: tile.midX - size.width / 2, y: tile.midY - size.height / 2,
        width: size.width, height: size.height
    )
    let tinted = NSImage(size: size, flipped: false) { rect in
        symbol.draw(in: rect)
        NSColor.white.set()
        rect.fill(using: .sourceAtop)
        return true
    }
    tinted.draw(in: glyphRect)

    NSGraphicsContext.restoreGraphicsState()
    return rep.representation(using: .png, properties: [:])!
}

let fileManager = FileManager.default
let iconset = URL(fileURLWithPath: "build-resources/icon.iconset")
try? fileManager.removeItem(at: iconset)
try! fileManager.createDirectory(at: iconset, withIntermediateDirectories: true)

// The sizes iconutil expects: 16…512 pt at 1x and 2x.
for points in [16, 32, 128, 256, 512] {
    for scale in [1, 2] {
        let suffix = scale == 2 ? "@2x" : ""
        try! render(pixels: points * scale).write(to: iconset.appendingPathComponent("icon_\(points)x\(points)\(suffix).png"))
    }
}
try! render(pixels: 1024).write(to: URL(fileURLWithPath: "build-resources/icon.png"))

let iconutil = Process()
iconutil.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
iconutil.arguments = ["-c", "icns", iconset.path, "-o", "build-resources/icon.icns"]
try! iconutil.run()
iconutil.waitUntilExit()
try? fileManager.removeItem(at: iconset)
print(iconutil.terminationStatus == 0 ? "wrote build-resources/icon.icns" : "iconutil failed")
