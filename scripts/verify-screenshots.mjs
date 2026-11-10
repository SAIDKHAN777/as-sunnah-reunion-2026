import puppeteer from 'puppeteer-core';
import http from 'http';
import fs from 'fs';
import path from 'path';

const DIST_DIR = '/home/saidkhan/Foundetion/dist';
const OUT_DIR = '/home/saidkhan/Foundetion/verification_screenshots';
fs.mkdirSync(OUT_DIR, { recursive: true });

// Simple HTTP static server
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

server.listen(4321, async () => {
  console.log('Static server listening on http://127.0.0.1:4321');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const timestamps = [0.5, 1.4, 2.0, 3.0, 4.6, 5.3, 5.7, 6.5, 7.4, 8.5];

  for (const t of timestamps) {
    const page = await browser.newPage();
    await page.setViewport({ width: 720, height: 1280, deviceScaleFactor: 1 });

    // Inject time override or wait exact delay
    await page.goto('http://127.0.0.1:4321', { waitUntil: 'networkidle0' });
    
    // Wait until time t has elapsed since navigation
    await new Promise(r => setTimeout(r, t * 1000));

    const outPath = path.join(OUT_DIR, `site_t_${t}.png`);
    await page.screenshot({ path: outPath });
    console.log(`Captured screenshot at t=${t}s: ${outPath}`);
    await page.close();
  }

  await browser.close();
  server.close();
  console.log('Verification run complete!');
});
