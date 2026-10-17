#!/usr/bin/env python3
"""Package only release-approved source files; never include local app/user data."""
import hashlib, pathlib, re, zipfile
root = pathlib.Path(__file__).resolve().parents[1]
version = re.search(r'^VERSION=([\d.]+)$', (root/'build.sh').read_text(), re.M).group(1)
out = root/'dist'
out.mkdir(exist_ok=True)
patterns = ['Source/*.swift', 'Source/*.js', 'Assets/*.png', 'Assets/*.icns',
            'Assets/icon-prompt.txt', 'Tests/*.py', 'Tools/*.sh', 'Tools/*.py',
            '.github/workflows/*.yml']
files = {root/name for name in ['README.md','LICENSE','NOTICE.txt','CHANGELOG.md','.gitignore','build.sh']}
for pattern in patterns:
    files.update(p for p in root.glob(pattern) if p.is_file())
archive = out/f'CodexWallpaper-{version}-source.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for p in sorted(files):
        z.write(p, str(pathlib.Path('CodexWallpaper')/p.relative_to(root)))
artifacts = sorted(out.glob(f'CodexWallpaper-{version}-*.zip')) + sorted(out.glob(f'CodexWallpaper-{version}-*.dmg'))
checksums = ''.join(f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n' for p in artifacts)
(out/'SHA256SUMS.txt').write_text(checksums)
print(f'Packaged {len(files)} source files: {archive}')
