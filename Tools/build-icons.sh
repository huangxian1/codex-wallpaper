#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
ICON_STAGE=$(mktemp -d "${TMPDIR:-/tmp}/codex-wallpaper-icons.XXXXXX")
trap 'rm -rf "$ICON_STAGE"' EXIT
mkdir -p "$ICON_STAGE/AppIcon.iconset"
for size in 16 32 128 256 512; do
 sips -z "$size" "$size" Assets/WallpaperIcon.png --out "$ICON_STAGE/AppIcon.iconset/icon_${size}x${size}.png" >/dev/null
 double=$((size * 2))
 sips -z "$double" "$double" Assets/WallpaperIcon.png --out "$ICON_STAGE/AppIcon.iconset/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$ICON_STAGE/AppIcon.iconset" -o Assets/AppIcon.icns
sips -z 44 44 Assets/WallpaperIcon.png --out Assets/MenuIcon.png >/dev/null
