import AppKit
import SwiftUI

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    var model: Controller!
    var window: NSWindow!
    var statusItem: NSStatusItem!
    func applicationDidFinishLaunching(_ notification: Notification) {
        model = Controller()
        let args = CommandLine.arguments
        if let i = args.firstIndex(of: "--import-image"), args.count > i + 1 {
            model.loadImage(URL(fileURLWithPath: args[i+1]))
        }
        if let index = args.firstIndex(of: "--self-test"), args.count > index + 2 {
            Task {
                do {
                    try await runSelfTest(port: Int(args[index + 1])!, pid: Int32(args[index + 2])!)
                    print("SELF_TEST_PASSED")
                    exit(0)
                } catch { fputs("SELF_TEST_FAILED: \(error)\n", stderr); exit(1) }
            }
            return
        }
        let menu = NSMenu()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "关于 Codex 壁纸", action: #selector(about), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "退出并恢复外观", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let item = NSMenuItem(); item.submenu = appMenu; menu.addItem(item)
        let fileMenu = NSMenu(title: "文件")
        let closeItem = fileMenu.addItem(withTitle: "关闭窗口", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        closeItem.keyEquivalentModifierMask = [.command]
        let fileItem = NSMenuItem(title: "文件", action: nil, keyEquivalent: "")
        fileItem.submenu = fileMenu
        menu.addItem(fileItem)
        let windowMenu = NSMenu(title: "窗口")
        windowMenu.addItem(withTitle: "最小化", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        let reopenItem = windowMenu.addItem(withTitle: "打开壁纸设置", action: #selector(showWindow), keyEquivalent: "")
        reopenItem.target = self
        let windowItem = NSMenuItem(title: "窗口", action: nil, keyEquivalent: "")
        windowItem.submenu = windowMenu
        menu.addItem(windowItem)
        NSApp.windowsMenu = windowMenu
        NSApp.mainMenu = menu
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let url = Bundle.main.url(forResource: "MenuIcon", withExtension: "png"), let icon = NSImage(contentsOf: url) {
            icon.size = NSSize(width: 22, height: 22)
            icon.isTemplate = false
            statusItem.button?.image = icon
        }
        statusItem.button?.title = " wallpaper"
        statusItem.button?.font = NSFont.systemFont(ofSize: 10, weight: .medium)
        statusItem.button?.toolTip = "Codex Wallpaper · 壁纸设置"
        if let url = Bundle.main.url(forResource: "CodexWallpaperIcon", withExtension: "icns"), let icon = NSImage(contentsOf: url) {
            NSApp.applicationIconImage = icon
        }
        let tray = NSMenu()
        tray.addItem(withTitle: "打开壁纸设置", action: #selector(showWindow), keyEquivalent: "")
        tray.addItem(withTitle: "恢复原始外观", action: #selector(restore), keyEquivalent: "")
        tray.addItem(.separator())
        tray.addItem(withTitle: "退出并恢复外观", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "")
        for item in tray.items where item.action != #selector(NSApplication.terminate(_:)) { item.target = self }
        statusItem.menu = tray
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1020, height: 690), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "Codex 壁纸"
        window.isReleasedWhenClosed = false
        window.contentView = NSHostingView(rootView: WallpaperView(model: model))
        window.minSize = NSSize(width: 980, height: 688)
        window.center()
        showWindow()
        if args.contains("--ui-self-test") {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1) { [weak self] in
                guard let self else { exit(2) }
                guard self.window.isVisible,
                      let event = NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: [.command], timestamp: 0, windowNumber: self.window.windowNumber, context: nil, characters: "w", charactersIgnoringModifiers: "w", isARepeat: false, keyCode: 13),
                      NSApp.mainMenu?.performKeyEquivalent(with: event) == true,
                      !self.window.isVisible,
                      self.statusItem.menu != nil,
                      self.applicationShouldTerminateAfterLastWindowClosed(NSApp) == false else {
                    fputs("UI_SELF_TEST_FAILED: Command-W or background lifecycle\n", stderr); exit(2)
                }
                _ = self.applicationShouldHandleReopen(NSApp, hasVisibleWindows: false)
                guard self.window.isVisible else { fputs("UI_SELF_TEST_FAILED: reopen\n", stderr); exit(2) }
                guard let url = Bundle.main.url(forResource: "CodexWallpaperIcon", withExtension: "icns"), NSImage(contentsOf: url) != nil else { exit(2) }
                print("COMMAND_W_CLOSE_OK")
                print("MENU_BAR_STAYS_RUNNING_OK")
                print("DOCK_REOPEN_OK")
                print("BUNDLE_ICON_RESOURCE_OK")
                print("UI_SELF_TEST_PASSED")
                exit(0)
            }
        }
        if let i = args.firstIndex(of: "--preview-output"), args.count > i + 1 {
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) { [weak self] in
                guard let view = self?.window.contentView, let bitmap = view.bitmapImageRepForCachingDisplay(in: view.bounds) else { exit(2) }
                view.cacheDisplay(in: view.bounds, to: bitmap)
                try? bitmap.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: args[i+1]))
                exit(0)
            }
        }
    }
    @objc func showWindow() { window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true) }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !flag { showWindow() }
        return true
    }
    @objc func restore() { model.restore() }
    @objc func about() {
        let alert = NSAlert(); alert.messageText = "Codex 壁纸 \(BuildInfo.version)"
        alert.informativeText = "支持 Intel 与 Apple Silicon 的本地壁纸工具。\n支持图片、模糊、底色与一键恢复。\n参考 ReTheme 的本机 CDP 运行时思路，独立编写。"
        alert.runModal()
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        guard model != nil else { return .terminateNow }
        if model.busy { model.status = "正在处理连接，请稍后再退出。"; return .terminateCancel }
        Task { await model.restoreNow(); NSApp.reply(toApplicationShouldTerminate: true) }
        return .terminateLater
    }
}

