import AppKit
import SwiftUI
import ImageIO

struct Palette: Codable, Identifiable {
    let id: String
    let name: String
    let base: String
    let panel: String
    let text: String
    let muted: String
    let accent: String
    let border: String
    static let presets: [Palette] = [
        .init(id: "ink", name: "墨夜", base: "#171C25", panel: "#242B37", text: "#EEF1F7", muted: "#A7B1C2", accent: "#A6BFFF", border: "#394353"),
        .init(id: "forest", name: "松林", base: "#17221F", panel: "#24342D", text: "#EAF1EB", muted: "#A9BCAF", accent: "#A9D8B4", border: "#3B5044"),
        .init(id: "paper", name: "奶油", base: "#F5F1E8", panel: "#FFFCF5", text: "#302E29", muted: "#706A60", accent: "#866237", border: "#D9D0C1"),
        .init(id: "rose", name: "暮紫", base: "#251D2B", panel: "#352A3D", text: "#F5EDF7", muted: "#BEAAC8", accent: "#D8B4EE", border: "#513E5C"),
        .init(id: "ocean", name: "深海", base: "#111E32", panel: "#1C2D46", text: "#EDF4FF", muted: "#A5B9D2", accent: "#8CCAFF", border: "#344B67"),
        .init(id: "graphite", name: "石墨", base: "#202124", panel: "#2D2F33", text: "#F0F0F2", muted: "#B5B8BE", accent: "#C3C9D9", border: "#484B52"),
        .init(id: "obsidian", name: "曜黑", base: "#0D0F12", panel: "#1A1D23", text: "#F3F5FA", muted: "#AFB5C0", accent: "#B6CAFF", border: "#343A45"),
        .init(id: "cocoa", name: "可可", base: "#291F1B", panel: "#3B2D26", text: "#F8EFE6", muted: "#C6B3A4", accent: "#EFC49B", border: "#5D483C"),
        .init(id: "sakura", name: "樱粉", base: "#F7EDF0", panel: "#FFF8FA", text: "#412D35", muted: "#80616E", accent: "#A54368", border: "#DDC5CE"),
        .init(id: "mist", name: "雾蓝", base: "#EAF1F7", panel: "#F7FBFF", text: "#263A4B", muted: "#52697D", accent: "#306A99", border: "#C2D2E0"),
        .init(id: "sage", name: "鼠尾草", base: "#EDF2E9", panel: "#F8FBF4", text: "#303D2D", muted: "#596A51", accent: "#477440", border: "#C9D5C1"),
        .init(id: "lavender", name: "浅薰衣", base: "#F0ECF8", panel: "#FAF7FF", text: "#373044", muted: "#726483", accent: "#7650A3", border: "#D1C5E1")
    ]
}

extension Color {
    init(hex: String) {
        let n = UInt64(hex.dropFirst(), radix: 16) ?? 0
        self.init(.sRGB, red: Double((n >> 16) & 255)/255, green: Double((n >> 8) & 255)/255, blue: Double(n & 255)/255, opacity: 1)
    }
}

struct Settings: Codable {
    var paletteID = "ink"
    var strength = 0.42
    var blur = 2.0
    var position = 15.0
    var horizontalOffset = 0.0
    var zoom = 1.0
    var hasWallpaper = false
    init() {}
    enum CodingKeys: String, CodingKey { case paletteID, strength, blur, position, horizontalOffset, zoom, hasWallpaper }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        paletteID = try c.decodeIfPresent(String.self, forKey: .paletteID) ?? "ink"
        strength = try c.decodeIfPresent(Double.self, forKey: .strength) ?? 0.42
        blur = try c.decodeIfPresent(Double.self, forKey: .blur) ?? 2
        position = try c.decodeIfPresent(Double.self, forKey: .position) ?? 15
        horizontalOffset = min(100, max(-100, try c.decodeIfPresent(Double.self, forKey: .horizontalOffset) ?? 0))
        zoom = min(3, max(0.25, try c.decodeIfPresent(Double.self, forKey: .zoom) ?? 1))
        hasWallpaper = try c.decodeIfPresent(Bool.self, forKey: .hasWallpaper) ?? false
    }
}

struct ThemeConfig: Encodable {
    let revision: String
    let palette: Palette
    let strength: Double
    let blur: Double
    let position: Double
    var horizontalOffset: Double = 0.0
    var zoom: Double = 1.0
    let image: String?
}

struct WallpaperError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
    init(_ message: String) { self.message = message }
}

func imageJPEG(from url: URL) throws -> Data {
    let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
    guard size > 0, size <= 50_000_000 else { throw WallpaperError("请选择小于 50 MB 的图片。") }
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil), CGImageSourceGetCount(source) > 0,
          let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceThumbnailMaxPixelSize: 2560,
            kCGImageSourceCreateThumbnailWithTransform: true
          ] as CFDictionary) else { throw WallpaperError("无法读取图片，请选择 JPEG、PNG、HEIC 或 WebP。") }
    let rep = NSBitmapImageRep(cgImage: image)
    guard let data = rep.representation(using: .jpeg, properties: [.compressionFactor: 0.88]) else {
        throw WallpaperError("图片转换失败。")
    }
    return data
}

// Runtime labels follow the architecture of the running universal slice.
enum BuildInfo {
    static var platformDescription: String {
        #if arch(arm64)
        let chip = "Apple Silicon"
        #else
        let chip = "Intel Mac"
        #endif
        let os = ProcessInfo.processInfo.operatingSystemVersion
        return "\(chip) · macOS \(os.majorVersion).\(os.minorVersion)"
    }
    static var version: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "development"
    }
}
