import { spawn } from 'child_process';

const TEST_SECRET = process.env.ADMIN_SECRET || 'env_test_secret_key_9876543210';

async function run() {
  console.log('=== PROOF 5: Admin Unauthenticated Write Protection & Live Public Page Propagation ===');

  // 1. Test Unauthenticated PUT Request
  console.log('\n--- Step 5A: Testing Unauthenticated PUT Request ---');
  const unauthRes = await fetch('http://localhost:4321/api/content', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ maliciousPayload: true })
  });

  const unauthStatus = unauthRes.status;
  const unauthBody = await unauthRes.json();
  console.log(`- Request: PUT /api/content (No Authorization header)`);
  console.log(`- HTTP Response Status: ${unauthStatus} (Expected: 401)`);
  console.log(`- Response Payload:`, unauthBody);

  if (unauthStatus !== 401) {
    console.error('FAIL: Unauthenticated write was not rejected with 401!');
    process.exit(1);
  }
  console.log('>>> Unauthenticated Protection: PASSED (HTTP 401 Unauthorized confirmed)');

  // 2. Test Authenticated PUT Request
  console.log('\n--- Step 5B: Testing Authenticated PUT Request ---');
  const getOrig = await fetch('http://localhost:4321/api/content');
  const origContent = await getOrig.json();

  const newSubtitle = 'Grand Alumni Reunion 2026';
  const newTileLabel = 'BROTHERS 2026';
  const newTilePhoto = '/assets/photos/photo5.webp';

  const modifiedContent = JSON.parse(JSON.stringify(origContent));
  modifiedContent.centerDisc.scriptSubtitle = newSubtitle;
  modifiedContent.wheel.tiles[0].label = newTileLabel;
  modifiedContent.wheel.tiles[0].photoUrl = newTilePhoto;

  const authRes = await fetch('http://localhost:4321/api/content', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TEST_SECRET}`,
      'x-admin-key': TEST_SECRET
    },
    body: JSON.stringify(modifiedContent)
  });

  const authStatus = authRes.status;
  const authBody = await authRes.json();
  console.log(`- Request: PUT /api/content (With Bearer ADMIN_SECRET)`);
  console.log(`- HTTP Response Status: ${authStatus} (Expected: 200)`);
  console.log(`- Response Payload:`, authBody);

  if (authStatus !== 200) {
    console.error('FAIL: Authenticated write failed!');
    process.exit(1);
  }

  // 3. Verify Live Public Page DOM in Chrome
  console.log('\n--- Step 5C: Verifying Live Public Page DOM in Chrome ---');
  const chromeProc = spawn('google-chrome', [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--remote-debugging-port=9235',
    '--user-data-dir=/tmp/ch-proof5',
    'http://localhost:4321/?t=8.5'
  ]);

  await new Promise(r => setTimeout(r, 1200));

  const jsonResp = await fetch('http://127.0.0.1:9235/json');
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
  await new Promise(r => setTimeout(r, 1500));

  const domCheck = await sendCommand('Runtime.evaluate', {
    expression: `
      (() => {
        const subtitleEl = document.querySelector('.disc-script');
        const chipLabelEl = document.querySelector('.label-chip span');
        const tileImgEl = document.querySelector('.tile-img');

        return {
          domSubtitle: subtitleEl ? subtitleEl.textContent : '',
          domTileLabel: chipLabelEl ? chipLabelEl.textContent : '',
          domTilePhotoSrc: tileImgEl ? tileImgEl.getAttribute('src') || tileImgEl.src : ''
        };
      })()
    `,
    returnByValue: true
  });

  const dom = domCheck.result.value;
  console.log(`- Extracted DOM Subtitle: "${dom.domSubtitle}" (Expected: "${newSubtitle}")`);
  console.log(`- Extracted DOM Tile Label: "${dom.domTileLabel}" (Expected: "${newTileLabel}")`);
  console.log(`- Extracted DOM Tile Photo: "${dom.domTilePhotoSrc}" (Expected: "${newTilePhoto}")`);

  const subtitleMatch = dom.domSubtitle === newSubtitle;
  const labelMatch = dom.domTileLabel === newTileLabel;
  const photoMatch = dom.domTilePhotoSrc.includes(newTilePhoto);

  console.log(`- Subtitle Match: ${subtitleMatch}`);
  console.log(`- Tile Label Match: ${labelMatch}`);
  console.log(`- Tile Photo Match: ${photoMatch}`);

  ws.close();
  chromeProc.kill();

  // 4. Revert back to original defaults
  console.log('\n--- Step 5D: Reverting back to original defaults ---');
  await fetch('http://localhost:4321/api/content', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TEST_SECRET}`,
      'x-admin-key': TEST_SECRET
    },
    body: JSON.stringify(origContent)
  });
  console.log('Defaults successfully restored.');

  if (subtitleMatch && labelMatch && photoMatch) {
    console.log('\n>>> Item 5 Result: ALL CHECKS PASSED (Unauthenticated write blocked 401, changed text & photo verified live on public page).');
  } else {
    console.error('FAIL: DOM did not reflect changed content.');
    process.exit(1);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
