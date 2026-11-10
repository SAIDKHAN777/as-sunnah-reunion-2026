import http from 'http';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const DIST_DIR = '/home/saidkhan/Foundetion/dist';
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(DIST_DIR, reqPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.woff2': 'font/woff2'
    };
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(4328, () => {
  console.log('Lighthouse server running on http://127.0.0.1:4328');
  try {
    const lhCmd = '/home/saidkhan/.npm/_npx/0f94ee7615faf582/node_modules/.bin/lighthouse http://127.0.0.1:4328 --chrome-flags="--headless --no-sandbox --disable-gpu --force-prefers-reduced-motion" --form-factor=mobile --output=json --output-path=verification_screenshots/step8_lh.json --only-categories=performance,accessibility,best-practices,seo --max-wait-for-load=20000';
    console.log('Running Lighthouse with --force-prefers-reduced-motion...');
    execSync(lhCmd, { encoding: 'utf-8', stdio: 'inherit' });
    console.log('Lighthouse completed successfully!');
    
    // Parse result
    const report = JSON.parse(fs.readFileSync('verification_screenshots/step8_lh.json', 'utf-8'));
    console.log('\n--- LIGHTHOUSE MOBILE SCORES ---');
    for (const [key, cat] of Object.entries(report.categories)) {
      console.log(`- ${cat.title}: ${Math.round(cat.score * 100)} / 100`);
    }

    console.log('\n--- CORE WEB VITALS ---');
    const audits = report.audits;
    console.log(`- FCP: ${audits['first-contentful-paint'].displayValue}`);
    console.log(`- LCP: ${audits['largest-contentful-paint'].displayValue}`);
    console.log(`- TBT: ${audits['total-blocking-time'].displayValue}`);
    console.log(`- CLS: ${audits['cumulative-layout-shift'].displayValue}`);
    console.log(`- Speed Index: ${audits['speed-index'].displayValue}`);
  } catch (err) {
    console.error('Lighthouse execution error:', err);
  } finally {
    server.close();
  }
});
