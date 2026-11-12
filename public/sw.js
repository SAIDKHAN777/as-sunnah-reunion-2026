/* Service Worker for As-Sunnah Reunion 2026
 * Caches core shell, fonts, wheel photos, lazy map chunks, and supports
 * HTTP 206 byte-range requests for self-hosted PMTiles archives offline.
 */

const CACHE_NAME = 'as-sunnah-map-v1';
const PRECACHE_URLS = /*__PRECACHE_MANIFEST__*/ ['/', '/index.html', '/content.json'];

function isPmtilesRequest(url) {
  return url.origin === self.location.origin && url.pathname.endsWith('.pmtiles');
}

function isImmutableAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/_astro/') ||
      url.pathname.startsWith('/fonts/') ||
      url.pathname.startsWith('/tiles/fonts/') ||
      url.pathname.startsWith('/assets/'))
  );
}

/**
 * Slices a cached full 200 OK archive Response into an HTTP 206 Partial Content response
 * matching RFC 9110 single byte-range headers emitted by PMTiles clients.
 */
async function createRangeResponse(cached200, rangeHeader) {
  if (!rangeHeader || !rangeHeader.startsWith('bytes=')) {
    return cached200.clone();
  }

  const blob = await cached200.blob();
  const total = blob.size;
  const spec = rangeHeader.replace(/^bytes=/i, '').split(',')[0].trim();
  const parts = spec.split('-');
  if (parts.length !== 2) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${total}` },
    });
  }

  let start;
  let end;

  if (parts[0] === '') {
    const suffixLen = Number(parts[1]);
    if (!Number.isFinite(suffixLen) || suffixLen <= 0) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
    }
    start = Math.max(0, total - suffixLen);
    end = total - 1;
  } else {
    start = Number(parts[0]);
    end = parts[1] === '' ? total - 1 : Math.min(total - 1, Number(parts[1]));
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || start >= total) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${total}` },
    });
  }

  const slice = blob.slice(start, end + 1);
  return new Response(slice, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': cached200.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Content-Length': String(slice.size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=604800',
    },
  });
}

async function handlePmtilesFetch(event, url) {
  const cache = await caches.open(CACHE_NAME);
  const cleanKey = new Request(url.origin + url.pathname);
  const rangeHeader = event.request.headers.get('range');

  const cachedFull = await cache.match(cleanKey);
  if (cachedFull && cachedFull.status === 200) {
    return createRangeResponse(cachedFull, rangeHeader);
  }

  // Warm the full 200 OK archive in background so future offline Range requests succeed.
  event.waitUntil(
    fetch(cleanKey)
      .then((res) => {
        if (res && res.status === 200) {
          return cache.put(cleanKey, res.clone());
        }
        return undefined;
      })
      .catch(() => undefined)
  );

  try {
    const networkRes = await fetch(event.request);
    if (!rangeHeader && networkRes.status === 200) {
      await cache.put(cleanKey, networkRes.clone());
    }
    return networkRes;
  } catch {
    return new Response('PMTiles archive unavailable offline', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const uniqueUrls = Array.from(new Set(PRECACHE_URLS));
      await Promise.allSettled(
        uniqueUrls.map(async (itemUrl) => {
          const req = new Request(itemUrl, { cache: 'reload' });
          const res = await fetch(req);
          if (res && res.status === 200) {
            await cache.put(itemUrl, res);
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return undefined;
        })
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Skip admin routes cleanly so admin assets stay outside offline public shell
  if (
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/map-admin') ||
    url.pathname.startsWith('/map-picker')
  ) {
    return;
  }

  // 1. PMTiles archives + HTTP Range 206 support
  if (isPmtilesRequest(url)) {
    event.respondWith(handlePmtilesFetch(event, url));
    return;
  }

  // 2. HTML navigations (including /?t=09:00): Network-first with offline index fallback
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const netRes = await fetch(event.request);
          if (netRes && netRes.status === 200 && url.pathname === '/') {
            cache.put('/', netRes.clone()).catch(() => {});
          }
          return netRes;
        } catch {
          return (
            (await cache.match('/index.html')) ||
            (await cache.match('/')) ||
            new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
          );
        }
      })()
    );
    return;
  }

  // 3. Immutable hashed scripts/styles, fonts & static assets: Cache-first + background populate
  if (isImmutableAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(url.pathname);
        if (cached) return cached;
        try {
          const netRes = await fetch(event.request);
          if (netRes && netRes.status === 200) {
            cache.put(url.pathname, netRes.clone()).catch(() => {});
          }
          return netRes;
        } catch {
          return new Response('', { status: 504, statusText: 'Offline asset missing' });
        }
      })()
    );
    return;
  }

  // 4. Dynamic content.json & remaining same-origin files: Network-first with cache fallback
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const netRes = await fetch(event.request);
        if (netRes && netRes.status === 200) {
          cache.put(url.pathname, netRes.clone()).catch(() => {});
        }
        return netRes;
      } catch {
        return (
          (await cache.match(url.pathname)) ||
          new Response('', { status: 504, statusText: 'Offline' })
        );
      }
    })()
  );
});
