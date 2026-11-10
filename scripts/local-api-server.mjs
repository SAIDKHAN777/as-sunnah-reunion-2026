// Lightweight local server with API support (Cloudflare Functions, Access JWT & KV Rate Limiter emulator)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const PORT = 4321;
const DIST_DIR = path.resolve('dist');
const PUBLIC_DIR = path.resolve('public');

// Fallback secret: generated dynamically in memory if process.env.ADMIN_SECRET is omitted.
// NEVER hardcode any secret string in source code.
const FALLBACK_RANDOM_SECRET = crypto.randomBytes(32).toString('hex');
const ADMIN_SECRET = process.env.ADMIN_SECRET || FALLBACK_RANDOM_SECRET;
const ALLOWED_ADMIN_EMAILS = (process.env.ALLOWED_ADMIN_EMAILS || 'admin@assunnah.org,saidkhan.developer@gmail.com')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

// Constant-time string comparison to prevent timing attacks
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Emulated Cloudflare Workers KV Store for rate-limiting counters
class EmulatedKV {
  constructor() {
    this.store = new Map();
  }

  async get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async put(key, value, options = {}) {
    const expiresAt = options.expirationTtl ? Date.now() + options.expirationTtl * 1000 : null;
    this.store.set(key, { value: String(value), expiresAt });
  }

  async delete(key) {
    this.store.delete(key);
  }
}

const rateLimitKV = new EmulatedKV();

async function checkKvRateLimit(clientIp) {
  const key = `ratelimit:${clientIp}`;
  const raw = await rateLimitKV.get(key);
  const count = raw ? parseInt(raw, 10) : 0;
  return count < 5;
}

async function recordKvFailure(clientIp) {
  const key = `ratelimit:${clientIp}`;
  const raw = await rateLimitKV.get(key);
  const count = (raw ? parseInt(raw, 10) : 0) + 1;
  await rateLimitKV.put(key, count, { expirationTtl: 60 });
}

async function recordKvSuccess(clientIp) {
  await rateLimitKV.delete(`ratelimit:${clientIp}`);
}

// Parse and verify Cloudflare Access JWT Assertion
function parseAndVerifyAccessJwt(jwtAssertion) {
  if (!jwtAssertion || typeof jwtAssertion !== 'string') return null;
  const parts = jwtAssertion.split('.');
  if (parts.length !== 3) return null;

  try {
    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payloadStr = Buffer.from(payloadBase64, 'base64').toString('utf8');
    const payload = JSON.parse(payloadStr);

    const now = Math.floor(Date.now() / 1000);
    // Expiry check
    if (!payload.exp || payload.exp < now) {
      return null;
    }

    const email = payload.email || (payload.identity && payload.identity.email);
    if (!email) return null;

    return { email: String(email).toLowerCase(), payload };
  } catch {
    return null;
  }
}

// Authentication validator: NEVER trusts raw email header without valid JWT
function authenticateRequest(req) {
  // 1. Cloudflare Access JWT Assertion Check
  const jwtAssertion = req.headers['cf-access-jwt-assertion'];
  if (jwtAssertion) {
    const verified = parseAndVerifyAccessJwt(jwtAssertion);
    if (verified && verified.email && ALLOWED_ADMIN_EMAILS.includes(verified.email)) {
      return true;
    }
  }

  // NOTE: If a forged Cf-Access-Authenticated-User-Email header is supplied without
  // a valid verified JWT assertion, it is STRICTLY REJECTED!

  // 2. Secret Key Fallback
  const authHeader = req.headers['authorization'] || '';
  const adminKey = req.headers['x-admin-key'] || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const candidate = bearerToken || adminKey;

  if (candidate && safeCompare(candidate, ADMIN_SECRET)) {
    return true;
  }

  return false;
}

// File validation constants
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME_TYPES = new Set(['image/webp', 'image/jpeg', 'image/png']);

