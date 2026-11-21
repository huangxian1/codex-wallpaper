param([string]$Compiler = "ISCC.exe")
$ErrorActionPreference = "Stop"
Push-Location $PSScriptRoot
try {
    $version = (Get-Content -Raw package.json | ConvertFrom-Json).version
    $release = Join-Path $PSScriptRoot "dist-public-$version"
    $packager = "node_modules/@electron/packager/bin/electron-packager.mjs"
    $ignore = "^/(dist[^/]*|tests|test-output|private-assets|\.test-user-data|installer\.iss|release\.ps1)($|/)"
    node $packager . CodexWallpaper --platform=win32 --arch=x64 "--out=$release" --overwrite --asar "--ignore=$ignore"
    if ($LASTEXITCODE) { throw "Electron packaging failed." }

    $app = Join-Path $release "CodexWallpaper-win32-x64"
    $zip = Join-Path $release "CodexWallpaper-$version-Windows-x64.zip"
    Compress-Archive -LiteralPath $app -DestinationPath $zip -Force

    & $Compiler "/DAppVersion=$version" "/DReleaseDir=$release" installer.iss
    if ($LASTEXITCODE) { throw "Installer compilation failed." }
    Get-FileHash $zip, (Join-Path $release "CodexWallpaper-$version-Windows-x64-Setup.exe")
} finally {
    Pop-Location
}
