// Renders SF Symbols into the menu bar (tray) icons in resources/.
// Run from the repo root: swift scripts/make-tray-icons.swift
//
// Files ending in "Template" are black-on-transparent; macOS recolors them to match a light or
// dark menu bar automatically.
import AppKit

let icons: [(name: String, symbol: String)] = [
    ("trayIdleTemplate", "waveform"),
    ("trayRecordingTemplate", "mic.fill"),
    ("trayTranscribingTemplate", "ellipsis.circle"),
]
let pointSize: CGFloat = 16
let canvas: CGFloat = 18

for (name, symbol) in icons {
    for scale in [1, 2] {
        let pixels = Int(canvas) * scale
        guard let base = NSImage(systemSymbolName: symbol, accessibilityDescription: nil),
              let image = base.withSymbolConfiguration(.init(pointSize: pointSize * CGFloat(scale), weight: .regular)),
              let rep = NSBitmapImageRep(
                  bitmapDataPlanes: nil, pixelsWide: pixels, pixelsHigh: pixels,
                  bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                  colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
              )
        else { fatalError("Couldn't render \(symbol)") }

        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
        let size = image.size
        let origin = NSPoint(x: (CGFloat(pixels) - size.width) / 2, y: (CGFloat(pixels) - size.height) / 2)
        image.draw(in: NSRect(origin: origin, size: size))
        // Symbols draw in the default label color; force solid black for a template image.
        NSColor.black.set()
        NSRect(x: 0, y: 0, width: pixels, height: pixels).fill(using: .sourceAtop)
        NSGraphicsContext.restoreGraphicsState()

        let suffix = scale == 2 ? "@2x" : ""
        let url = URL(fileURLWithPath: "resources/\(name)\(suffix).png")
        try! rep.representation(using: .png, properties: [:])!.write(to: url)
        print("wrote \(url.path)")
    }
}
