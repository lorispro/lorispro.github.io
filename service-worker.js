/* Manifest version: KkXdotga */
// // Caution! Be sure you understand the caveats before publishing an application with
// // offline support. See https://aka.ms/blazor-offline-considerations

// self.importScripts('./service-worker-assets.js');
// self.addEventListener('install', event => event.waitUntil(onInstall(event)));
// self.addEventListener('activate', event => event.waitUntil(onActivate(event)));
// self.addEventListener('fetch', event => event.respondWith(onFetch(event)));

// const cacheNamePrefix = 'offline-cache-';
// const cacheName = `${cacheNamePrefix}${self.assetsManifest.version}`;
// const offlineAssetsInclude = [ /\.dll$/, /\.pdb$/, /\.wasm/, /\.html/, /\.js$/, /\.json$/, /\.css$/, /\.woff$/, /\.png$/, /\.jpe?g$/, /\.gif$/, /\.ico$/, /\.blat$/, /\.dat$/, /\.webmanifest$/ ];
// const offlineAssetsExclude = [ /^service-worker\.js$/ ];

// // Replace with your base path if you are hosting on a subfolder. Ensure there is a trailing '/'.
// const base = "/";
// const baseUrl = new URL(base, self.origin);
// const manifestUrlList = self.assetsManifest.assets.map(asset => new URL(asset.url, baseUrl).href);

// async function onInstall(event) {
//     console.info('Service worker: Install');

//     // Fetch and cache all matching items from the assets manifest
//     const assetsRequests = self.assetsManifest.assets
//         .filter(asset => offlineAssetsInclude.some(pattern => pattern.test(asset.url)))
//         .filter(asset => !offlineAssetsExclude.some(pattern => pattern.test(asset.url)))
//         .map(asset => new Request(asset.url, { integrity: asset.hash, cache: 'no-cache' }));
//     await caches.open(cacheName).then(cache => cache.addAll(assetsRequests));
// }

// async function onActivate(event) {
//     console.info('Service worker: Activate');

//     // Delete unused caches
//     const cacheKeys = await caches.keys();
//     await Promise.all(cacheKeys
//         .filter(key => key.startsWith(cacheNamePrefix) && key !== cacheName)
//         .map(key => caches.delete(key)));
// }

// async function onFetch(event) {
//     let cachedResponse = null;
//     if (event.request.method === 'GET') {
//         // For all navigation requests, try to serve index.html from cache,
//         // unless that request is for an offline resource.
//         // If you need some URLs to be server-rendered, edit the following check to exclude those URLs
//         const shouldServeIndexHtml = event.request.mode === 'navigate'
//             && !manifestUrlList.some(url => url === event.request.url);

//         const request = shouldServeIndexHtml ? 'index.html' : event.request;
//         const cache = await caches.open(cacheName);
//         cachedResponse = await cache.match(request);
//     }

//     return cachedResponse || fetch(event.request);
// }

/* Manifest version: bGM9L04j */
self.importScripts('./service-worker-assets.js');
self.addEventListener('install', event => event.waitUntil(onInstall(event)));
self.addEventListener('activate', event => event.waitUntil(onActivate(event)));
self.addEventListener('fetch', event => event.respondWith(onFetch(event)));

const cacheNamePrefix = 'offline-cache-';
const cacheName = `${cacheNamePrefix}${self.assetsManifest.version}`;
const offlineAssetsInclude = [/\.dll$/, /\.pdb$/, /\.wasm/, /\.html/, /\.js$/, /\.json$/, /\.css$/, /\.woff$/, /\.png$/, /\.jpe?g$/, /\.gif$/, /\.ico$/, /\.blat$/, /\.dat$/];
const offlineAssetsExclude = [/^service-worker\.js$/];

const base = "/";
const baseUrl = new URL(base, self.origin);
const manifestUrlList = self.assetsManifest.assets.map(asset => new URL(asset.url, baseUrl).href);

// File grandi del framework: niente integrity su iOS vecchio
const heavyFrameworkFiles = [/dotnet\.js$/, /dotnet\.native\.wasm$/, /dotnet\.wasm$/, /\.wasm$/];

function isHeavyFile(url) {
    return heavyFrameworkFiles.some(p => p.test(url));
}

function isiOSLegacy() {
    // Nel SW non abbiamo navigator.userAgent direttamente,
    // ma possiamo usare self.navigator se disponibile
    try {
        const ua = self.navigator?.userAgent ?? '';
        const match = ua.match(/OS (\d+)_/);
        if (match) return parseInt(match[1]) <= 16;
    } catch { }
    return false; // default: comportamento normale
}

const legacyIOS = isiOSLegacy();

async function onInstall(event) {
    console.info('Service worker: Install, legacyIOS=', legacyIOS);

    const cache = await caches.open(cacheName);

    const assets = self.assetsManifest.assets
        .filter(asset => offlineAssetsInclude.some(p => p.test(asset.url)))
        .filter(asset => !offlineAssetsExclude.some(p => p.test(asset.url)));

    // Su iOS ≤ 16: rimuovi integrity dai file pesanti e cacha in batch
    // Su altri browser: comportamento originale
    if (legacyIOS) {
        const BATCH_SIZE = 5;
        for (let i = 0; i < assets.length; i += BATCH_SIZE) {
            const batch = assets.slice(i, i + BATCH_SIZE);
            await Promise.allSettled(batch.map(asset => {
                const options = isHeavyFile(asset.url)
                    ? { cache: 'no-cache' }                          // no integrity
                    : { integrity: asset.hash, cache: 'no-cache' };  // integrity normale
                const request = new Request(asset.url, options);
                return cache.add(request).catch(err => {
                    console.warn('SW: cache miss per', asset.url, err);
                });
            }));
        }
    } else {
        // Comportamento originale
        const assetsRequests = assets.map(asset =>
            new Request(asset.url, { integrity: asset.hash, cache: 'no-cache' })
        );
        await cache.addAll(assetsRequests);
    }

    await self.skipWaiting();
}

async function onActivate(event) {
    console.info('Service worker: Activate');
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys
        .filter(key => key.startsWith(cacheNamePrefix) && key !== cacheName)
        .map(key => caches.delete(key)));
    await self.clients.claim();
}

async function onFetch(event) {
    let cachedResponse = null;
    if (event.request.method === 'GET') {
        const shouldServeIndexHtml = event.request.mode === 'navigate'
            && !manifestUrlList.some(url => url === event.request.url);
        const request = shouldServeIndexHtml ? 'index.html' : event.request;
        const cache = await caches.open(cacheName);
        cachedResponse = await cache.match(request);
    }
    return cachedResponse || fetch(event.request);
}