// Step 10D: Security verification test suite for Cloudflare Access JWT validation & KV Rate Limiting
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'http://localhost:4321';
const VALID_SECRET = process.env.ADMIN_SECRET || 'test_admin_secret_fixture';
const WRONG_SECRET = 'invalid_secret_key_random_guess';
const CF_OWNER_EMAIL = 'saidkhan.developer@gmail.com';
const CF_UNAUTHORIZED_EMAIL = 'attacker@evil.org';

// Helper to generate test JWT assertion
function createTestJwt(email, expInSeconds = 3600) {
  const header = { alg: 'RS256', typ: 'JWT', kid: 'cf-access-key-1' };
  const payload = {
    iss: 'https://as-sunnah.cloudflareaccess.com',
    aud: 'as-sunnah-admin-aud-tag',
    email: email,
    identity: { email: email },
    exp: Math.floor(Date.now() / 1000) + expInSeconds
  };
  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const b64Signature = Buffer.from('mock_test_rsa_signature_token').toString('base64url');
  return `${b64Header}.${b64Payload}.${b64Signature}`;
}

async function runTests() {
  console.log('========================================================================');
  console.log('STEP 10D PART B: CLOUDFLARE ACCESS JWT & KV RATE-LIMIT SECURITY TESTS');
  console.log('========================================================================\n');

  let passedCount = 0;
  let totalCount = 0;

  function assert(condition, testName, details = '') {
    totalCount++;
    if (condition) {
      passedCount++;
      console.log(`[PASS] Test ${totalCount}: ${testName} ${details ? '(' + details + ')' : ''}`);
    } else {
      console.error(`[FAIL] Test ${totalCount}: ${testName} ${details ? '(' + details + ')' : ''}`);
      process.exit(1);
    }
  }

  const getRes = await fetch(`${BASE_URL}/api/content`);
  const validContent = await getRes.json();

  console.log('--- PHASE 1: JWT Verification & Forgery Attack Prevention ---');

  // Test 1: Forged Cf-Access-Authenticated-User-Email with NO JWT assertion -> MUST return 401
  const res1 = await fetch(`${BASE_URL}/api/content`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cf-Access-Authenticated-User-Email': CF_OWNER_EMAIL,
      'x-forwarded-for': '198.51.100.1'
    },
    body: JSON.stringify(validContent)
  });
  assert(res1.status === 401, 'Forged Cf-Access-Authenticated-User-Email header with NO JWT returns 401', `Status: ${res1.status}`);

  // Test 2: Forged Cf-Access-Authenticated-User-Email with MALFORMED JWT assertion -> MUST return 401
  const res2 = await fetch(`${BASE_URL}/api/content`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cf-Access-Authenticated-User-Email': CF_OWNER_EMAIL,
      'Cf-Access-Jwt-Assertion': 'fake.invalid-jwt-token.xyz',
      'x-forwarded-for': '198.51.100.2'
    },
    body: JSON.stringify(validContent)
  });
  assert(res2.status === 401, 'Forged email with malformed JWT assertion returns 401', `Status: ${res2.status}`);

  // Test 3: Forged email with EXPIRED JWT assertion -> MUST return 401
  const expiredJwt = createTestJwt(CF_OWNER_EMAIL, -3600); // expired 1 hour ago
  const res3 = await fetch(`${BASE_URL}/api/content`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cf-Access-Jwt-Assertion': expiredJwt,
      'x-forwarded-for': '198.51.100.3'
    },
    body: JSON.stringify(validContent)
  });
  assert(res3.status === 401, 'Expired JWT assertion returns 401', `Status: ${res3.status}`);

  // Test 4: Valid JWT with unauthorized email not in allowlist -> MUST return 401
  const unauthJwt = createTestJwt(CF_UNAUTHORIZED_EMAIL, 3600);
  const res4 = await fetch(`${BASE_URL}/api/content`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cf-Access-Jwt-Assertion': unauthJwt,
      'x-forwarded-for': '198.51.100.4'
    },
    body: JSON.stringify(validContent)
  });
  assert(res4.status === 401, 'Valid JWT with non-whitelisted email returns 401', `Status: ${res4.status}`);

  // Test 5: Valid JWT with whitelisted owner email -> MUST return 200
  const validJwt = createTestJwt(CF_OWNER_EMAIL, 3600);
  const res5 = await fetch(`${BASE_URL}/api/content`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cf-Access-Jwt-Assertion': validJwt,
      'x-forwarded-for': '198.51.100.5'
    },
    body: JSON.stringify(validContent)
  });
  assert(res5.status === 200, 'Valid JWT assertion with whitelisted email returns 200 OK', `Status: ${res5.status}`);

  console.log('\n--- PHASE 2: Secret Key Fallback (Constant-Time Verification) ---');
  // Test 6: Wrong secret key -> 401
  const res6 = await fetch(`${BASE_URL}/api/content`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${WRONG_SECRET}`,
      'x-forwarded-for': '198.51.100.6'
    },
    body: JSON.stringify(validContent)
  });
  assert(res6.status === 401, 'Wrong Bearer token returns 401', `Status: ${res6.status}`);

  // Test 7: Valid secret key -> 200
  const res7 = await fetch(`${BASE_URL}/api/content`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${VALID_SECRET}`,
      'x-forwarded-for': '198.51.100.7'
    },
    body: JSON.stringify(validContent)
  });
  assert(res7.status === 200, 'Valid secret key returns 200 OK', `Status: ${res7.status}`);

  console.log('\n--- PHASE 3: Upload Validation & Access Protection ---');
  // Test 8: Upload with forged email header & no JWT -> 401
  const dummyWebp = Buffer.from('RIFF\x14\x00\x00\x00WEBPVP8 \x08\x00\x00\x00\x30\x01\x00\x9d\x01\x2a\x01\x00\x01\x00', 'binary');
  const res8 = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'image/webp',
      'Cf-Access-Authenticated-User-Email': CF_OWNER_EMAIL,
      'x-forwarded-for': '198.51.100.8'
    },
    body: dummyWebp
  });
  assert(res8.status === 401, 'POST /api/upload with forged email header returns 401', `Status: ${res8.status}`);

  // Test 9: Upload with valid JWT assertion -> 200 OK
  const res9 = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'image/webp',
      'Cf-Access-Jwt-Assertion': validJwt,
      'x-forwarded-for': '198.51.100.9'
    },
    body: dummyWebp
  });
  assert(res9.status === 200, 'POST /api/upload with valid JWT assertion returns 200 OK', `Status: ${res9.status}`);

  // Test 10: Upload file > 2 MB with valid auth -> 400
  const largeBuffer = Buffer.alloc(2.5 * 1024 * 1024, 0); // 2.5 MB
  const res10 = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'image/webp',
      'Authorization': `Bearer ${VALID_SECRET}`,
      'x-forwarded-for': '198.51.100.10'
    },
    body: largeBuffer
  });
  assert(res10.status === 400, 'POST /api/upload with file > 2 MB returns 400 Bad Request', `Status: ${res10.status}`);

  // Test 11: Upload invalid MIME (e.g. exe/binary) -> 400
  const invalidTypeBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00This is an executable payload');
  const res11 = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-msdownload',
      'Authorization': `Bearer ${VALID_SECRET}`,
      'x-forwarded-for': '198.51.100.11'
    },
    body: invalidTypeBuffer
  });
  assert(res11.status === 400, 'POST /api/upload with invalid MIME returns 400 Bad Request', `Status: ${res11.status}`);

  console.log('\n--- PHASE 4: Cloudflare KV-Backed Rate Limiting (429 Enforcement) ---');
  const bruteForceIp = '203.0.113.123';
  for (let i = 1; i <= 5; i++) {
    const res = await fetch(`${BASE_URL}/api/content`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer attack_${i}`,
        'x-forwarded-for': bruteForceIp
      },
      body: '{}'
    });
    assert(res.status === 401, `Failed attempt ${i} returns 401 Unauthorized`);
  }

  // 6th attempt must be rejected with 429 Too Many Requests
  const res12 = await fetch(`${BASE_URL}/api/content`, {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer attack_6',
      'x-forwarded-for': bruteForceIp
    },
    body: '{}'
  });
  assert(res12.status === 429, '6th failed attempt rejected with 429 Too Many Requests (KV Rate Limit)', `Status: ${res12.status}`);

  console.log('\n========================================================================');
  console.log(`ALL ${totalCount} HARDENED SECURITY TESTS PASSED! (${passedCount}/${totalCount})`);
  console.log('========================================================================\n');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
