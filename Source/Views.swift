import SwiftUI
import AppKit
import UniformTypeIdentifiers

struct WallpaperView: View {
    @ObservedObject var model: Controller
    private let ink = Color(hex: "#233B35")
    var body: some View {
        HStack(spacing: 0) {
            controlPanel
            mainPanel
        }
        .frame(minWidth: 980, minHeight: 660)
        .preferredColorScheme(.light)
        .onDrop(of: [UTType.fileURL], isTargeted: nil) { providers in
            guard let provider = providers.first else { return false }
            _ = provider.loadDataRepresentation(forTypeIdentifier: UTType.fileURL.identifier) { data, _ in
                if let data, let url = URL(dataRepresentation: data, relativeTo: nil) {
                    Task { @MainActor in model.loadImage(url) }
                }
            }
            return true
        }
    }
    private var controlPanel: some View {
        ScrollView {
        VStack(alignment: .leading, spacing: 22) {
                HStack(spacing: 10) {
                    Image(nsImage: NSImage(named: "WallpaperIcon") ?? NSImage()).resizable().scaledToFit().frame(width: 44, height: 44)
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Codex 壁纸").font(.system(size: 19, weight: .semibold))
                        Text("一个属于你的工作空间").font(.system(size: 11)).foregroundStyle(.secondary)
                    }
                }
                Divider()
                VStack(alignment: .leading, spacing: 10) {
                    caption("01", "选择壁纸")
                    Button { model.chooseImage() } label: {
                        HStack {
                            Image(systemName: "photo.badge.plus").font(.system(size: 18))
                            Text(model.hasWallpaper ? "更换本地图片" : "选择本地图片").font(.system(size: 13, weight: .medium))
                            Spacer()
                            Image(systemName: "arrow.up.right").font(.system(size: 11))
                        }.padding(14).background(.white.opacity(0.9), in: RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(ink.opacity(0.12)))
                    }.buttonStyle(.plain)
                    HStack {
                        Text("也可拖入图片 · 图片仅存本机").font(.system(size: 10)).foregroundStyle(.secondary)
                        Spacer()
                        if model.hasWallpaper { Button("移除") { model.clearImage() }.font(.system(size: 10)).buttonStyle(.plain) }
                    }
                }
                VStack(alignment: .leading, spacing: 12) {
                    caption("02", "搭配底色")
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 4), spacing: 12) {
                        ForEach(Palette.presets) { palette in
                            Button {
                                model.settings.paletteID = palette.id; model.edited()
                            } label: {
                                VStack(spacing: 7) {
                                    RoundedRectangle(cornerRadius: 10).fill(Color(hex: palette.base))
                                        .frame(height: 37)
                                        .overlay(Image(systemName: "checkmark").font(.system(size: 12, weight: .bold)).foregroundStyle(Color(hex: palette.text)).opacity(model.settings.paletteID == palette.id ? 1 : 0))
                                        .padding(3)
                                        .overlay(RoundedRectangle(cornerRadius: 13).strokeBorder(model.settings.paletteID == palette.id ? ink : .clear, lineWidth: 1.5))
                                    Text(palette.name).font(.system(size: 11)).foregroundStyle(.primary)
                                }
                            }.buttonStyle(.plain)
                        }
                    }
                }
                VStack(alignment: .leading, spacing: 14) {
                    caption("03", "调整氛围")
                    control("壁纸可见度", detail: "\(Int(model.settings.strength * 100))%", value: $model.settings.strength, range: 0...0.85)
                    control("背景模糊", detail: "\(Int(model.settings.blur)) px", value: $model.settings.blur, range: 0...30)
                    control("壁纸缩放", detail: "\(Int(model.settings.zoom * 100))%", value: $model.settings.zoom, range: 0.25...3)
                    control("画面左右偏移", detail: model.settings.horizontalOffset == 0 ? "居中" : "\(Int(model.settings.horizontalOffset))%", value: $model.settings.horizontalOffset, range: -100...100)
                    control("画面上下位置", detail: "\(Int(model.settings.position))%", value: $model.settings.position, range: 0...100)
                }
                Spacer(minLength: 0)
                VStack(alignment: .leading, spacing: 5) {
                    Label(BuildInfo.platformDescription, systemImage: "desktopcomputer").font(.system(size: 10, weight: .medium))
                    Text("Codex \(model.installation?.version ?? "未检测到")").font(.system(size: 10)).foregroundStyle(.secondary)
                }
            }
            .padding(26)
        }.frame(width: 286).background(Color(hex: "#F3F4EF"))
    }
    private var mainPanel: some View {
        VStack(alignment: .leading, spacing: 20) {
                HStack {
                    VStack(alignment: .leading, spacing: 5) {
                        Text("让灵感，有自己的背景。").font(.system(size: 25, weight: .semibold))
                        Text("保留熟悉的工作方式，换一份喜欢的氛围。").font(.system(size: 12)).foregroundStyle(.secondary)
                    }
                    Spacer()
                    HStack(spacing: 6) {
                        Circle().fill(model.active ? Color(hex: "#478263") : Color.gray.opacity(0.5)).frame(width: 6, height: 6)
                        Text(model.active ? "已应用" : "预览中").font(.system(size: 11, weight: .medium))
                    }.padding(.horizontal, 12).padding(.vertical, 7).background(Color(hex: "#EEF1EC"), in: Capsule())
                }
                PreviewScene(model: model)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: 18))
                    .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(Color.black.opacity(0.08)))
                    .shadow(color: .black.opacity(0.07), radius: 18, y: 7)
                HStack {
                    Text("布局示意预览 · 实际效果以 Codex 窗口为准").font(.system(size: 10)).foregroundStyle(.secondary)
                    Spacer()
                    if model.active && model.dirty { Text("有更改待应用").font(.system(size: 10)).foregroundStyle(ink) }
                }
                HStack(alignment: .top, spacing: 9) {
                    Image(systemName: model.failure ? "exclamationmark.circle" : "info.circle").foregroundStyle(model.failure ? Color.orange : ink)
                    Text(model.status).font(.system(size: 12)).foregroundStyle(.secondary).frame(maxWidth: .infinity, alignment: .leading)
                }.frame(minHeight: 32, alignment: .top)
                HStack(spacing: 12) {
                    Button { model.restore() } label: {
                        Label("恢复原始外观", systemImage: "arrow.uturn.backward").frame(height: 32)
                    }.buttonStyle(.bordered).disabled(model.busy || !model.active)
                    Spacer()
                    if model.busy { ProgressView().controlSize(.small) }
                    Button { model.apply() } label: {
                        HStack(spacing: 8) {
                            Text(model.active ? "应用更改" : "连接并应用")
                            Image(systemName: "arrow.right")
                        }.font(.system(size: 13, weight: .semibold)).padding(.horizontal, 15).frame(height: 34)
                    }.buttonStyle(.borderedProminent).tint(ink).disabled(model.busy || model.installation == nil)
                }
                Text("首次应用需要重启 Codex。关闭此窗口会留在菜单栏；退出工具会恢复外观。")
                    .font(.system(size: 10)).foregroundStyle(.secondary)
            }.padding(30).frame(maxWidth: .infinity, maxHeight: .infinity).background(Color(hex: "#FCFCF9"))
    }
    private func caption(_ number: String, _ text: String) -> some View {
        HStack(spacing: 8) {
            Text(number).font(.system(size: 10, weight: .semibold, design: .monospaced)).foregroundStyle(ink.opacity(0.55))
            Text(text).font(.system(size: 12, weight: .semibold))
        }
    }
    private func control(_ label: String, detail: String, value: Binding<Double>, range: ClosedRange<Double>) -> some View {
        VStack(spacing: 5) {
            HStack {
                Text(label).font(.system(size: 12))
                Spacer()
                Text(detail).font(.system(size: 11, design: .monospaced)).foregroundStyle(.secondary)
            }
            Slider(value: value, in: range).tint(ink).controlSize(.small)
                .onChange(of: value.wrappedValue) { model.edited() }
        }
    }
}

