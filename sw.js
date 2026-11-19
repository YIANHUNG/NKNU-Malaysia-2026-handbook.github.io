// 馬來西亞見習手冊：離線用的小程式
// 網頁本身：有網路就抓最新版（不用瀏覽器的舊快取），太慢或沒網路才先用上次存的，
//           等新版抓到後會通知網頁跳出「有新版本」。
// 簡報圖片與 PDF：存過就直接用存好的。
// Google 試算表：不經過這裡，由網頁自己記住上次的資料。
var CORE = 'kl-core-v2', SLIDES = 'kl-slides-v1', FONTS = 'kl-fonts-v1';
var CORE_FILES = ['./', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CORE).then(function (c) {
    return Promise.all(CORE_FILES.map(function (u) {
      return fetch(new Request(u, { cache: 'reload' })).then(function (r) { if (r.ok) return c.put(u, r); }).catch(function () {});
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  var keep = [CORE, SLIDES, FONTS];
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf('kl-') === 0 && keep.indexOf(k) < 0; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function tellClients() {
  self.clients.matchAll({ type: 'window' }).then(function (cs) { cs.forEach(function (c) { c.postMessage({ type: 'kl-updated' }); }); });
}

function networkFirst(req) {
  return new Promise(function (resolve) {
    var done = false, fromOld = false;
    var timer = setTimeout(fromCache, 8000);
    function fromCache() {
      if (done) return;
      caches.match('./').then(function (r) {
        if (r && !done) { done = true; fromOld = true; resolve(r); }
      });
    }
    fetch(req.url, { cache: 'no-store', credentials: 'same-origin' }).then(function (res) {
      if (res.ok) {
        var copy = res.clone();
        caches.open(CORE).then(function (c) { return c.put('./', copy); }).then(function () { if (fromOld) setTimeout(tellClients, 500); });
      }
      if (!done) { done = true; clearTimeout(timer); resolve(res); }
    }).catch(function () { clearTimeout(timer); fromCache(); });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (req.mode === 'navigate' && url.origin === location.origin) { e.respondWith(networkFirst(req)); return; }
  if (url.origin === location.origin) {
    var isSlide = url.pathname.indexOf('/slides/') >= 0 || url.pathname.slice(-4) === '.pdf';
    e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res.ok) { var copy = res.clone(); caches.open(isSlide ? SLIDES : CORE).then(function (c) { c.put(req, copy); }); }
        return res;
      });
    }));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(function (c) {
      return c.match(req).then(function (hit) {
        var net = fetch(req).then(function (res) { c.put(req, res.clone()); return res; }).catch(function () { return hit; });
        return hit || net;
      });
    }));
  }
});
