import os
import subprocess
import time
from PIL import Image, ImageDraw, ImageFont

TIMESTAMPS = [0.5, 1.4, 2.0, 3.0, 4.6, 5.3, 5.7, 6.5, 7.4, 8.5]
OUT_DIR = "verification_screenshots/step10"
REF_DIR = "reference_frames"
os.makedirs(OUT_DIR, exist_ok=True)

# 1. Capture live screenshots at 720x1280
print("Capturing 10 live timestamps at 720x1280...")
for t in TIMESTAMPS:
    t_str = str(t)
    out_path = os.path.join(OUT_DIR, f"live_t_{t_str}.png")
    url = f"http://localhost:4321/?t={t_str}"
    cmd = [
        "google-chrome",
        "--headless=new",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--window-size=720,1280",
        f"--screenshot={out_path}",
        url
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    print(f"Captured t={t_str}s -> {out_path}")

# 2. Build Side-by-Side comparison images
print("\nGenerating side-by-side composite comparisons...")
composites = []

font_title = ImageFont.load_default()

for t in TIMESTAMPS:
    t_str = str(t)
    ref_path = os.path.join(REF_DIR, f"ref_t_{t_str}.png")
    live_path = os.path.join(OUT_DIR, f"live_t_{t_str}.png")
    side_path = os.path.join(OUT_DIR, f"side_by_side_t_{t_str}.png")

    if not os.path.exists(ref_path) or not os.path.exists(live_path):
        print(f"Missing frame for t={t_str}")
        continue

    ref_img = Image.open(ref_path).convert("RGB").resize((720, 1280))
    live_img = Image.open(live_path).convert("RGB").resize((720, 1280))

    # Canvas width = 1440, height = 1360 (80px header)
    canvas = Image.new("RGB", (1440, 1360), "#FDFDF8")
    draw = ImageDraw.Draw(canvas)

    # Header bar
    draw.rectangle([0, 0, 1440, 80], fill="#3B1A6E")
    draw.text((20, 24), f"AS-SUNNAH REUNION QA - TIMESTAMP t = {t_str}s (720x1280)", fill="#FFFFFF")
    draw.text((740, 24), "LEFT: Reference Video (30fps) | RIGHT: Live Astro Mobile Build", fill="#F28C1E")

    # Paste images
    canvas.paste(ref_img, (0, 80))
    canvas.paste(live_img, (720, 80))

    # Center dividing line
    draw.line([(720, 80), (720, 1360)], fill="#6B3AA8", width=3)

    canvas.save(side_path, "PNG", quality=95)
    composites.append(canvas)
    print(f"Saved side-by-side for t={t_str}s -> {side_path}")

# 3. Create a unified 5x2 overview grid for quick review
grid_w = 720 * 2
grid_h = int((1360 / 2) * 5)
overview = Image.new("RGB", (1440, 3400), "#FDFDF8")
for i, comp in enumerate(composites):
    thumb = comp.resize((720, 680))
    col = i % 2
    row = i // 2
    overview.paste(thumb, (col * 720, row * 680))

overview_path = os.path.join(OUT_DIR, "master_10_frame_qa_grid.png")
overview.save(overview_path, "PNG", quality=90)
print(f"\nSaved Master 10-Frame QA Grid -> {overview_path}")
print("Done!")
