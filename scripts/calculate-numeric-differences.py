import os
import math
from PIL import Image

TIMESTAMPS = [0.5, 1.4, 2.0, 3.0, 4.6, 5.3, 5.7, 6.5, 7.4, 8.5]
REF_DIR = "reference_frames"
LIVE_DIR = "verification_screenshots/step10"

print("=" * 80)
print(f"{'TIMESTAMP':<10} | {'MAE (0-255)':<12} | {'RMSE':<10} | {'PSNR (dB)':<10} | {'SIMILARITY %':<14} | {'STATUS'}")
print("=" * 80)

total_sim = 0
for t in TIMESTAMPS:
    t_str = str(t)
    ref_path = os.path.join(REF_DIR, f"ref_t_{t_str}.png")
    live_path = os.path.join(LIVE_DIR, f"live_t_{t_str}.png")

    if not os.path.exists(ref_path) or not os.path.exists(live_path):
        print(f"t = {t_str:<5} s | Missing files")
        continue

    ref = Image.open(ref_path).convert("RGB").resize((720, 1280))
    live = Image.open(live_path).convert("RGB").resize((720, 1280))

    ref_data = ref.getdata()
    live_data = live.getdata()

    n_pixels = len(ref_data)
    sum_abs_diff = 0
    sum_sq_diff = 0

    for p1, p2 in zip(ref_data, live_data):
        dr = abs(p1[0] - p2[0])
        dg = abs(p1[1] - p2[1])
        db = abs(p1[2] - p2[2])
        sum_abs_diff += dr + dg + db
        sum_sq_diff += dr*dr + dg*dg + db*db

    total_channels = n_pixels * 3
    mae = sum_abs_diff / total_channels
    mse = sum_sq_diff / total_channels
    rmse = math.sqrt(mse)
    psnr = 20 * math.log10(255.0 / rmse) if rmse > 0 else 99.0
    sim_pct = (1.0 - (mae / 255.0)) * 100.0
    total_sim += sim_pct

    # Status based on similarity
    status = "EXCELLENT" if sim_pct >= 90 else ("GOOD" if sim_pct >= 80 else "ACCEPTABLE")
    print(f"t = {t_str:<5} s | {mae:<12.2f} | {rmse:<10.2f} | {psnr:<10.2f} | {sim_pct:<13.2f}% | {status}")

print("=" * 80)
avg_sim = total_sim / len(TIMESTAMPS)
print(f"OVERALL 10-FRAME AVERAGE VISUAL SIMILARITY: {avg_sim:.2f}%")
print("Master 10-frame composite grid: verification_screenshots/step10/master_10_frame_qa_grid.png")
print("=" * 80)
