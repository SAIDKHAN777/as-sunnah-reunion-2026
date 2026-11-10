#!/usr/bin/env python3
import sys
import os
import json
import math
import warnings
warnings.filterwarnings('ignore')
from PIL import Image, ImageChops, ImageDraw, ImageFont

def compute_metrics(ref_path, live_path):
    im_ref = Image.open(ref_path).convert('RGB')
    im_live = Image.open(live_path).convert('RGB')

    w, h = im_ref.size
    if im_live.size != (w, h):
        im_live = im_live.resize((w, h), Image.Resampling.LANCZOS)

    diff = ImageChops.difference(im_ref, im_live)
    data = list(diff.getdata())

    # 1. MAE
    mae = sum(p[0] + p[1] + p[2] for p in data) / (3.0 * len(data))

    # 2. MSE & PSNR
    mse = sum((p[0]**2 + p[1]**2 + p[2]**2) / 3.0 for p in data) / len(data)
    psnr = 10.0 * math.log10((255.0**2) / mse) if mse > 0 else 999.0

    # 3. SSIM (Block-based on luminance)
    g1 = im_ref.convert('L')
    g2 = im_live.convert('L')
    block_size = 16
    C1 = (0.01 * 255.0) ** 2
    C2 = (0.03 * 255.0) ** 2
    ssim_values = []

    for y in range(0, h - block_size + 1, block_size):
        for x in range(0, w - block_size + 1, block_size):
            box = (x, y, x + block_size, y + block_size)
            b1 = list(g1.crop(box).getdata())
            b2 = list(g2.crop(box).getdata())
            n = len(b1)
            mu1 = sum(b1) / n
            mu2 = sum(b2) / n
            var1 = sum((p - mu1)**2 for p in b1) / n
            var2 = sum((p - mu2)**2 for p in b2) / n
            cov = sum((p1 - mu1)*(p2 - mu2) for p1, p2 in zip(b1, b2)) / n

            num = (2 * mu1 * mu2 + C1) * (2 * cov + C2)
            den = (mu1**2 + mu2**2 + C1) * (var1 + var2 + C2)
            ssim_values.append(num / den if den != 0 else 1.0)

    ssim = sum(ssim_values) / len(ssim_values)

    return {
        'mae': round(mae, 2),
        'psnr': round(psnr, 2),
        'ssim': round(ssim, 4)
    }

def create_heatmap(im_ref, im_live):
    diff = ImageChops.difference(im_ref, im_live)
    diff_gray = diff.convert('L')

    # Jet/Turbo false-color thermal palette
    palette = []
    for i in range(256):
        norm = i / 255.0
        if norm == 0:
            r, g, b = 0, 0, 0
        elif norm < 0.25:
            r, g, b = 0, int(norm * 4 * 255), 255
        elif norm < 0.5:
            r, g, b = 0, 255, int((1.0 - (norm - 0.25) * 4) * 255)
        elif norm < 0.75:
            r, g, b = int((norm - 0.5) * 4 * 255), 255, 0
        else:
            r, g, b = 255, int((1.0 - (norm - 0.75) * 4) * 255), 0
        palette.extend((r, g, b))

    # Amplify differences by 2.5x for clear visual inspection
    heatmap = diff_gray.point(lambda p: min(255, int(p * 2.5)))
    heatmap.putpalette(palette)
    return heatmap.convert('RGB')

def create_side_by_side(im_ref, im_live, t, mae, ssim):
    w, h = im_ref.size
    combined = Image.new('RGB', (w * 2, h + 80), (18, 18, 24))

    # Paste reference and live
    combined.paste(im_ref, (0, 80))
    combined.paste(im_live, (w, 80))

    draw = ImageDraw.Draw(combined)
    # Header bar
    header_text_left = f"REFERENCE VIDEO (t = {t:.2f}s)"
    header_text_right = f"LIVE SITE (?t = {t:.2f}s) | MAE: {mae:.2f} | SSIM: {ssim:.4f}"

    draw.text((30, 25), header_text_left, fill=(242, 140, 30))
    draw.text((w + 30, 25), header_text_right, fill=(107, 58, 168))

    # Dividing line
    draw.line([(w, 0), (w, h + 80)], fill=(80, 80, 100), width=2)
    return combined

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python3 compute_metrics.py <ref_path> <live_path> [t] [out_side] [out_heat]")
        sys.exit(1)

    ref_path = sys.argv[1]
    live_path = sys.argv[2]
    t = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
    out_side = sys.argv[4] if len(sys.argv) > 4 else None
    out_heat = sys.argv[5] if len(sys.argv) > 5 else None

    metrics = compute_metrics(ref_path, live_path)

    im_ref = Image.open(ref_path).convert('RGB')
    im_live = Image.open(live_path).convert('RGB')

    if out_side:
        sbs = create_side_by_side(im_ref, im_live, t, metrics['mae'], metrics['ssim'])
        sbs.save(out_side)

    if out_heat:
        hm = create_heatmap(im_ref, im_live)
        draw = ImageDraw.Draw(hm)
        draw.text((20, 20), f"DIFF HEATMAP t={t:.2f}s | MAE: {metrics['mae']}", fill=(255, 255, 255))
        hm.save(out_heat)

    print(json.dumps(metrics))
