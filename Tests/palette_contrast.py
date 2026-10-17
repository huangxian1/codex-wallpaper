import re,pathlib
source=pathlib.Path(__file__).resolve().parents[1]/'Source/Theme.swift'
rows=re.findall(r'\.init\(id: "([^"]+)", name: "([^"]+)", base: "(#[0-9A-F]+)", panel: "(#[0-9A-F]+)", text: "(#[0-9A-F]+)", muted: "(#[0-9A-F]+)"',source.read_text())
def lum(h):
 c=[int(h[i:i+2],16)/255 for i in (1,3,5)]
 c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]
 return sum(a*b for a,b in zip(c,[.2126,.7152,.0722]))
def contrast(a,b):
 x,y=sorted([lum(a),lum(b)])
 return (y+.05)/(x+.05)
assert len(rows)==12
for key,name,base,panel,fg,muted in rows:
 assert min(contrast(fg,base),contrast(fg,panel))>=7,(name,'primary contrast')
 assert min(contrast(muted,base),contrast(muted,panel))>=4.5,(name,'secondary contrast')
print('PASS: 12 palettes; primary contrast >=7:1, secondary >=4.5:1 against solid base and panel colors. Wallpaper may alter effective contrast.')
