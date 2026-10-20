/**
 * Kişisel Borç Takip Service Worker (PWA)
 *
 * Yalnızca statik varlıklar önbelleğe alınır. Sayfa HTML'leri ve API yanıtları
 * kullanıcıya özel finansal veri taşıdığı için ASLA önbelleğe yazılmaz:
 * eski sürüm çıkıştan sonra bile cihazda kalabilir ve bayat bakiye gösterebilir.
 */
const CACHE_NAME = "borcolcme-cache-v3";
const OFFLINE_URL = "/offline.html";

const STATIC_ASSETS = ["/manifest.json", "/icons/icon.svg", OFFLINE_URL];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** Sadece versiyonlanmış statik varlıklar önbelleğe uygundur. */
function isCacheableAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json" ||
    /\.(?:css|js|woff2?|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API istekleri her zaman ağdan; önbelleğe hiç dokunulmaz.
  if (url.pathname.startsWith("/api/")) return;

  // Sayfa gezinmeleri: ağ öncelikli, çevrimdışıysa bilgilendirme sayfası.
  // Yanıt gövdesi önbelleğe YAZILMAZ (oturum açık kullanıcının verisi olabilir).
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (!isCacheableAsset(url)) return;

  // Statik varlıklar: önbellek öncelikli, arka planda tazelenir.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
