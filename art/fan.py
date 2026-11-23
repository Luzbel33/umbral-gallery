"""Create the folded copper study in Umbral's static mesh format."""

import math
import struct
from pathlib import Path

faces, colors = [], []
folds, rows = 27, 12


def vertex(i, j, back):
    u, v = i / folds, j / rows
    angle = (-0.43 + 0.86 * u) * math.pi
    r = 0.24 + 1.04 * v
    depth = (
        (0.045 if i % 2 else -0.045) * (0.35 + v)
        + 0.21 * math.sin(1.7 * angle + v)
        + back
    )
    return (r * math.sin(angle), r * math.cos(angle) - 0.2, depth)


def tri(a, b, c, tint):
    faces.extend((*a, *b, *c))
    # The gallery mesh stores linear RGB vertex colors.
    colors.extend(
        round(255 * (((v / 255 + 0.055) / 1.055) ** 2.4 if v > 10 else v / 255 / 12.92))
        for v in tint
    )


for i in range(folds):
    for j in range(rows):
        for side in (0, -0.032):
            a, b, c, d = (
                vertex(x, y, side)
                for x, y in ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))
            )
            tint = (
                174 + int(33 * j / rows),
                92 + int(27 * j / rows),
                57 + int(16 * j / rows),
            )
            if i % 2:
                tint = tuple(int(v * 0.79) for v in tint)
            tri(a, b, c, tint)
            tri(a, c, d, tint)
        if j in (0, rows - 1):
            k = j if j == 0 else j + 1
            a, b, c, d = (
                vertex(x, k, z)
                for x, z in ((i, 0), (i + 1, 0), (i + 1, -0.032), (i, -0.032))
            )
            tri(a, b, c, (130, 75, 48))
            tri(a, c, d, (130, 75, 48))
for i in (0, folds):
    for j in range(rows):
        a, b, c, d = (
            vertex(i, y, z)
            for y, z in ((j, 0), (j + 1, 0), (j + 1, -0.032), (j, -0.032))
        )
        tri(a, b, c, (130, 75, 48))
        tri(a, c, d, (130, 75, 48))
dest = Path(__file__).resolve().parents[1] / "public" / "art" / "copper-fan.mesh"
dest.write_bytes(
    b"UMB1"
    + struct.pack("<I", len(colors) // 3)
    + struct.pack("<%sf" % len(faces), *faces)
    + bytes(colors)
)
