import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const OUT_DIR = path.resolve('verification_screenshots/step10');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function run() {
  const chromeProc = spawn('google-chrome', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--remote-debugging-port=9227',
    '--user-data-dir=/tmp/ch-qa-matrix2',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1200));

  const jsonResp = await fetch('http://127.0.0.1:9227/json');
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

  console.log('--- 1. Testing 4G Network & 4x CPU Throttling ---');
  // Regular 4G Profile: 100ms latency, 4 Mbps down, 3 Mbps up
  await sendCommand('Network.emulateNetworkConditions', {
    offline: false,
    latency: 100,
    downloadThroughput: (4 * 1024 * 1024) / 8,
    uploadThroughput: (3 * 1024 * 1024) / 8
  });
  // 4x CPU Throttling
  await sendCommand('Emulation.setCPUThrottlingRate', { rate: 4 });

  // Navigate to live site
  const startNav = Date.now();
  await sendCommand('Page.navigate', { url: 'http://localhost:4321/' });
  await new Promise(r => setTimeout(r, 1500));
  const navDuration = Date.now() - startNav;
  console.log(`4G + 4x CPU navigation & boot time: ${navDuration}ms`);

  // Reset throttling for viewport testing
  await sendCommand('Emulation.setCPUThrottlingRate', { rate: 1 });
  await sendCommand('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  });

  console.log('\n--- 2. Testing Viewport Widths (360px, 390px, 430px) ---');
  const viewports = [
    { name: 'android_360', width: 360, height: 640 },
    { name: 'iphone_390', width: 390, height: 844 },
    { name: 'iphone_promax_430', width: 430, height: 932 }
  ];

  for (const vp of viewports) {
    await sendCommand('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 2,
      mobile: true,
      hasTouch: true
    });
    await sendCommand('Page.navigate', { url: `http://localhost:4321/?t=8.5` });
    await new Promise(r => setTimeout(r, 800));

    // Verify horizontal scroll is exactly 0
    const scrollCheck = await sendCommand('Runtime.evaluate', {
      expression: 'document.documentElement.scrollWidth <= window.innerWidth && document.body.scrollWidth <= window.innerWidth'
    });
    console.log(`Viewport ${vp.width}x${vp.height} (${vp.name}): Horizontal scroll 0 = ${scrollCheck.value}`);

    const snap = await sendCommand('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT_DIR, `viewport_${vp.name}_8.5s.png`), Buffer.from(snap.data, 'base64'));
    console.log(`Saved screenshot -> viewport_${vp.name}_8.5s.png`);
  }

  console.log('\n--- 3. Testing prefers-reduced-motion ---');
  await sendCommand('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
  });
  await sendCommand('Page.navigate', { url: 'http://localhost:4321/' });
  await new Promise(r => setTimeout(r, 600));

  const reducedMotionState = await sendCommand('Runtime.evaluate', {
    expression: `
      ({
        welcomeCardPresent: Boolean(document.getElementById('welcome-card')),
        counterCanvasPresent: Boolean(document.getElementById('counter-canvas')),
        wheelPresent: Boolean(document.getElementById('main-page')),
        rotationPlayState: document.getElementById('wheel-rotator')?.style.animationPlayState
      })
    `
  });
  console.log('Reduced motion check:', reducedMotionState.value);

  const snapReduced = await sendCommand('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT_DIR, 'reduced_motion_screen.png'), Buffer.from(snapReduced.data, 'base64'));
  console.log('Saved reduced_motion_screen.png');

  console.log('\n--- 4. Testing sessionStorage Play-Once ---');
  // Clear reduced motion
  await sendCommand('Emulation.setEmulatedMedia', { features: [] });
  await sendCommand('Runtime.evaluate', {
    expression: 'sessionStorage.setItem("as_sunnah_intro_seen", "true")'
  });
  await sendCommand('Page.navigate', { url: 'http://localhost:4321/' });
  await new Promise(r => setTimeout(r, 600));

  const sessionSeenState = await sendCommand('Runtime.evaluate', {
    expression: `
      ({
        introSkipped: !document.getElementById('welcome-card'),
        mainPageVisible: Boolean(document.getElementById('main-page'))
      })
    `
  });
  console.log('Session play-once check:', sessionSeenState.value);

  ws.close();
  chromeProc.kill();
  console.log('\nQA Matrix execution completed successfully!');
}

run().catch(console.error);
