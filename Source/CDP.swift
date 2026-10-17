import AppKit
import Foundation
import Darwin

struct Installation {
    let url: URL
    let executable: URL
    let version: String
    static func detect() throws -> Installation {
        for path in ["/Applications/ChatGPT.app", "/Applications/Codex.app"] {
            let url = URL(fileURLWithPath: path)
            if let bundle = Bundle(url: url), bundle.bundleIdentifier == "com.openai.codex", let exe = bundle.executableURL {
                return Installation(url: url, executable: exe, version: bundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "未知")
            }
        }
        throw WallpaperError("没有在应用程序目录找到 com.openai.codex 客户端。")
    }
}

struct PageTarget: Decodable {
    let id: String
    let type: String
    let url: String
    let webSocketDebuggerUrl: String?
    var isCodex: Bool {
        guard type == "page", let u = URLComponents(string: url), u.scheme == "app", u.host == "-" else { return false }
        guard ["/index.html", "/detached-window.html"].contains(u.path) else { return false }
        return !(u.queryItems ?? []).contains { $0.name == "initialRoute" && ($0.value ?? "").contains("avatar-overlay") }
    }
}

final class CDP {
    let port: Int
    private let session: URLSession
    init(port: Int) throws {
        guard (1024...65535).contains(port) else { throw WallpaperError("无效的本机端口。") }
        self.port = port
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 4
        config.timeoutIntervalForResource = 6
        config.connectionProxyDictionary = [:]
        self.session = URLSession(configuration: config)
    }
    deinit { session.invalidateAndCancel() }

    func targets() async throws -> [PageTarget] {
        let (data, response) = try await session.data(from: URL(string: "http://127.0.0.1:\(port)/json/list")!)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw WallpaperError("本机主题通道未就绪。") }
        return try JSONDecoder().decode([PageTarget].self, from: data).filter(\.isCodex)
    }
    func command(_ method: String, params: [String: Any], target: PageTarget) async throws -> [String: Any] {
        guard let address = target.webSocketDebuggerUrl, let u = URL(string: address),
              u.scheme == "ws", u.host == "127.0.0.1", u.port == port,
              u.user == nil, u.password == nil, u.path.hasPrefix("/devtools/page/") else {
            throw WallpaperError("拒绝连接非本机的主题通道。")
        }
        let socket = session.webSocketTask(with: u)
        socket.maximumMessageSize = 24_000_000
        socket.resume()
        let timeout = Task {
            try? await Task.sleep(nanoseconds: 5_000_000_000)
            if !Task.isCancelled { socket.cancel(with: .goingAway, reason: nil) }
        }
        defer { timeout.cancel(); socket.cancel(with: .normalClosure, reason: nil) }
        let payload = try JSONSerialization.data(withJSONObject: ["id": 1, "method": method, "params": params])
        try await socket.send(.string(String(decoding: payload, as: UTF8.self)))
        while true {
            let message = try await socket.receive()
            let data: Data
            switch message {
            case .data(let d): data = d
            case .string(let s): data = Data(s.utf8)
            @unknown default: continue
            }
            guard let reply = try JSONSerialization.jsonObject(with: data) as? [String: Any], reply["id"] as? Int == 1 else { continue }
            if reply["error"] != nil { throw WallpaperError("客户端拒绝主题命令：\(method)。") }
            return reply["result"] as? [String: Any] ?? [:]
        }
    }
    func evaluate(_ expression: String, target: PageTarget) async throws -> Any? {
        let reply = try await command("Runtime.evaluate", params: ["expression": expression, "returnByValue": true, "awaitPromise": true], target: target)
        if let details = reply["exceptionDetails"] {
            if CommandLine.arguments.contains("--self-test") { fputs("CDP exception: \(details)\n", stderr) }
            throw WallpaperError("主题脚本未能执行，请恢复外观后重试。") }
        return (reply["result"] as? [String: Any])?["value"]
    }
}

func verifyListener(port: Int, pid: Int32, executable: URL) throws {
    // Verify both ownership and the actual listening interface; flags alone are insufficient.
    guard let app = NSRunningApplication(processIdentifier: pid), !app.isTerminated,
          app.bundleIdentifier == "com.openai.codex", app.executableURL?.standardizedFileURL == executable.standardizedFileURL else {
        throw WallpaperError("主题通道不属于已验证的 Codex 进程。")
    }
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/sbin/lsof")
    process.arguments = ["-nP", "-a", "-p", String(pid), "-iTCP:\(port)", "-sTCP:LISTEN", "-Fn"]
    let pipe = Pipe()
    process.standardOutput = pipe
    process.standardError = FileHandle.nullDevice
    try process.run()
    let output = pipe.fileHandleForReading.readDataToEndOfFile()
    process.waitUntilExit()
    let addresses = String(decoding: output, as: UTF8.self).split(separator: "\n").filter { $0.hasPrefix("n") }
    guard process.terminationStatus == 0, !addresses.isEmpty, addresses.allSatisfy({ $0 == "n127.0.0.1:\(port)" }) else {
        throw WallpaperError("无法确认主题通道只监听本机，已停止连接。")
    }
}

func unusedLocalPort() throws -> Int {
    let descriptor = socket(AF_INET, SOCK_STREAM, 0)
    guard descriptor >= 0 else { throw WallpaperError("无法分配本机端口。") }
    defer { close(descriptor) }
    var address = sockaddr_in()
    address.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
    address.sin_family = sa_family_t(AF_INET)
    address.sin_port = 0
    address.sin_addr.s_addr = inet_addr("127.0.0.1")
    let bound = withUnsafePointer(to: &address) { ptr in
        ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { Darwin.bind(descriptor, $0, socklen_t(MemoryLayout<sockaddr_in>.size)) }
    }
    guard bound == 0 else { throw WallpaperError("无法绑定本机端口。") }
    var length = socklen_t(MemoryLayout<sockaddr_in>.size)
    let got = withUnsafeMutablePointer(to: &address) { ptr in
        ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { getsockname(descriptor, $0, &length) }
    }
    guard got == 0 else { throw WallpaperError("无法读取本机端口。") }
    return Int(UInt16(bigEndian: address.sin_port))
}
