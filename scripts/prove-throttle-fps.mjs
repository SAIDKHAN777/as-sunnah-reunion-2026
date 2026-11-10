import { spawn } from 'child_process';

async function run() {
  console.log('=== PROOF 1: 4G Network + 4x CPU Throttling Benchmark ===');
  const chromeProc = spawn('google-chrome', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--remote-debugging-port=9230',
    '--user-data-dir=/tmp/ch-throttle-proof',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1200));

  const jsonResp = await fetch('http://127.0.0.1:9230/json');
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

  await new Promise(r => ws.onopen = r);

  await sendCommand('Page.enable');
  await sendCommand('Network.enable');

  // 1. Emulate Regular 4G Profile
  // Latency: 100ms, Download: 4 Mbps, Upload: 3 Mbps
  await sendCommand('Network.emulateNetworkConditions', {
    offline: false,
    latency: 100,
    downloadThroughput: (4 * 1024 * 1024) / 8,
    uploadThroughput: (3 * 1024 * 1024) / 8
  });

  // 2. Emulate 4x CPU Slowdown
  await sendCommand('Emulation.setCPUThrottlingRate', { rate: 4 });

  // 3. Set standard mobile viewport
  await sendCommand('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
    hasTouch: true
  });

  // 4. Inject frame timing instrumentation before document loads
  await sendCommand('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      window.__frameTimings = [];
      let lastTime = performance.now();
      function recordFrame(now) {
        const delta = now - lastTime;
        window.__frameTimings.push(delta);
        lastTime = now;
        if (now < 9500) {
          requestAnimationFrame(recordFrame);
        }
      }
      requestAnimationFrame(recordFrame);
    `
  });

  console.log('Navigating to http://localhost:4321/ under 4G + 4x CPU slowdown...');
  await sendCommand('Page.navigate', { url: 'http://localhost:4321/' });

  // Wait 13 seconds for the full 0-9s intro animation to complete under 4x CPU
  console.log('Recording frame timings across full 0-9s intro timeline...');
  await new Promise(r => setTimeout(r, 13000));

  // Retrieve metrics
  const evalResult = await sendCommand('Runtime.evaluate', {
    expression: `
      (() => {
        const timings = window.__frameTimings || [];
        if (timings.length === 0) return { error: 'No timings recorded' };

        const totalFrames = timings.length;
        const totalDurationMs = timings.reduce((a, b) => a + b, 0);
        const avgFps = totalDurationMs > 0 ? (totalFrames * 1000) / totalDurationMs : 0;

        const sorted = [...timings].sort((a, b) => a - b);
        const minMs = sorted[0];
        const maxMs = sorted[sorted.length - 1];
        const medianMs = sorted[Math.floor(sorted.length * 0.5)];
        const p95Ms = sorted[Math.floor(sorted.length * 0.95)];

        // Long frames: dropped below 30fps (> 33.3ms)
        const longFramesCount = timings.filter(t => t > 33.33).length;
        // Jank frames: dropped below 20fps (> 50ms)
        const jankFramesCount = timings.filter(t => t > 50.0).length;

        return {
          totalFrames,
          totalDurationMs: Math.round(totalDurationMs),
          avgFps: Math.round(avgFps * 10) / 10,
          minMs: Math.round(minMs * 10) / 10,
          maxMs: Math.round(maxMs * 10) / 10,
          medianMs: Math.round(medianMs * 10) / 10,
          p95Ms: Math.round(p95Ms * 10) / 10,
          longFramesCount,
          longFramesPct: Math.round((longFramesCount / totalFrames) * 1000) / 10,
          jankFramesCount,
          jankFramesPct: Math.round((jankFramesCount / totalFrames) * 1000) / 10
        };
      })()
    `,
    returnByValue: true
  });

  const res = evalResult.result.value;
  console.log('\n--- MEASURED BENCHMARK RESULTS ---');
  console.log(`- Profile: Regular 4G (100ms latency, 4 Mbps down) + 4x CPU Throttling`);
  console.log(`- Total Intro Frames Recorded: ${res.totalFrames} frames`);
  console.log(`- Total Intro Duration: ${res.totalDurationMs} ms (${(res.totalDurationMs/1000).toFixed(2)} s)`);
  console.log(`- Average Frame Rate: ${res.avgFps} FPS`);
  console.log(`- Median Frame Interval: ${res.medianMs} ms (Target: 16.7 ms)`);
  console.log(`- 95th Percentile Frame Time: ${res.p95Ms} ms`);
  console.log(`- Min Frame Time: ${res.minMs} ms | Max Frame Time: ${res.maxMs} ms`);
  console.log(`- Long Frames (> 33.3ms, < 30fps): ${res.longFramesCount} frames (${res.longFramesPct}%)`);
  console.log(`- Jank Frames (> 50ms, < 20fps): ${res.jankFramesCount} frames (${res.jankFramesPct}%)`);

  ws.close();
  chromeProc.kill();
}

run().catch(err => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
