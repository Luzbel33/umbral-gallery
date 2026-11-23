"""Make the exhibition soundtrack and video from the original Blender renders."""
from pathlib import Path
import subprocess
import tempfile
import wave
import numpy as np

out = Path(__file__).resolve().parents[1] / "public" / "art"
rate = 44100
duration = 24
t = np.arange(rate * duration) / rate
with tempfile.TemporaryDirectory() as tmp:
    mix = np.zeros((len(t), 2))
    for i, hz in enumerate([110, 164.81, 220, 246.94, 329.63, 440]):
        for channel in range(2):
            drift = 0.17 * np.sin(2 * np.pi * t / (11+i) + channel)
            envelope = (.65 + .35 * np.cos(2*np.pi*t/(8+i)+i))
            mix[:,channel] += envelope * np.sin(2*np.pi*hz*t + drift + i*.3) / (i+3)
    fade = np.clip(np.minimum(t, duration-t)/2,0,1)
    mix = np.int16(mix * fade[:,None] * 10500)
    wav = Path(tmp) / "onda.wav"
    with wave.open(str(wav),"wb") as f:
        f.setparams((2,2,rate,0,"NONE","")); f.writeframes(mix.tobytes())
    subprocess.run(["ffmpeg","-loglevel","error","-y","-i",str(wav),"-b:a","112k",str(out/"onda.mp3")],check=True)
subprocess.run(["ffmpeg","-loglevel","error","-y","-i",str(out/"intervalos.webp"),"-vf",
    "scale=1500:-1,zoompan=z='1.03+0.14*(1-cos(on*2*PI/168))/2':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=168:s=864x576:fps=24",
    "-c:v","libx264","-crf","22","-pix_fmt","yuv420p","-movflags","+faststart",str(out/"transito.mp4")],check=True)
