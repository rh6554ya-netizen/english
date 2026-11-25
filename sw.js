/* EchoSpeak Service Worker — App Shell + Offline Survival & Lesson MP3 Cache */
const CACHE_VERSION = '051db8e2ae';
const SHELL_CACHE = `echospeak-shell-${CACHE_VERSION}`;
const AUDIO_CACHE = 'echospeak-audio-v1';
const FONTS_CACHE = 'echospeak-fonts-v1';

// Replaced at production build time by echoSpeakPwaPlugin in vite.config.ts
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/apple-touch-icon.png",
  "./icons/favicon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./assets/index-BTux5irV.js",
  "./assets/index-DFvg2aXt.css"
];
const SURVIVAL_AUDIO_ASSETS = [
  "./audio/survival/surv-10_normal.mp3",
  "./audio/survival/surv-10_slow.mp3",
  "./audio/survival/surv-11_normal.mp3",
  "./audio/survival/surv-11_slow.mp3",
  "./audio/survival/surv-1_normal.mp3",
  "./audio/survival/surv-1_slow.mp3",
  "./audio/survival/surv-2_normal.mp3",
  "./audio/survival/surv-2_slow.mp3",
  "./audio/survival/surv-3_normal.mp3",
  "./audio/survival/surv-3_slow.mp3",
  "./audio/survival/surv-4_normal.mp3",
  "./audio/survival/surv-4_slow.mp3",
  "./audio/survival/surv-5_normal.mp3",
  "./audio/survival/surv-5_slow.mp3",
  "./audio/survival/surv-6_normal.mp3",
  "./audio/survival/surv-6_slow.mp3",
  "./audio/survival/surv-7_normal.mp3",
  "./audio/survival/surv-7_slow.mp3",
  "./audio/survival/surv-8_normal.mp3",
  "./audio/survival/surv-8_slow.mp3",
  "./audio/survival/surv-9_normal.mp3",
  "./audio/survival/surv-9_slow.mp3"
];

function resolveScopeUrl(relativePath) {
  return new URL(relativePath, self.registration.scope).toString();
}

async function precacheList(cacheName, relativePaths) {
  const cache = await caches.open(cacheName);
  const urls = [...new Set(relativePaths.map(resolveScopeUrl))];
  await Promise.all(
    urls.map(async (url) => {
      try {
        const existing = await cache.match(url, { ignoreSearch: true });
        if (existing && cacheName === AUDIO_CACHE) return;
        const res = await fetch(url, { cache: 'no-cache' });
        if (res.ok && res.status === 200) {
          await cache.put(url, res);
        }
      } catch {
        // Ignore individual precache failure so SW install never blocks completely
      }
    })
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      precacheList(SHELL_CACHE, SHELL_ASSETS),
      precacheList(AUDIO_CACHE, SURVIVAL_AUDIO_ASSETS),
    ])
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key.startsWith('echospeak-shell-') && key !== SHELL_CACHE) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/**
 * Serves full (200) or HTTP Range (206 Partial Content) responses from a cached 200 MP3 response.
 * Crucial for Safari / iOS <audio> offline playback.
 */
async function buildRangeResponse(cachedResponse, rangeHeader) {
  const buffer = await cachedResponse.arrayBuffer();
  const total = buffer.byteLength;
  const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
  if (!match) {
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': cachedResponse.headers.get('Content-Type') || 'audio/mpeg',
        'Content-Length': String(total),
        'Accept-Ranges': 'bytes',
      },
    });
  }

  let start = match[1] ? Number.parseInt(match[1], 10) : 0;
  let end = match[2] ? Number.parseInt(match[2], 10) : total - 1;
  if (Number.isNaN(start) || start < 0) start = 0;
  if (Number.isNaN(end) || end >= total) end = total - 1;

  if (start > end || start >= total) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${total}` },
    });
  }

  const sliced = buffer.slice(start, end + 1);
  return new Response(sliced, {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': cachedResponse.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Content-Length': String(sliced.byteLength),
      'Accept-Ranges': 'bytes',
    },
  });
}

async function handleAudioRequest(request) {
  const cache = await caches.open(AUDIO_CACHE);
  const urlObj = new URL(request.url);
  const canonicalUrl = `${urlObj.origin}${urlObj.pathname}`;
  const rangeHeader = request.headers.get('range');

  let cached = await cache.match(canonicalUrl);
  if (!cached) {
    try {
      // Fetch complete 200 response without Range header so it can be cached cleanly
      const networkRes = await fetch(canonicalUrl, { mode: 'cors', credentials: 'same-origin' });
      if (networkRes.ok && networkRes.status === 200) {
        await cache.put(canonicalUrl, networkRes.clone());
        cached = networkRes;
      } else {
        return networkRes;
      }
    } catch {
      return new Response('Offline audio not cached', { status: 503 });
    }
  }

  if (rangeHeader) {
    return buildRangeResponse(cached, rangeHeader);
  }
  return cached;
}

async function handleNavigationRequest(request) {
  const shellCache = await caches.open(SHELL_CACHE);
  try {
    const networkRes = await fetch(request);
    if (networkRes.ok) {
      shellCache.put(resolveScopeUrl('./index.html'), networkRes.clone()).catch(() => {});
    }
    return networkRes;
  } catch {
    return (
      (await shellCache.match(resolveScopeUrl('./index.html'))) ||
      (await shellCache.match(resolveScopeUrl('./'))) ||
      new Response('離線狀態：請先於有網路時開啟一次 EchoSpeak。', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    );
  }
}

async function handleStaticAsset(request) {
  const shellCache = await caches.open(SHELL_CACHE);
  const cached = await shellCache.match(request, { ignoreSearch: false });
  if (cached) return cached;

  try {
    const networkRes = await fetch(request);
    if (networkRes.ok && networkRes.status === 200) {
      shellCache.put(request, networkRes.clone()).catch(() => {});
    }
    return networkRes;
  } catch {
    return cached || new Response('', { status: 504 });
  }
}

async function handleFontsRequest(request) {
  const cache = await caches.open(FONTS_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone()).catch(() => {});
      return res;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Google Fonts: Stale-While-Revalidate
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(handleFontsRequest(request));
    return;
  }

  // Only handle same-origin requests; never intercept Firebase/Firestore/Google Auth APIs
  if (url.origin !== self.location.origin) return;

  // Never intercept local dev Express API
  if (url.pathname.includes('/api/')) return;

  // Audio MP3s: Cache-First + Range (206) support
  if (url.pathname.includes('/audio/') && url.pathname.endsWith('.mp3')) {
    event.respondWith(handleAudioRequest(request));
    return;
  }

  // SPA Navigation: Network-First with cached index.html fallback
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Static app assets (JS, CSS, icons, manifest)
  if (
    url.pathname.includes('/assets/') ||
    url.pathname.includes('/icons/') ||
    url.pathname.endsWith('.webmanifest') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png')
  ) {
    event.respondWith(handleStaticAsset(request));
  }
});
