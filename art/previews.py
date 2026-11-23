"""Make the web catalogue's small exhibition covers from the finished artwork."""

from pathlib import Path
from PIL import Image, ImageOps

assets = Path(__file__).resolve().parents[1] / "public" / "art"
for room in ("orbital", "frecuencia", "intervalos", "estratos"):
    source = room if room == "orbital" else "cover-" + room
    with Image.open(assets / (source + ".webp")) as image:
        cover = ImageOps.fit(image, (520, 330), method=Image.Resampling.LANCZOS)
        cover.save(assets / ("thumb-" + room + ".webp"), quality=73, method=6)

with Image.open(assets / "earth-parana_delta_0.webp") as image:
    hero = ImageOps.fit(image, (960, 630), method=Image.Resampling.LANCZOS)
    hero.save(assets / "earth-parana_delta_0-hero.webp", quality=67, method=6)
