"""Bake neutral, tintable museum surfaces. No textures are downloaded."""
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np

out=Path(__file__).resolve().parents[1]/"public"/"art"
rng=np.random.default_rng(85)
width,height=1200,470
y,x=np.mgrid[0:height,0:width]
def noise(w,h,amplitude):
    a=Image.fromarray(rng.integers(0,255,(h,w),dtype=np.uint8)).resize((width,height),Image.Resampling.BICUBIC)
    return (np.asarray(a,dtype=np.float32)/255-.5)*amplitude

v=201+noise(22,19,19)+noise(113,50,12)+noise(380,140,10)+rng.normal(0,3,(height,width))
# Ambient occlusion at the ceiling, skirting and inside corners.
v-=29*np.exp(-y/26)+38*np.exp(-(height-y)/15)+24*np.exp(-np.minimum(x,width-x)/28)
for px in [115,348,581,814,1047]:
    cone=(x-px)/(24+.26*y)
    v+=27*np.exp(-cone**2)*np.exp(-((y-200)/190)**2)
for px in range(0,width,150):
    v[:,px:px+1]-=33
    v[:,px+1:px+2]+=10
for py in [238]:
    v[py:py+1]-=16
im=Image.fromarray(np.clip(v,0,255).astype('uint8'));d=ImageDraw.Draw(im)
for px in range(24,width,150):
    for py in (36,205,276,437):
        d.ellipse((px,py,px+3,py+3),fill=144);d.point((px+2,py+3),fill=219)
im.save(out/"formwork.webp",quality=82)
v=219+noise(10,96,16)+noise(60,120,11)+rng.normal(0,3,(height,width))
for _ in range(1300):
    px,py=rng.integers(0,width),rng.integers(0,height)
    v[py:py+1,px:px+rng.integers(1,9)]-=rng.integers(10,51)
Image.fromarray(np.clip(v,0,255).astype('uint8')).save(out/"travertine.webp",quality=82)
