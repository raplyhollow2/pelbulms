#!/usr/bin/env python3
"""Generate simple PNG launcher icons without third-party deps."""
from __future__ import annotations

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "app" / "src" / "main" / "res"
SIZES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}


def pixel(x: int, y: int, size: int) -> tuple[int, int, int, int]:
    t = (x + y) / (2 * max(size - 1, 1))
    r = int(255 + (255 - 255) * (1 - t) + (255 - 255) * t)
    g = int(199 + (107 - 199) * t)
    b = int(44 + (53 - 44) * t)
    # rounded square mask
    radius = size * 0.22
    cx = min(x, size - 1 - x)
    cy = min(y, size - 1 - y)
    if cx < radius and cy < radius:
        dx = radius - cx
        dy = radius - cy
        if dx * dx + dy * dy > radius * radius:
            return (0, 0, 0, 0)
    # book glyph: two vertical-ish white strokes
    m = size / 108
    def near_line(x0, y0, x1, y1, width):
        # distance from point to segment
        vx, vy = x1 - x0, y1 - y0
        lx = x - x0
        ly = y - y0
        den = vx * vx + vy * vy or 1
        tseg = max(0, min(1, (lx * vx + ly * vy) / den))
        px, py = x0 + tseg * vx, y0 + tseg * vy
        return (x - px) ** 2 + (y - py) ** 2 <= (width * width)
    if near_line(54 * m, 32 * m, 54 * m, 76 * m, 3.2 * m):
        return (255, 255, 255, 255)
    if near_line(32 * m, 36 * m, 32 * m, 72 * m, 3.2 * m) or near_line(
        76 * m, 36 * m, 76 * m, 72 * m, 3.2 * m
    ):
        return (255, 255, 255, 255)
    if near_line(32 * m, 36 * m, 54 * m, 32 * m, 3.2 * m) or near_line(
        54 * m, 32 * m, 76 * m, 36 * m, 3.2 * m
    ):
        return (255, 255, 255, 255)
    if near_line(32 * m, 72 * m, 48 * m, 68 * m, 3.2 * m) or near_line(
        60 * m, 68 * m, 76 * m, 72 * m, 3.2 * m
    ):
        return (255, 255, 255, 255)
    return (r, g, b, 255)


def write_png(path: Path, size: int) -> None:
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            raw.extend(pixel(x, y, size))
    compressed = zlib.compress(bytes(raw), 9)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", compressed)
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def main() -> None:
    for folder, size in SIZES.items():
        dest = ROOT / folder
        dest.mkdir(parents=True, exist_ok=True)
        write_png(dest / "ic_launcher.png", size)
        write_png(dest / "ic_launcher_round.png", size)
        print(f"wrote {folder} {size}px")


if __name__ == "__main__":
    main()
