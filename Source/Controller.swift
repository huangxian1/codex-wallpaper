import AppKit
import SwiftUI
import UniformTypeIdentifiers

@MainActor
final class Controller: ObservableObject {
    @Published var settings: Settings
    @Published var image: NSImage?
    @Published var status = "选择一张图片，布置你的工作空间。"
    @Published var active = false
    @Published var busy = false
    @Published var dirty = false
    @Published var failure = false
    let installation: Installation?
    let support: URL
    private var imageData: Data?
    private var connection: CDP?
    private var pid: Int32?
    private var child: Process?
    private var timer: Timer?
    private var refreshing = false
    private var config: ThemeConfig?
    private var expression: String?
    private var failures = 0
    private let runtime: String
    var palette: Palette { Palette.presets.first(where: { $0.id == settings.paletteID }) ?? Palette.presets[0] }
    var hasWallpaper: Bool { imageData != nil }
    var wallpaperURL: URL { support.appendingPathComponent("wallpaper.jpg") }

    init() {
        support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("CodexWallpaperLocal", isDirectory: true)
        installation = try? Installation.detect()
        runtime = Bundle.main.url(forResource: "Wallpaper", withExtension: "js").flatMap { try? String(contentsOf: $0, encoding: .utf8) } ?? ""
        let publicPreview = CommandLine.arguments.contains("--public-preview")
        settings = publicPreview ? Settings() : (try? JSONDecoder().decode(Settings.self, from: Data(contentsOf: support.appendingPathComponent("settings.json")))) ?? Settings()
        if settings.hasWallpaper, let data = try? Data(contentsOf: support.appendingPathComponent("wallpaper.jpg")), let loaded = NSImage(data: data) {
            imageData = data; image = loaded
        } else { settings.hasWallpaper = false }
        if installation == nil { status = "未找到 Codex 客户端。"; failure = true }
    }

