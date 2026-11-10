import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  // 1. Visit homepage with ?t=8.5
  await page.goto('http://localhost:4321/?t=8.5', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));

  const initialSubtitle = await page.$eval('.disc-script', el => el.textContent);
  console.log('Initial Disc Subtitle on page:', initialSubtitle);

  // 2. Set draft in localStorage and visit with ?preview=draft&t=8.5
  await page.evaluate(() => {
    const draft = {
      version: 1,
      welcome: { line1: 'WELCOME', line2: 'HOME', finalNumber: 2026 },
      centerDisc: {
        titleRegular: 'AHLAAN',
        titleItalic: 'SAHLAAN',
        scriptSubtitle: 'Special Alumni Gathering 2026',
        dateLine: 'Friday, December 18th',
        scheduleLine1: 'Connect & Grow',
        scheduleLine2: 'As-Sunnah Institute',
        buttonText: 'JOIN NOW',
        buttonUrl: '#register'
      },
      wheel: {
        rotationDurationSec: 45,
        tiles: [
          { id: '1', label: 'GOLDEN MEMORIES', photoUrl: '/assets/photos/photo3.webp' }
        ]
      }
    };
    localStorage.setItem('as_sunnah_admin_content', JSON.stringify(draft));
  });

  await page.goto('http://localhost:4321/?preview=draft&t=8.5', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));

  const updatedSubtitle = await page.$eval('.disc-script', el => el.textContent);
  const updatedChip = await page.$eval('.label-chip span', el => el.textContent);
  const updatedRsvp = await page.$eval('.rsvp-button', el => el.textContent);

  console.log('Preview Subtitle:', updatedSubtitle);
  console.log('Preview Chip:', updatedChip);
  console.log('Preview RSVP:', updatedRsvp);

  if (updatedSubtitle === 'Special Alumni Gathering 2026' &&
      updatedChip === 'GOLDEN MEMORIES' &&
      updatedRsvp === 'JOIN NOW') {
    console.log('PASS: Headless Chrome verifies public site updates dynamically from draft & API!');
  } else {
    console.error('FAIL: Dynamic DOM update did not match draft');
    process.exit(1);
  }

  // Clear test draft
  await page.evaluate(() => localStorage.removeItem('as_sunnah_admin_content'));
  await browser.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
