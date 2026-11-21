#define ProductName "Codex Wallpaper"

[Setup]
AppId=CodexWallpaper.Windows
AppName={#ProductName}
AppVersion={#AppVersion}
DefaultDirName={localappdata}\Programs\CodexWallpaper
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\CodexWallpaper.exe
OutputDir={#ReleaseDir}
OutputBaseFilename=CodexWallpaper-{#AppVersion}-Windows-x64-Setup
Compression=zip
SolidCompression=no
WizardStyle=modern
CloseApplications=yes
RestartApplications=no

[Files]
Source: "{#ReleaseDir}\CodexWallpaper-win32-x64\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{userprograms}\Codex Wallpaper"; Filename: "{app}\CodexWallpaper.exe"