    func edited() { dirty = true; persist() }
    private func persist() {
        do {
            try FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
            try JSONEncoder().encode(settings).write(to: support.appendingPathComponent("settings.json"), options: .atomic)
        } catch { show(error) }
    }
    func chooseImage() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.jpeg, .png, .heic, .webP, .tiff]
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        panel.prompt = "设为壁纸"
        if panel.runModal() == .OK, let url = panel.url { loadImage(url) }
    }
    func loadImage(_ url: URL) {
        do {
            let data = try imageJPEG(from: url)
            try FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
            try data.write(to: wallpaperURL, options: .atomic)
            imageData = data; image = NSImage(data: data); settings.hasWallpaper = true
            edited(); failure = false
            status = active ? "壁纸已更新，点击“应用更改”生效。" : "壁纸已准备好，点击“连接并应用”。"
        } catch { show(error) }
    }
    func clearImage() {
        do {
            if FileManager.default.fileExists(atPath: wallpaperURL.path) { try FileManager.default.removeItem(at: wallpaperURL) }
            imageData = nil; image = nil; settings.hasWallpaper = false; edited()
        } catch { show(error) }
    }
    func apply() {
        guard !busy else { return }
        Task {
            busy = true; failure = false
            defer { busy = false }
            do {
                while refreshing { try await Task.sleep(nanoseconds: 50_000_000) }
                guard let installation else { throw WallpaperError("没有找到 Codex 客户端。") }
                guard !runtime.isEmpty else { throw WallpaperError("应用缺少主题脚本，请重新运行 build.sh。") }
                try await ensureConnection(installation)
                let config = ThemeConfig(revision: UUID().uuidString, palette: palette, strength: settings.strength, blur: settings.blur, position: settings.position, horizontalOffset: settings.horizontalOffset, zoom: settings.zoom, image: imageData.map { "data:image/jpeg;base64," + $0.base64EncodedString() })
                let json = String(decoding: try JSONEncoder().encode(config), as: UTF8.self)
                self.config = config
                expression = "(\(runtime))(\(json))"
                let count = try await refresh(force: true)
                guard count > 0 else { throw WallpaperError("没有识别到 Codex 主窗口。请打开主窗口，再点击应用。") }
                active = true; dirty = false; failures = 0; persist()
                status = "壁纸已应用 · 已连接 \(count) 个窗口"
                timer?.invalidate()
                timer = Timer.scheduledTimer(withTimeInterval: 3, repeats: true) { [weak self] _ in
                    Task { @MainActor in await self?.heartbeat() }
                }
            } catch is CancellationError { status = "已取消。当前 Codex 保持运行。" }
            catch { show(error) }
        }
    }
    private func ensureConnection(_ installation: Installation) async throws {
        if let connection, let pid {
            if (try? verifyListener(port: connection.port, pid: pid, executable: installation.executable)) != nil { return }
            self.connection = nil
        }
        let savedPort = UserDefaults.standard.integer(forKey: "managedPort")
        let savedPID = Int32(UserDefaults.standard.integer(forKey: "managedPID"))
        if savedPort > 0, savedPID > 0, (try? verifyListener(port: savedPort, pid: savedPID, executable: installation.executable)) != nil {
            connection = try CDP(port: savedPort); pid = savedPID; return
        }
        let running = NSRunningApplication.runningApplications(withBundleIdentifier: "com.openai.codex").filter { !$0.isTerminated }
        if !running.isEmpty {
            let alert = NSAlert()
            alert.messageText = "需要重启 Codex 才能应用壁纸"
            alert.informativeText = "首次使用需要以本机主题通道启动 Codex。重启可能中断正在运行的任务，请等任务结束后再继续。聊天和登录仍使用原来的客户端数据。"
            alert.addButton(withTitle: "重启并应用")
            alert.addButton(withTitle: "稍后再说")
            alert.alertStyle = .warning
            guard alert.runModal() == .alertFirstButtonReturn else { throw CancellationError() }
            // Ask the app to quit normally. Never force-kill the user's client.
            for app in running { _ = app.terminate() }
            for _ in 0..<100 {
                if running.allSatisfy(\.isTerminated) { break }
                try await Task.sleep(nanoseconds: 150_000_000)
            }
            guard running.allSatisfy(\.isTerminated) else { throw WallpaperError("Codex 还没有退出。请手动退出后，再点击连接。") }
        }
        status = "正在启动 Codex…"
        let port = try unusedLocalPort()
        let process = Process()
        process.executableURL = installation.executable
        process.arguments = ["--remote-debugging-address=127.0.0.1", "--remote-debugging-port=\(port)"]
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        process.standardInput = FileHandle.nullDevice
        try process.run()
        child = process
        let cdp = try CDP(port: port)
        for _ in 0..<80 {
            guard process.isRunning else { throw WallpaperError("Codex 未能以主题模式启动，请正常打开客户端后重试。") }
            if (try? verifyListener(port: port, pid: process.processIdentifier, executable: installation.executable)) != nil,
               let targets = try? await cdp.targets(), !targets.isEmpty {
                connection = cdp; pid = process.processIdentifier
                UserDefaults.standard.set(port, forKey: "managedPort")
                UserDefaults.standard.set(Int(process.processIdentifier), forKey: "managedPID")
                // UI framework may still be mounting after its page target is created.
                try await Task.sleep(nanoseconds: 1_500_000_000)
                return
            }
            try await Task.sleep(nanoseconds: 250_000_000)
        }
        throw WallpaperError("等待主题通道超时。你仍可正常使用 Codex；请稍后重试。")
    }
    private func refresh(force: Bool) async throws -> Int {
        guard let connection, let expression, let config else { return 0 }
        let targets = try await connection.targets()
        var count = 0
        for target in targets {
            if !force {
                let heartbeat = "(()=>{let r=window.__codexWallpaperLocalV1;if(r&&r.revision===\(String(decoding: try JSONEncoder().encode(config.revision), as: UTF8.self))){r.touched=Date.now();return true}return false})()"
                if (try? await connection.evaluate(heartbeat, target: target)) as? Bool == true { count += 1; continue }
            }
            if let result = try await connection.evaluate(expression, target: target) as? [String: Any], result["applied"] as? Bool == true { count += 1 }
        }
        return count
    }
    private func heartbeat() async {
        guard active, !busy, !refreshing else { return }
        refreshing = true
        defer { refreshing = false }
        do {
            guard let installation, let connection, let pid else { throw WallpaperError("连接已断开。") }
            try verifyListener(port: connection.port, pid: pid, executable: installation.executable)
            let count = try await refresh(force: false)
            guard count > 0 else { throw WallpaperError("未找到主窗口。") }
            if failures > 0 { status = "壁纸已重新连接。"; failure = false }
            failures = 0
        } catch {
            failures += 1
            if failures >= 3 {
                timer?.invalidate(); active = false; connection = nil
                status = "连接已断开，主题会自动恢复；重新打开主窗口后可再次应用。"; failure = true
            }
        }
    }
    func restore() {
        guard !busy else { return }
        Task { busy = true; await restoreNow(); busy = false }
    }
    func restoreNow() async {
        timer?.invalidate(); timer = nil; active = false
        while refreshing { try? await Task.sleep(nanoseconds: 50_000_000) }
        var succeeded = true
        if let connection, let targets = try? await connection.targets() {
            for target in targets {
                do { _ = try await connection.evaluate("(()=>{window.__codexWallpaperLocalV1?.restore();return true})()", target: target) }
                catch { succeeded = false }
            }
        } else if connection != nil { succeeded = false }
        config = nil; expression = nil; failure = false
        status = succeeded ? "已恢复原始外观，壁纸设置已保留。" : "连接已断开；主题将在约 15 秒后自动恢复。"
    }
    func show(_ error: Error) { status = error.localizedDescription; failure = true }
}
