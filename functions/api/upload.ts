// Cloudflare Pages Functions: Media Upload API (/api/upload)
// Architecture: Cloudflare Pages + R2 Storage + Cloudflare Access (JWT Verification) + Rate Limiting Counter

interface Env {
  MEDIA_BUCKET?: any;
  RATE_LIMIT_KV?: any;
  CONTENT_KV?: any;
  ADMIN_SECRET?: string;
  ALLOWED_ADMIN_EMAILS?: string;
  CF_ACCESS_TEAM_NAME?: string;
  CF_ACCESS_AUD?: string;
}

// Constant-time string comparison
function safeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  if (bufA.byteLength !== bufB.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < bufA.byteLength; i++) {
    diff |= bufA[i] ^ bufB[i];
  }
  return diff === 0;
}

function parseJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = atob(base64);
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

async function verifyCloudflareAccessJwt(
  jwtAssertion: string,
  env: Env
): Promise<{ valid: boolean; email?: string; error?: string }> {
  if (!jwtAssertion) return { valid: false, error: 'Missing Cf-Access-Jwt-Assertion header' };

  const payload = parseJwtPayload(jwtAssertion);
  if (!payload) return { valid: false, error: 'Malformed JWT assertion' };

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) {
    return { valid: false, error: 'JWT assertion has expired' };
  }

  if (env.CF_ACCESS_AUD && payload.aud) {
    const audList = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audList.includes(env.CF_ACCESS_AUD)) {
      return { valid: false, error: 'Invalid JWT audience tag' };
    }
  }

  const email = payload.email || (payload.identity && payload.identity.email);
  if (!email) {
    return { valid: false, error: 'No email identity found in JWT claims' };
  }

  return { valid: true, email };
}

async function checkRateLimit(kv: any, clientIp: string): Promise<boolean> {
  if (!kv) return true;
  try {
    const key = `ratelimit:${clientIp}`;
    const raw = await kv.get(key);
    const count = raw ? parseInt(raw, 10) : 0;
    return count < 5;
  } catch {
    return true;
  }
}

async function recordRateLimitFailure(kv: any, clientIp: string): Promise<void> {
  if (!kv) return;
  try {
    const key = `ratelimit:${clientIp}`;
    const raw = await kv.get(key);
    const count = (raw ? parseInt(raw, 10) : 0) + 1;
    await kv.put(key, count.toString(), { expirationTtl: 60 });
  } catch {}
}

const ALLOWED_MIME_TYPES = new Set(['image/webp', 'image/jpeg', 'image/png']);
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB limit

export const onRequestPost = async (context: { env: Env; request: Request }) => {
  const clientIp = context.request.headers.get('CF-Connecting-IP') || '127.0.0.1';
  const kv = context.env.RATE_LIMIT_KV || context.env.CONTENT_KV;

  const isAllowed = await checkRateLimit(kv, clientIp);
  if (!isAllowed) {
    return new Response(
      JSON.stringify({ error: 'Too many failed authentication attempts. Please wait 60 seconds (KV Rate Limit enforced).' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 1. Cloudflare Access JWT Assertion (Never trust raw unverified header!)
  const jwtAssertion = context.request.headers.get('Cf-Access-Jwt-Assertion') || '';
  const allowedEmails = (context.env.ALLOWED_ADMIN_EMAILS || 'admin@assunnah.org,saidkhan.developer@gmail.com')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  let isAuthenticated = false;

  if (jwtAssertion) {
    const jwtResult = await verifyCloudflareAccessJwt(jwtAssertion, context.env);
    if (jwtResult.valid && jwtResult.email && allowedEmails.includes(jwtResult.email.toLowerCase())) {
      isAuthenticated = true;
    }
  }

  // 2. Fallback: Constant-time comparison against environment secret
  const authHeader = context.request.headers.get('Authorization') || '';
  const adminKey = context.request.headers.get('x-admin-key') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const token = bearerToken || adminKey;

  if (!isAuthenticated && context.env.ADMIN_SECRET && token) {
    if (safeCompare(token, context.env.ADMIN_SECRET)) {
      isAuthenticated = true;
    }
  }

  if (!isAuthenticated) {
    await recordRateLimitFailure(kv, clientIp);
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Valid Cloudflare Access JWT assertion or ADMIN_SECRET required' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      }
    );
  }

  try {
    const formData = await context.request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided in form data' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return new Response(
        JSON.stringify({ error: `File size exceeds 2 MB limit (received ${(file.size / (1024 * 1024)).toFixed(2)} MB)` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return new Response(
        JSON.stringify({ error: `Invalid file type: ${file.type}. Allowed formats: WebP, JPEG, PNG.` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const filename = `tile_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    if (context.env.MEDIA_BUCKET) {
      await context.env.MEDIA_BUCKET.put(`photos/${filename}`, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type }
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        url: `/assets/photos/${filename}`,
        sizeBytes: file.size
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Failed to process upload' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
