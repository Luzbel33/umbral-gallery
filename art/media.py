"""Make the screening loop from the original Blender render."""
from pathlib import Path
import subprocess

out = Path(__file__).resolve().parents[1] / "public" / "art"
subprocess.run(["ffmpeg","-loglevel","error","-y","-i",str(out/"intervalos.webp"),"-vf",
    "scale=1500:-1,zoompan=z='1.03+0.14*(1-cos(on*2*PI/168))/2':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=168:s=864x576:fps=24",
    "-c:v","libx264","-crf","22","-pix_fmt","yuv420p","-movflags","+faststart",str(out/"transito.mp4")],check=True)