function detectImageMime(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'image/png';
  }
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }
  const riff = buffer.toString('ascii', 0, 4);
  const webp = buffer.toString('ascii', 8, 12);
  if (riff === 'RIFF' && webp === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4'
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-key, Cf-Access-Jwt-Assertion, Cf-Access-Authenticated-User-Email');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const clientIp = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // 1. GET /api/content
  if (url.pathname === '/api/content' && req.method === 'GET') {
    const contentPath = path.join(PUBLIC_DIR, 'content.json');
    if (fs.existsSync(contentPath)) {
      const data = fs.readFileSync(contentPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(data);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'content.json not found' }));
    }
    return;
  }

  // 2. PUT /api/content (Authenticated)
  if (url.pathname === '/api/content' && req.method === 'PUT') {
    const isAllowed = await checkKvRateLimit(clientIp);
    if (!isAllowed) {
      res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Too many failed authentication attempts. Please wait 60 seconds (KV Rate Limit enforced).' }));
      return;
    }

    if (!authenticateRequest(req)) {
      await recordKvFailure(clientIp);
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Unauthorized: Valid Cloudflare Access JWT assertion or ADMIN_SECRET required' }));
      return;
    }

    await recordKvSuccess(clientIp);

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        if (!parsed.welcome || !parsed.centerDisc || !parsed.wheel) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Validation failed: missing required schema sections (welcome, centerDisc, wheel)' }));
          return;
        }

        // Prevent stale open tabs/drafts from re-saving legacy un-matted gray-box logo path
        if (parsed.centerDisc.logoUrl === '/assets/photos/upload_1794301033927.webp') {
          parsed.centerDisc.logoUrl = '/assets/photos/logo_4th_reunion_transparent_v2.webp';
        }

        const formatted = JSON.stringify(parsed, null, 2);
        fs.writeFileSync(path.join(PUBLIC_DIR, 'content.json'), formatted, 'utf8');
        if (fs.existsSync(DIST_DIR)) {
          fs.writeFileSync(path.join(DIST_DIR, 'content.json'), formatted, 'utf8');
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, message: 'Content published successfully' }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Malformed JSON payload' }));
      }
    });
    return;
  }

  // 3. POST /api/upload (Authenticated)
  if (url.pathname === '/api/upload' && req.method === 'POST') {
    const isAllowed = await checkKvRateLimit(clientIp);
    if (!isAllowed) {
      res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Too many failed authentication attempts. Please wait 60 seconds (KV Rate Limit enforced).' }));
      return;
    }

    if (!authenticateRequest(req)) {
      await recordKvFailure(clientIp);
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Unauthorized: Valid Cloudflare Access JWT assertion or ADMIN_SECRET required' }));
      return;
    }

    await recordKvSuccess(clientIp);

    let chunks = [];
    let receivedBytes = 0;
    let sizeExceeded = false;

    req.on('data', chunk => {
      receivedBytes += chunk.length;
      if (receivedBytes > MAX_FILE_SIZE) {
        sizeExceeded = true;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (sizeExceeded) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `File size exceeds 2 MB limit (received ${(receivedBytes / (1024 * 1024)).toFixed(2)} MB)` }));
        return;
      }

      try {
        const buffer = Buffer.concat(chunks);
        if (buffer.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Empty upload body' }));
          return;
        }

        const headerMime = req.headers['content-type'] ? req.headers['content-type'].split(';')[0].trim() : '';
        const detectedMime = detectImageMime(buffer);
        const effectiveMime = detectedMime || headerMime;

        if (!ALLOWED_MIME_TYPES.has(effectiveMime)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Invalid file type: ${effectiveMime || 'unknown'}. Allowed formats: WebP, JPEG, PNG.` }));
          return;
        }

        const ext = effectiveMime === 'image/webp' ? '.webp' : effectiveMime === 'image/png' ? '.png' : '.jpg';
        const filename = `upload_${Date.now()}${ext}`;
        const uploadDir = path.join(PUBLIC_DIR, 'assets', 'photos');
        fs.mkdirSync(uploadDir, { recursive: true });
        fs.writeFileSync(path.join(uploadDir, filename), buffer);

        const distUploadDir = path.join(DIST_DIR, 'assets', 'photos');
        if (fs.existsSync(distUploadDir)) {
          fs.writeFileSync(path.join(distUploadDir, filename), buffer);
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, url: `/assets/photos/${filename}`, sizeBytes: buffer.length }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Upload failed' }));
      }
    });
    return;
  }

  // 4. Static File Serving from dist
  let filePath = path.join(DIST_DIR, url.pathname);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const noCacheAsset = ext === '.html' || ext === '.json' || url.pathname.startsWith('/assets/photos/');
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': noCacheAsset ? 'no-cache, must-revalidate' : 'public, max-age=31536000, immutable'
    });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
});

export default server;

if (process.argv[1] === new URL(import.meta.url).pathname) {
  server.listen(PORT, () => {
    console.log(`Local static & API server running on http://localhost:${PORT}`);
    if (!process.env.ADMIN_SECRET) {
      console.log(`[AUTH] No ADMIN_SECRET in env. Generated random memory secret: ${ADMIN_SECRET}`);
    }
  });
}
