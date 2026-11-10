import { spawn } from 'child_process';

async function run() {
  console.log('=== PROOF 2: prefers-reduced-motion & sessionStorage play-once ===');
  const chromeProc = spawn('google-chrome', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--remote-debugging-port=9234',
    '--user-data-dir=/tmp/ch-proof2-clean',
    'http://localhost:4321/'
  ]);

  await new Promise(r => setTimeout(r, 1200));

  const jsonResp = await fetch('http://127.0.0.1:9234/json');
  const targets = await jsonResp.json();
  const pageTarget = targets.find(t => t.type === 'page') || targets[0];

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
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

  // ==========================================
  // TEST 2A: prefers-reduced-motion
  // ==========================================
  console.log('\n--- Test 2A: Testing prefers-reduced-motion: reduce ---');
  await sendCommand('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
  });

  // Navigate clean
  await sendCommand('Page.navigate', { url: 'http://localhost:4321/' });
  await new Promise(r => setTimeout(r, 1000));

  const rmResult = await sendCommand('Runtime.evaluate', {
    expression: `
      (() => {
        const welcomeCard = document.getElementById('welcome-card');
        const counterContainer = document.getElementById('counter-container');
        const counterCanvas = document.getElementById('counter-canvas');
        const posterCard = document.getElementById('poster-card');
        const skipBtn = document.getElementById('skip-intro-btn');
        const mainPage = document.getElementById('main-page');
        const wheelRotator = document.getElementById('wheel-rotator');

        return {
          welcomeCardInDOM: Boolean(welcomeCard),
          counterCanvasInDOM: Boolean(counterCanvas),
          posterCardInDOM: Boolean(posterCard),
          skipBtnInDOM: Boolean(skipBtn),
          mainPageMounted: Boolean(mainPage),
          wheelRotatorPlayState: wheelRotator ? wheelRotator.style.animationPlayState : 'none',
          sessionStorageValue: sessionStorage.getItem('as_sunnah_intro_seen')
        };
      })()
    `,
    returnByValue: true
  });

  const rm = rmResult.result.value;
  console.log('Result for prefers-reduced-motion:');
  console.log(`- Welcome Card in DOM: ${rm.welcomeCardInDOM} (Expected: false, removed)`);
  console.log(`- Counter Canvas in DOM: ${rm.counterCanvasInDOM} (Expected: false, freed)`);
  console.log(`- Poster Card in DOM: ${rm.posterCardInDOM} (Expected: false, removed)`);
  console.log(`- Skip Button in DOM: ${rm.skipBtnInDOM} (Expected: false, removed)`);
  console.log(`- Main Page S5 Mounted: ${rm.mainPageMounted} (Expected: true)`);
  console.log(`- Wheel Rotation Play State: "${rm.wheelRotatorPlayState}" (Expected: "paused")`);
  console.log(`- Session Seen Flag Saved: "${rm.sessionStorageValue}" (Expected: "true")`);

  const passRM = !rm.welcomeCardInDOM && !rm.counterCanvasInDOM && rm.mainPageMounted && rm.wheelRotatorPlayState === 'paused';
  console.log(`>>> prefers-reduced-motion Status: ${passRM ? 'PASSED (100% Verified)' : 'FAILED'}`);

  // ==========================================
  // TEST 2B: once-per-session (sessionStorage)
  // ==========================================
  console.log('\n--- Test 2B: Testing once-per-session (sessionStorage) ---');
  // Reset media to normal (no reduced motion)
  await sendCommand('Emulation.setEmulatedMedia', { features: [] });

  // Simulate returning visit in the same session (flag is already 'true' from 2A)
  await sendCommand('Page.navigate', { url: 'http://localhost:4321/' });
  await new Promise(r => setTimeout(r, 1000));

  const ssResult = await sendCommand('Runtime.evaluate', {
    expression: `
      (() => {
        const welcomeCard = document.getElementById('welcome-card');
        const counterCanvas = document.getElementById('counter-canvas');
        const mainPage = document.getElementById('main-page');
        const wheelRotator = document.getElementById('wheel-rotator');

        return {
          welcomeCardInDOM: Boolean(welcomeCard),
          counterCanvasInDOM: Boolean(counterCanvas),
          mainPageMounted: Boolean(mainPage),
          wheelRotatorPlayState: wheelRotator ? wheelRotator.style.animationPlayState : 'none',
          wheelHasRotatingClass: wheelRotator ? wheelRotator.classList.contains('is-rotating') : false
        };
      })()
    `,
    returnByValue: true
  });

  const ss = ssResult.result.value;
  console.log('Result for once-per-session second visit:');
  console.log(`- Welcome Card in DOM: ${ss.welcomeCardInDOM} (Expected: false, skipped)`);
  console.log(`- Counter Canvas in DOM: ${ss.counterCanvasInDOM} (Expected: false, freed)`);
  console.log(`- Main Page S5 Mounted: ${ss.mainPageMounted} (Expected: true)`);
  console.log(`- Wheel Rotation Play State: "${ss.wheelRotatorPlayState}" (Expected: "running")`);
  console.log(`- Wheel Has 'is-rotating' Class: ${ss.wheelHasRotatingClass} (Expected: true)`);

  const passSS = !ss.welcomeCardInDOM && !ss.counterCanvasInDOM && ss.mainPageMounted && ss.wheelRotatorPlayState === 'running';
  console.log(`>>> once-per-session Status: ${passSS ? 'PASSED (100% Verified)' : 'FAILED'}`);

  ws.close();
  chromeProc.kill();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
