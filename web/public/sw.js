const CACHE = "credito-vecino-v2";
const BASE = ["/", "/manifest.webmanifest", "/icono-192.png", "/icono-512.png"];

self.addEventListener("install", event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        await cache.addAll(BASE);
        const respuesta = await cache.match("/");
        const html = await respuesta.text();
        const recursos = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)]
            .map(coincidencia => coincidencia[1]);
        await cache.addAll(recursos);
        await self.skipWaiting();
    })());
});

self.addEventListener("activate", event => {
    event.waitUntil((async () => {
        const nombres = await caches.keys();
        await Promise.all(nombres.filter(nombre => nombre !== CACHE).map(nombre => caches.delete(nombre)));
        await self.clients.claim();
    })());
});

self.addEventListener("fetch", event => {
    const solicitud = event.request;
    const url = new URL(solicitud.url);
    if (solicitud.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

    if (solicitud.mode === "navigate") {
        event.respondWith(fetch(solicitud).catch(async () => {
            const cache = await caches.open(CACHE);
            return await cache.match("/") || Response.error();
        }));
        return;
    }

    event.respondWith(caches.match(solicitud).then(respuesta => respuesta || fetch(solicitud).then(async red => {
        if (red.ok) {
            const cache = await caches.open(CACHE);
            await cache.put(solicitud, red.clone());
        }
        return red;
    })));
});
