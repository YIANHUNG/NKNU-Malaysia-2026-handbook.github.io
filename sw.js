// 馬來西亞見習手冊：離線用的小程式
// 網頁本身：有網路就抓最新版，沒網路就用上次存的。
// 簡報圖片與 PDF：存過就直接用存好的。
// Google 試算表：不經過這裡，由網頁自己記住上次的資料。
var CORE = 'kl-core-v1', SLIDES = 'kl-slides-v1', FONTS = 'kl-fonts-v1';
var CORE_FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CORE).then(function (c) { return c.addAll(CORE_FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  var keep = [CORE, SLIDES, FONTS];
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf('kl-') === 0 && keep.indexOf(k) < 0; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function networkFirst(req) {
  return new Promise(function (resolve) {
    var done = false;
    var timer = setTimeout(function () { fromCache(); }, 5000);
    function fromCache() {
      if (done) return;
      caches.match(req, { ignoreSearch: true }).then(function (r) { return r || caches.match('./'); }).then(function (r) {
        if (r && !done) { done = true; resolve(r); }
      });
    }
    fetch(req).then(function (res) {
      if (res.ok) { var copy = res.clone(); caches.open(CORE).then(function (c) { c.put('./', copy); }); }
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
    var isSlide = url.pathname.indexOf('/slides/') >= 0;
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