@MainActor
func runSelfTest(port: Int, pid: Int32) async throws {
    let installation = try Installation.detect()
    try verifyListener(port: port, pid: pid, executable: installation.executable)
    let connection = try CDP(port: port)
    guard let target = try await connection.targets().first(where: { $0.url == "app://-/index.html" }) else { throw WallpaperError("测试窗口未找到") }
    let runtime = try String(contentsOf: Bundle.main.url(forResource: "Wallpaper", withExtension: "js")!, encoding: .utf8)
    let probe = "JSON.stringify({style:document.getElementById('codex-wallpaper-local-style')!==null,layer:document.getElementById('codex-wallpaper-local-image')!==null,bg:getComputedStyle(document.body).backgroundColor,main:getComputedStyle(document.querySelector('[data-app-shell-main-surface]')).backgroundColor})"
    for _ in 0..<80 {
        if try await connection.evaluate("Boolean(document.querySelector('[data-app-shell-main-surface]'))", target: target) as? Bool == true { break }
        try await Task.sleep(nanoseconds: 250_000_000)
    }
    try await Task.sleep(nanoseconds: 1_000_000_000)
    let before = try await connection.evaluate(probe, target: target) as? String
    let image = NSImage(size: NSSize(width: 1200, height: 800))
    image.lockFocus()
    let gradient = NSGradient(starting: NSColor(red: 0.05, green: 0.35, blue: 0.7, alpha: 1), ending: NSColor(red: 0.95, green: 0.45, blue: 0.18, alpha: 1))!
    gradient.draw(in: NSRect(x: 0, y: 0, width: 1200, height: 800), angle: 35)
    image.unlockFocus()
    let data = NSBitmapImageRep(data: image.tiffRepresentation!)!.representation(using: .jpeg, properties: [:])!
    for palette in Palette.presets {
        let config = ThemeConfig(revision: UUID().uuidString, palette: palette, strength: 0.65, blur: 7, position: 50, image: "data:image/jpeg;base64," + data.base64EncodedString())
        let json = String(decoding: try JSONEncoder().encode(config), as: UTF8.self)
        guard let result = try await connection.evaluate("(\(runtime))(\(json))", target: target) as? [String: Any], result["applied"] as? Bool == true else { throw WallpaperError("应用失败") }
        let details = try await connection.evaluate(probe, target: target) as? String ?? ""
        guard details.contains("\"style\":true"), details.contains("\"layer\":true"), details != before else { throw WallpaperError("未检测到主题样式") }
        // Idempotency: repeated application should reuse a single style and layer.
        _ = try await connection.evaluate("(\(runtime))(\(json))", target: target)
        let duplicateCount = try await connection.evaluate("document.querySelectorAll('#codex-wallpaper-local-style,#codex-wallpaper-local-image').length", target: target) as? Int
        guard duplicateCount == 2 else { throw WallpaperError("重复样式检测失败") }
        print("APPLY_OK \(palette.id)")
    }
    let old = try JSONDecoder().decode(Settings.self, from: Data(#"{"paletteID":"forest","blur":9,"position":0,"hasWallpaper":true}"#.utf8))
    guard old.horizontalOffset == 0, old.zoom == 1, old.paletteID == "forest", old.position == 0, old.hasWallpaper else { throw WallpaperError("旧设置迁移失败") }
    print("SETTINGS_MIGRATION_OK")
    var widths: [Double] = []
    for zoom in [0.5, 2.0] {
        let config = ThemeConfig(revision: UUID().uuidString, palette: Palette.presets[0], strength: 0.5, blur: 0, position: 0, zoom: zoom, image: "data:image/jpeg;base64," + data.base64EncodedString())
        let json = String(decoding: try JSONEncoder().encode(config), as: UTF8.self)
        _ = try await connection.evaluate("(\(runtime))(\(json))", target: target)
        try await Task.sleep(nanoseconds: 300_000_000)
        guard let width = try await connection.evaluate("parseFloat(document.getElementById('codex-wallpaper-local-image').style.backgroundSize)", target: target) as? Double, width > 0 else { throw WallpaperError("缩放尺寸缺失") }
        widths.append(width)
        guard try await connection.evaluate("getComputedStyle(document.getElementById('codex-wallpaper-local-image')).backgroundPositionY", target: target) as? String == "0%" else { throw WallpaperError("顶部位置失效") }
    }
    guard abs(widths[1] / widths[0] - 4) < 0.01 else { throw WallpaperError("缩放比例错误") }
    print("ZOOM_50_200_PERCENT_OK")
    for offset in [-25.0, 25.0] {
        let config = ThemeConfig(revision: UUID().uuidString, palette: Palette.presets[0], strength: 0.5, blur: 0, position: 0, horizontalOffset: offset, zoom: 1, image: "data:image/jpeg;base64," + data.base64EncodedString())
        let json = String(decoding: try JSONEncoder().encode(config), as: UTF8.self)
        _ = try await connection.evaluate("(\(runtime))(\(json))", target: target)
        let check = "(()=>{let x=getComputedStyle(document.getElementById('codex-wallpaper-local-image')).backgroundPositionX;let m=x.match(/(-?[0-9.]+)px/);return m?Math.abs((x.includes(' - ')?-1:1)*Number(m[1])-innerWidth*\(offset)/100)<0.1:false})()"
        print("OFFSET_GEOMETRY", try await connection.evaluate("JSON.stringify({x:getComputedStyle(document.getElementById('codex-wallpaper-local-image')).backgroundPositionX,w:innerWidth})", target: target) ?? "missing")
        guard try await connection.evaluate(check, target: target) as? Bool == true else { throw WallpaperError("左右偏移方向或距离错误") }
    }
    var saved = old
    saved.horizontalOffset = -37
    let decoded = try JSONDecoder().decode(Settings.self, from: JSONEncoder().encode(saved))
    guard decoded.horizontalOffset == -37 else { throw WallpaperError("左右偏移保存失败") }
    print("HORIZONTAL_OFFSET_AND_PERSISTENCE_OK")
    // Expiry must restore even if the native controller crashes.
    _ = try await connection.evaluate("window.__codexWallpaperLocalV1.touched=0", target: target)
    for _ in 0..<24 {
        if try await connection.evaluate(probe, target: target) as? String == before { break }
        try await Task.sleep(nanoseconds: 250_000_000)
    }
    guard try await connection.evaluate(probe, target: target) as? String == before else { throw WallpaperError("超时恢复失败") }
    print("WATCHDOG_RESTORE_OK")
    let config = ThemeConfig(revision: "restore-test", palette: Palette.presets[0], strength: 0.5, blur: 0, position: 50, image: nil)
    let json = String(decoding: try JSONEncoder().encode(config), as: UTF8.self)
    _ = try await connection.evaluate("(\(runtime))(\(json))", target: target)
    _ = try await connection.evaluate("window.__codexWallpaperLocalV1.restore()", target: target)
    guard try await connection.evaluate(probe, target: target) as? String == before else { throw WallpaperError("显式恢复失败") }
    print("EXPLICIT_RESTORE_OK")
}

let app = NSApplication.shared
app.setActivationPolicy(.regular)
let delegate = MainActor.assumeIsolated { AppDelegate() }
app.delegate = delegate
app.run()
