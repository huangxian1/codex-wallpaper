Unicode true
Name "Codex Wallpaper"
OutFile "${ReleaseDir}\CodexWallpaper-${AppVersion}-Windows-x64-Portable.exe"
RequestExecutionLevel user
SilentInstall silent
AutoCloseWindow true
SetCompressor zlib
VIProductVersion "${AppVersion}.0"
VIAddVersionKey "ProductName" "Codex Wallpaper"
VIAddVersionKey "FileDescription" "Codex Wallpaper Portable"
VIAddVersionKey "FileVersion" "${AppVersion}"
VIAddVersionKey "LegalCopyright" "Codex Wallpaper contributors"

Section
  InitPluginsDir
  SetOutPath "$PLUGINSDIR\app"
  File /r "${ReleaseDir}\CodexWallpaper-win32-x64\*"
  ClearErrors
  ExecWait '"$OUTDIR\CodexWallpaper.exe"' $0
  IfErrors launchError
  SetErrorLevel $0
  Goto done
launchError:
  MessageBox MB_ICONSTOP "Could not start Codex Wallpaper."
  SetErrorLevel 1
done:
  SetOutPath "$TEMP"
SectionEnd
