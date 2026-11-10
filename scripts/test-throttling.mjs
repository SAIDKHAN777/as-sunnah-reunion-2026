import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const DIST_DIR = '/home/saidkhan/Foundetion/dist';
const PORT = 4353;

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

server.listen(PORT, async () => {
  console.log(`Test server running at http://127.0.0.1:${PORT}`);

  const chromeProc = spawn('google-chrome', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--remote-debugging-port=9224',
    '--user-data-dir=/tmp/ch-throttle-test2',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1200));

  const jsonResp = await fetch('http://127.0.0.1:9224/json');
  const targets = await jsonResp.json();
  const wsUrl = targets[0].webSocketDebuggerUrl;

  const ws = new WebSocket(wsUrl);

  let idCounter = 1;
  const pending = new Map();

  function sendCommand(method, params = {}) {
    return new Promise((resolve) => {
      const id = idCounter++;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const resolve = pending.get(msg.id);
      pending.delete(msg.id);
      resolve(msg.result);
    }
  };

  await new Promise((resolve) => (ws.onopen = resolve));

  await sendCommand('Runtime.enable');
  await sendCommand('Page.enable');

  // 1. Enable 4x CPU Throttling
  console.log('Enabling 4x CPU slowdown (rate: 4)...');
  await sendCommand('Emulation.setCPUThrottlingRate', { rate: 4 });

  await sendCommand('Emulation.setDeviceMetricsOverride', {
    width: 360,
    height: 800,
    deviceScaleFactor: 1,
    mobile: true
  });

  // Navigate to index
  console.log('Navigating to http://127.0.0.1:' + PORT + '...');
  await sendCommand('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });

  // Wait for page to load and animation to run
  await new Promise(r => setTimeout(r, 3500));

  // Run in-page benchmark of 60 animation frames
  const benchmarkResult = await sendCommand('Runtime.evaluate', {
    expression: `
      new Promise((resolve) => {
        const deltas = [];
        let prev = performance.now();
        let count = 0;
        function frame(now) {
          const d = now - prev;
          prev = now;
          deltas.push(d);
          count++;
          if (count < 60) {
            requestAnimationFrame(frame);
          } else {
            resolve(JSON.stringify(deltas));
          }
        }
        requestAnimationFrame(frame);
      })
    `,
    awaitPromise: true,
    returnByValue: true
  });

  const rawDurations = JSON.parse(benchmarkResult.result.value || '[]');
  const frames = rawDurations.slice(1); // skip initial delta

  if (frames.length > 0) {
    const avgDuration = frames.reduce((a, b) => a + b, 0) / frames.length;
    const maxDuration = Math.max(...frames);
    const minDuration = Math.min(...frames);
    const droppedFrames = frames.filter(d => d > 33.3).length;
    const fps = 1000 / avgDuration;

    console.log('====================================================');
    console.log(`4x CPU THROTTLING TEST RESULTS (${frames.length} frames measured):`);
    console.log(`- Average Frame Time: ${avgDuration.toFixed(2)} ms (~${fps.toFixed(1)} FPS)`);
    console.log(`- Min Frame Time:     ${minDuration.toFixed(2)} ms`);
    console.log(`- Max Frame Time:     ${maxDuration.toFixed(2)} ms`);
    console.log(`- Dropped Frames (>33.3ms): ${droppedFrames} of ${frames.length} (${((droppedFrames / frames.length) * 100).toFixed(1)}%)`);
    console.log('====================================================');
  } else {
    console.log('No frame measurements collected.');
  }

  ws.close();
  chromeProc.kill();
  server.close();
  process.exit(0);
});
