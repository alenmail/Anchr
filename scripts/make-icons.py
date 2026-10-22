#!/usr/bin/env python3
"""Draw Stone's Anchr mark at multiple resolutions for Electron installers.
Requires Pillow. Public SVG is the canonical vector design.
"""
from pathlib import Path
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "electron" / "icons"
OUT.mkdir(parents=True, exist_ok=True)
SCALE = 4
SIZE = 1024
im = Image.new("RGBA", (SIZE*SCALE, SIZE*SCALE), (0,0,0,0))
d = ImageDraw.Draw(im)
def pts(values):
    return [(round(x*SIZE*SCALE/1200),round(y*SIZE*SCALE/1200)) for x,y in values]
def poly(values,fill):
    d.polygon(pts(values), fill=fill)
d.rounded_rectangle((0,0,SIZE*SCALE-1,SIZE*SCALE-1),radius=310*SIZE*SCALE//1200,fill="#080c13",outline="#303b4d",width=3*SCALE)
WHITE="#f8faff";BLUE="#087aff";CYAN="#00c7ed"
poly([(332,578),(592,225),(609,225),(863,577),(860,597),(796,642),(779,637),(609,372),(599,371),(409,636),(390,640),(330,595)],WHITE)
poly([(599,441),(485,586),(490,590),(599,536)],CYAN)
poly([(599,441),(713,586),(708,590),(599,536)],BLUE)
poly([(590,555),(609,555),(641,582),(641,841),(654,868),(674,865),(863,757),(872,742),(872,720),(862,712),(798,712),(795,702),(818,674),(958,589),(968,596),(968,714),(947,768),(921,791),(610,977),(590,977),(279,791),(253,768),(232,714),(232,596),(242,589),(382,674),(405,702),(402,712),(338,712),(328,720),(328,742),(337,757),(526,865),(546,868),(559,841),(559,582)],WHITE)
im=im.resize((SIZE,SIZE),Image.Resampling.LANCZOS).convert("RGBA")
im.save(OUT/"icon.png",optimize=True)
im.save(OUT/"icon.ico",format="ICO",sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
try:
    im.save(OUT/"icon.icns",format="ICNS")
except Exception as error:
    print("macOS .icns generation skipped:", error)
print("Anchr installer icons generated.")