struct PreviewScene: View {
    @ObservedObject var model: Controller
    var body: some View {
        GeometryReader { geometry in
            let p = model.palette
            ZStack {
                Color(hex: p.base)
                if let image = model.image {
                    GeometryReader { canvas in
                        let scale = max(canvas.size.width / image.size.width, canvas.size.height / image.size.height) * model.settings.zoom
                        let width = image.size.width * scale
                        let height = image.size.height * scale
                        Image(nsImage: image).resizable().frame(width: width, height: height)
                            .offset(x: -(width - canvas.size.width) / 2 + canvas.size.width * model.settings.horizontalOffset / 100, y: -(height - canvas.size.height) * model.settings.position / 100)
                    }.clipped().blur(radius: model.settings.blur * 0.45).opacity(model.settings.strength)
                } else {
                    RadialGradient(colors: [Color(hex: p.accent).opacity(0.2), .clear], center: .topTrailing, startRadius: 0, endRadius: 400)
                }
                HStack(spacing: 0) {
                    VStack(alignment: .leading, spacing: 18) {
                        HStack(spacing: 5) {
                            ForEach(["#ED6A60", "#F4BF50", "#62C554"], id: \.self) { c in Circle().fill(Color(hex: c)).frame(width: 7, height: 7) }
                        }.padding(.bottom, 12)
                        Label("新建聊天", systemImage: "square.and.pencil").font(.system(size: 10, weight: .medium))
                        Label("搜索", systemImage: "magnifyingglass").font(.system(size: 10))
                        Text("你的项目").font(.system(size: 9)).foregroundStyle(Color(hex: p.muted)).padding(.top, 12)
                        Label("灵感笔记", systemImage: "folder").font(.system(size: 10))
                        Label("我的工作空间", systemImage: "folder").font(.system(size: 10))
                        Spacer()
                        Label("设置", systemImage: "gearshape").font(.system(size: 10))
                    }.padding(18).frame(width: 140, alignment: .leading).background(Color(hex: p.base).opacity(0.6))
                    VStack(spacing: 0) {
                        HStack { Text("Codex").font(.system(size: 10, weight: .medium)); Spacer(); Image(systemName: "sidebar.right").font(.system(size: 11)) }.padding(20)
                        Spacer()
                        Image(systemName: "sparkle").font(.system(size: 25, weight: .light)).foregroundStyle(Color(hex: p.accent)).padding(.bottom, 15)
                        Text("今天，想创造什么？").font(.system(size: 21, weight: .medium))
                        Text("留一点空间，给新的想法。").font(.system(size: 11)).foregroundStyle(Color(hex: p.muted)).padding(.top, 9)
                        Spacer()
                        VStack(alignment: .leading, spacing: 25) {
                            Text("描述一个想法，开始一起完成…").font(.system(size: 10)).foregroundStyle(Color(hex: p.muted))
                            HStack {
                                Image(systemName: "plus"); Spacer()
                                Image(systemName: "arrow.up.circle.fill").foregroundStyle(Color(hex: p.accent))
                            }.font(.system(size: 14))
                        }.padding(14).background(Color(hex: p.panel).opacity(0.95), in: RoundedRectangle(cornerRadius: 14))
                            .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Color(hex: p.border), lineWidth: 0.5)).padding(22)
                    }
                }.foregroundStyle(Color(hex: p.text))
            }.clipped()
        }
    }
}
