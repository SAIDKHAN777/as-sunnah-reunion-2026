import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const OUTPUT_DIR = path.resolve('verification_screenshots/step9');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function main() {
  const chromeProc = spawn('google-chrome', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--remote-debugging-port=9225',
    '--user-data-dir=/tmp/ch-admin-screenshots',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1200));

  const jsonResp = await fetch('http://127.0.0.1:9225/json');
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
  await sendCommand('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
    hasTouch: true
  });

  // Navigate to /admin
  await sendCommand('Page.navigate', { url: 'http://localhost:4321/admin' });
  await new Promise(r => setTimeout(r, 1500));

  // Screenshot 1: Tab 1 - Wheel & Tiles
  const snap1 = await sendCommand('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUTPUT_DIR, 'admin_390px_tab1_wheel.png'), Buffer.from(snap1.data, 'base64'));
  console.log('Saved admin_390px_tab1_wheel.png');

  // Click on Tab 2: Center Disc
  await sendCommand('Runtime.evaluate', {
    expression: 'document.querySelector("[data-tab=\\"tab-center\\"]").click()'
  });
  await new Promise(r => setTimeout(r, 500));

  const snap2 = await sendCommand('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUTPUT_DIR, 'admin_390px_tab2_center.png'), Buffer.from(snap2.data, 'base64'));
  console.log('Saved admin_390px_tab2_center.png');

  // Click on Tab 3: Intro & Cards
  await sendCommand('Runtime.evaluate', {
    expression: 'document.querySelector("[data-tab=\\"tab-intro\\"]").click()'
  });
  await new Promise(r => setTimeout(r, 500));

  const snap3 = await sendCommand('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUTPUT_DIR, 'admin_390px_tab3_intro.png'), Buffer.from(snap3.data, 'base64'));
  console.log('Saved admin_390px_tab3_intro.png');

  // Open Auth modal
  await sendCommand('Runtime.evaluate', {
    expression: 'document.getElementById("auth-status-btn").click()'
  });
  await new Promise(r => setTimeout(r, 500));

  const snap4 = await sendCommand('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUTPUT_DIR, 'admin_390px_auth_modal.png'), Buffer.from(snap4.data, 'base64'));
  console.log('Saved admin_390px_auth_modal.png');

  ws.close();
  chromeProc.kill();
  console.log('All admin screenshots captured successfully!');
}

main().catch(console.error);
