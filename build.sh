#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
VERSION=1.4.0
BUILD=6
MIN_MACOS=14.0
STAGING=$(mktemp -d "${TMPDIR:-/tmp}/codex-wallpaper.XXXXXX")
trap 'rm -rf "$STAGING"' EXIT
APP="$STAGING/Codex 壁纸.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" dist
BUILD_PIDS=()
for ARCH in x86_64 arm64; do
 echo "Compiling $ARCH (macOS $MIN_MACOS+)…"
 xcrun swiftc -swift-version 5 -O -whole-module-optimization -target "${ARCH}-apple-macosx${MIN_MACOS}" Source/*.swift -o "$STAGING/CodexWallpaper-$ARCH" -framework AppKit -framework SwiftUI -framework ImageIO &
 BUILD_PIDS+=("$!")
done
BUILD_FAILED=0
for COMPILER_PID in "${BUILD_PIDS[@]}"; do
 if ! wait "$COMPILER_PID"; then BUILD_FAILED=1; fi
done
if [[ "$BUILD_FAILED" != 0 ]]; then exit 1; fi
xcrun lipo -create "$STAGING/CodexWallpaper-x86_64" "$STAGING/CodexWallpaper-arm64" -output "$APP/Contents/MacOS/CodexWallpaper"
xcrun lipo "$APP/Contents/MacOS/CodexWallpaper" -verify_arch x86_64 arm64
cp Source/Wallpaper.js "$APP/Contents/Resources/Wallpaper.js"
cp Assets/AppIcon.icns "$APP/Contents/Resources/CodexWallpaperIcon.icns"
cp Assets/WallpaperIcon.png Assets/MenuIcon.png "$APP/Contents/Resources/"
cp NOTICE.txt LICENSE "$APP/Contents/Resources/"
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>local.codex.wallpaper</string>
<key>CFBundleName</key><string>Codex 壁纸</string>
<key>CFBundleDisplayName</key><string>Codex 壁纸</string>
<key>CFBundleExecutable</key><string>CodexWallpaper</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>$VERSION</string>
<key>CFBundleVersion</key><string>$BUILD</string>
<key>CFBundleIconFile</key><string>CodexWallpaperIcon.icns</string>
<key>LSMinimumSystemVersion</key><string>$MIN_MACOS</string>
<key>NSHighResolutionCapable</key><true/>
<key>NSPrincipalClass</key><string>NSApplication</string>
<key>NSHumanReadableCopyright</key><string>Codex Wallpaper contributors. Unofficial project; see NOTICE.txt.</string>
</dict></plist>
PLIST
/usr/bin/xattr -cr "$APP"
codesign --force --sign - "$APP"
codesign --verify --deep --strict --all-architectures "$APP"
# The archive is made outside cloud-synced folders to avoid Finder metadata.
/usr/bin/ditto -c -k --norsrc --noextattr --keepParent "$APP" "$PWD/dist/CodexWallpaper-$VERSION-macOS-universal.zip"
# Keep an unpacked build for the integration tests.
rm -rf "$PWD/dist/Codex 壁纸.app"
/usr/bin/ditto --norsrc --noextattr "$APP" "$PWD/dist/Codex 壁纸.app"
if [[ "${1:-}" == "--dmg" ]]; then
 mkdir -p "$STAGING/dmg"
 /usr/bin/ditto --norsrc --noextattr "$APP" "$STAGING/dmg/Codex 壁纸.app"
 ln -s /Applications "$STAGING/dmg/Applications"
 hdiutil create -quiet -ov -volname "Codex Wallpaper $VERSION" -srcfolder "$STAGING/dmg" -format UDZO "$PWD/dist/CodexWallpaper-$VERSION-macOS-universal.dmg"
fi
(
 cd dist
 shasum -a 256 "CodexWallpaper-$VERSION-macOS-universal.zip" > SHA256SUMS.txt
 if [[ -f "CodexWallpaper-$VERSION-macOS-universal.dmg" ]]; then
  shasum -a 256 "CodexWallpaper-$VERSION-macOS-universal.dmg" >> SHA256SUMS.txt
 fi
)
echo "Built universal macOS release: $PWD/dist"
