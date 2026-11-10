import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const FFMPEG = '/home/saidkhan/.local/bin/ffmpeg';
const VIDEO_PATH = 'public/assets/reference/reunion-full-with-theme-video.mp4';
const OUT_DIR = 'reference_frames';

const TIMESTAMPS = [0.5, 1.4, 2.0, 3.0, 4.6, 5.3, 5.7, 6.5, 7.4, 8.5];

console.log('=== STEP 10C: PART A - 1. EXTRACT REFERENCE FRAMES ===');
console.log(`Video source: ${VIDEO_PATH}`);

for (const t of TIMESTAMPS) {
  const tStr = t.toFixed(1);
  const outFile = path.join(OUT_DIR, `ref_t_${tStr}.png`);
  // Extract exact frame at timestamp t without scaling, 24-bit RGB, no alpha
  const cmd = [
    '-y',
    '-ss', String(t),
    '-i', VIDEO_PATH,
    '-vframes', '1',
    '-pix_fmt', 'rgb24',
    outFile
  ];

  const res = spawnSync(FFMPEG, cmd, { stdio: 'pipe' });
  if (res.status !== 0) {
    console.error(`Error extracting frame at t=${t}:`, res.stderr.toString());
    process.exit(1);
  }

  const stat = fs.statSync(outFile);
  console.log(`Extracted t=${t.toFixed(1)}s -> ${outFile} (${stat.size} bytes)`);
}

console.log('All 10 reference frames extracted successfully.');
