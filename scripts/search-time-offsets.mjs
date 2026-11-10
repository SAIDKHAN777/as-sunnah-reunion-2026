import puppeteer from 'puppeteer-core';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:4321';
const OUT_DIR = 'verification_screenshots/step10c';
const REF_DIR = 'reference_frames';

const TIMESTAMPS = [0.5, 1.4, 2.0, 3.0, 4.6, 5.3, 5.7, 6.5, 7.4, 8.5];
const STEP = 1.0 / 30.0; // 1/30 second (approx 0.0333s)

fs.mkdirSync(OUT_DIR, { recursive: true });

async function runOffsetSearch() {
  console.log('========================================================================');
  console.log('STEP 10C: PART A - MASTER CLOCK TIMING OFFSET SEARCH & VISUAL QA MATRIX');
  console.log('========================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 720, height: 1280, deviceScaleFactor: 1 });

  // Load once
  await page.goto(`${BASE_URL}/?t=0`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 200));

  const results = [];

  for (const T of TIMESTAMPS) {
    const tStr = T.toFixed(1);
    const refPath = path.join(REF_DIR, `ref_t_${tStr}.png`);
    console.log(`\n>>> Scanning Timestamp t = ${tStr}s across offset range [-0.5s, +0.5s]`);

    let bestOffset = 0;
    let minMae = 9999;

    // Scan offset from -0.5s to +0.5s in steps of 1/30s
    for (let offset = -0.5; offset <= 0.5001; offset += STEP) {
      const siteT = Math.max(0, T + offset);
      await page.evaluate((t) => {
        window.__seekTime(t);
      }, siteT);

      const tempLivePath = `/tmp/search_live_${tStr}.png`;
      await page.screenshot({ path: tempLivePath });

      const metricsRaw = execSync(`python3 scripts/compute_metrics.py "${refPath}" "${tempLivePath}"`).toString();
      const metrics = JSON.parse(metricsRaw.trim());

      if (metrics.mae < minMae) {
        minMae = metrics.mae;
        bestOffset = offset;
      }
    }

    console.log(`- Optimal Offset: ${bestOffset >= 0 ? '+' : ''}${bestOffset.toFixed(3)}s | Min MAE: ${minMae.toFixed(2)} | Site seek t: ${(T + bestOffset).toFixed(3)}s`);

    // Capture the final best-offset live screenshot
    const bestSiteT = Math.max(0, T + bestOffset);
    await page.evaluate((t) => {
      window.__seekTime(t);
    }, bestSiteT);

    const finalLivePath = path.join(OUT_DIR, `live_t_${tStr}.png`);
    const sbsPath = path.join(OUT_DIR, `side_by_side_t_${tStr}.png`);
    const heatPath = path.join(OUT_DIR, `diff_heatmap_t_${tStr}.png`);

    await page.screenshot({ path: finalLivePath });

    // Generate Side-by-Side and Difference Heatmap
    const finalMetricsRaw = execSync(
      `python3 scripts/compute_metrics.py "${refPath}" "${finalLivePath}" ${T} "${sbsPath}" "${heatPath}"`
    ).toString();
    const finalMetrics = JSON.parse(finalMetricsRaw.trim());

    results.push({
      t: T,
      bestOffset: Number(bestOffset.toFixed(3)),
      bestSiteT: Number(bestSiteT.toFixed(3)),
      mae: finalMetrics.mae,
      psnr: finalMetrics.psnr,
      ssim: finalMetrics.ssim,
      livePath: finalLivePath,
      sbsPath: sbsPath,
      heatPath: heatPath
    });

    console.log(`  -> Saved Side-by-Side: ${sbsPath}`);
    console.log(`  -> Saved Diff Heatmap: ${heatPath}`);
    console.log(`  -> Metrics: MAE=${finalMetrics.mae}, SSIM=${finalMetrics.ssim}, PSNR=${finalMetrics.psnr} dB`);
  }

  await browser.close();

  // Save JSON report
  const reportPath = path.join(OUT_DIR, 'offset_search_results.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\nResults written to: ${reportPath}`);

  // Build Master 10-frame Comparison Grid
  console.log('\n--- Building Master 10-Frame Comparison Grid ---');
  execSync(`python3 -c "
import json
from PIL import Image

with open('${reportPath}') as f:
    data = json.load(f)

# 5 rows x 2 columns
grid_w = 1440
grid_h = 680 * 5
master_grid = Image.new('RGB', (grid_w, grid_h), (12, 12, 16))

for idx, item in enumerate(data):
    sbs = Image.open(item['sbsPath']).convert('RGB')
    sbs_small = sbs.resize((720, 680), Image.Resampling.LANCZOS)
    row = idx // 2
    col = idx % 2
    master_grid.paste(sbs_small, (col * 720, row * 680))

master_grid.save('${OUT_DIR}/master_10c_comparison_grid.png')
print('Saved master grid: ${OUT_DIR}/master_10c_comparison_grid.png')
"`);

  console.log('\n========================================================================');
  console.log('SUMMARY TABLE:');
  console.table(results.map(r => ({
    'Timestamp (s)': r.t.toFixed(1),
    'Best Offset (s)': r.bestOffset >= 0 ? `+${r.bestOffset.toFixed(3)}` : r.bestOffset.toFixed(3),
    'MAE': r.mae,
    'SSIM': r.ssim,
    'PSNR (dB)': r.psnr
  })));
  console.log('========================================================================');
}

runOffsetSearch().catch(err => {
  console.error(err);
  process.exit(1);
});
