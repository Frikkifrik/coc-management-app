const CACHE_NAME = 'lukulele-page-v2';
const PAGE_URL = new URL('./Lukulele.html', self.registration.scope);

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.add(PAGE_URL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys
                .filter(key => key.startsWith('lukulele-page-') && key !== CACHE_NAME)
                .map(key => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);
    if (event.request.mode !== 'navigate' || requestUrl.pathname !== PAGE_URL.pathname) return;

    event.respondWith(
        (async () => {
            let response;
            try {
                response = await fetch(event.request);
            } catch (networkError) {
                const cachedPage = await caches.match(PAGE_URL);
                if (cachedPage) return cachedPage;
                throw networkError;
            }

            if (response.ok) {
                try {
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put(PAGE_URL, response.clone());
                } catch (error) {
                    console.error('Could not update the offline Lukulele page:', error);
                }
            }
            return response;
        })()
    );
});
