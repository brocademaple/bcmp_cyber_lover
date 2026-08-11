#!/usr/bin/env python3
from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
EXPORTS = ROOT / "design" / "figma" / "exports"
OUT = ROOT / "assets" / "style"


ASSETS = [
    {
        "source": "cyberlover-sweet-ui-material-board-v1.png",
        "theme": "soft-sweet",
        "name": "bubble-pink",
        "box": (123, 57, 508, 150),
    },
    {
        "source": "cyberlover-sweet-ui-material-board-v1.png",
        "theme": "soft-sweet",
        "name": "ribbon-panel",
        "box": (505, 544, 898, 632),
    },
    {
        "source": "cyberlover-sweet-ui-material-board-v1.png",
        "theme": "soft-sweet",
        "name": "heart-charm-card",
        "box": (498, 229, 652, 449),
    },
    {
        "source": "cyberlover-sweet-ui-material-board-v1.png",
        "theme": "soft-sweet",
        "name": "avatar-frame-pink",
        "box": (798, 667, 1010, 762),
    },
    {
        "source": "cyberlover-sweet-ui-material-board-v1.png",
        "theme": "soft-sweet",
        "name": "bow-divider",
        "box": (31, 650, 283, 704),
    },
    {
        "source": "cyberlover-sweet-ui-material-board-v1.png",
        "theme": "soft-sweet",
        "name": "input-bar",
        "box": (29, 1127, 467, 1199),
    },
    {
        "source": "cyberlover-urban-luxury-translucent-ui-board-v2.png",
        "theme": "urban-luxury",
        "name": "city-glass-card",
        "box": (36, 38, 352, 218),
    },
    {
        "source": "cyberlover-urban-luxury-translucent-ui-board-v2.png",
        "theme": "urban-luxury",
        "name": "crystal-pendants",
        "box": (615, 31, 1010, 190),
    },
    {
        "source": "cyberlover-urban-luxury-translucent-ui-board-v2.png",
        "theme": "urban-luxury",
        "name": "rose-chat-bubble",
        "box": (986, 36, 1488, 126),
    },
    {
        "source": "cyberlover-urban-luxury-translucent-ui-board-v2.png",
        "theme": "urban-luxury",
        "name": "pearl-chat-bubble",
        "box": (1040, 125, 1510, 207),
    },
    {
        "source": "cyberlover-urban-luxury-translucent-ui-board-v2.png",
        "theme": "urban-luxury",
        "name": "round-window",
        "box": (1310, 380, 1485, 555),
    },
    {
        "source": "cyberlover-urban-luxury-translucent-ui-board-v2.png",
        "theme": "urban-luxury",
        "name": "night-city-card",
        "box": (962, 732, 1150, 948),
    },
    {
        "source": "cyberlover-urban-luxury-translucent-ui-board-v2.png",
        "theme": "urban-luxury",
        "name": "slider-pendant",
        "box": (22, 585, 439, 724),
    },
]


def edge_background(image: Image.Image) -> tuple[int, int, int]:
    pixels = []
    width, height = image.size
    rgb = image.convert("RGB")
    for x in range(width):
        pixels.append(rgb.getpixel((x, 0)))
        pixels.append(rgb.getpixel((x, height - 1)))
    for y in range(height):
        pixels.append(rgb.getpixel((0, y)))
        pixels.append(rgb.getpixel((width - 1, y)))
    pixels.sort(key=lambda p: p[0] + p[1] + p[2])
    mid = len(pixels) // 2
    return pixels[mid]


def transparent_cutout(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    bg = edge_background(image)
    pixels = image.load()
    width, height = image.size

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            distance = ((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2) ** 0.5
            # The Figma boards use warm off-white paper. Keep outlines, texture,
            # shadows and artwork while removing the common board background.
            if distance < 18:
                next_alpha = 0
            elif distance < 58:
                next_alpha = int(a * ((distance - 18) / 40))
            else:
                next_alpha = a
            pixels[x, y] = (r, g, b, next_alpha)

    return image


def main() -> None:
    for item in ASSETS:
        source = Image.open(EXPORTS / item["source"])
        crop = source.crop(item["box"])
        cutout = transparent_cutout(crop)
        out_dir = OUT / item["theme"]
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f'{item["name"]}.png'
        cutout.save(out_path)
        print(out_path.relative_to(ROOT))


if __name__ == "__main__":
    main()
