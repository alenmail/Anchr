"""Generate a small zero-cost icon pack with a consistent stroke style.
Images are provided as transparent PNG for optional Roblox Image asset uploads.
No remote icon service needed.
"""
from PIL import Image, ImageDraw
from pathlib import Path
import math, json
OUT=Path(__file__).resolve().parents[1]/"vendor"/"anchr-icons"
OUT.mkdir(parents=True,exist_ok=True)
S=512;CX=256;CY=256
names=["home","settings","search","play","pause","heart","star","shield","chat","close","check","menu","plus","minus","inventory","user","camera","back","forward","notification","help","map","lock","sound"]
def line(d,pts,width=23):d.line(pts,fill="white",width=width,joint="curve")
def ellipse(d,box,width=23):d.ellipse(box,outline="white",width=width)
for name in names:
    image=Image.new("RGBA",(S,S),(0,0,0,0));d=ImageDraw.Draw(image)
    if name=="home":
        line(d,[(110,260),(256,128),(402,260),(402,412),(110,412),(110,260)]);line(d,[(212,412),(212,305),(300,305),(300,412)])
    elif name=="settings":
        ellipse(d,(144,144,368,368),28);ellipse(d,(225,225,287,287),18)
        for a in range(8):
            ang=a*math.pi/4
            p=lambda r:(round(256+math.cos(ang)*r),round(256+math.sin(ang)*r))
            line(d,[p(124),p(174)],27)
    elif name=="search":
        ellipse(d,(110,104,310,304));line(d,[(296,296),(414,414)])
    elif name=="play":
        d.polygon([(154,108),(402,256),(154,404)],outline="white",width=23)
    elif name=="pause":
        line(d,[(194,126),(194,386)],45);line(d,[(318,126),(318,386)],45)
    elif name=="heart":
        line(d,[(256,406),(112,271),(111,199),(166,149),(224,162),(256,206),(288,162),(348,149),(401,199),(400,271),(256,406)])
    elif name=="star":
        pts=[(round(256+math.cos(-math.pi/2+i*math.pi/5)*(174 if i%2==0 else 80)),round(256+math.sin(-math.pi/2+i*math.pi/5)*(174 if i%2==0 else 80)))for i in range(10)]
        line(d,pts+[pts[0]])
    elif name=="shield":
        line(d,[(256,100),(390,147),(380,298),(256,410),(132,298),(122,147),(256,100)])
    elif name=="chat":
        line(d,[(113,123),(398,123),(398,339),(265,339),(175,405),(175,339),(113,339),(113,123)])
    elif name=="close":
        line(d,[(136,136),(376,376)]);line(d,[(376,136),(136,376)])
    elif name=="check":
        line(d,[(102,255),(214,360),(416,152)],33)
    elif name=="menu":
        for y in (160,256,352):line(d,[(126,y),(390,y)])
    elif name=="plus":
        line(d,[(256,116),(256,396)]);line(d,[(116,256),(396,256)])
    elif name=="minus":
        line(d,[(116,256),(396,256)])
    elif name=="inventory":
        line(d,[(119,180),(256,111),(393,180),(393,351),(256,420),(119,351),(119,180)])
        line(d,[(119,180),(256,259),(393,180)]);line(d,[(256,259),(256,420)])
    elif name=="user":
        ellipse(d,(185,98,327,240));line(d,[(102,405),(120,331),(174,284),(338,284),(392,331),(410,405)])
    elif name=="camera":
        d.rounded_rectangle((100,173,412,382),radius=35,outline="white",width=24)
        ellipse(d,(210,226,304,320));line(d,[(166,173),(202,126),(318,126),(350,173)])
    elif name in ("back","forward"):
        sign=-1 if name=="back" else 1
        line(d,[(256+sign*105,125),(256-sign*105,256),(256+sign*105,387)])
    elif name=="notification":
        line(d,[(140,353),(371,353),(329,298),(329,211),(301,158),(256,140),(211,158),(183,211),(183,298),(140,353)])
        line(d,[(236,386),(276,386)])
    elif name=="help":
        ellipse(d,(106,106,406,406))
        line(d,[(204,200),(214,165),(260,153),(308,176),(320,218),(300,251),(256,281),(256,306)])
        ellipse(d,(246,348,268,370),5)
    elif name=="map":
        line(d,[(110,159),(211,116),(303,164),(402,121),(402,346),(303,391),(211,343),(110,388),(110,159)])
        line(d,[(211,116),(211,343)]);line(d,[(303,164),(303,391)])
    elif name=="lock":
        d.rounded_rectangle((142,230,370,409),radius=26,outline="white",width=24)
        line(d,[(181,230),(181,183),(196,146),(229,130),(285,130),(315,146),(330,183),(330,230)])
    else:
        line(d,[(144,218),(203,218),(286,150),(286,360),(203,293),(144,293)])
        line(d,[(346,170),(390,224),(390,284),(346,338)])
    image.save(OUT/(name+".png"),optimize=True)
(OUT/"manifest.json").write_text(json.dumps({"license":"Original Anchr icons by Stone; available for project use","format":"PNG transparent 512px","icons":names},indent=2))
print("Generated",len(names),"local icon PNGs")
