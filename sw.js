/* Name the World - offline support.

   The app is a single self-contained page: no external scripts, styles, fonts
   or images, and it never fetches anything at runtime. So caching the page
   itself is enough to make the whole game work with no connection.

   Bump VERSION to retire the old cache and publish a new one. */
const VERSION = 'ntw-v2';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', ev=>{
  ev.waitUntil((async ()=>{
    const cache = await caches.open(VERSION);
    /* one at a time, so a single 404 cannot fail the whole install */
    await Promise.all(SHELL.map(u => cache.add(new Request(u, {cache:'reload'})).catch(()=>{})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', ev=>{
  ev.waitUntil((async ()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* Network first, cache second.

   The page is the whole app, so serving a stale copy while online would hide
   updates until the next load. Going to the network first keeps a connected
   player on the current version; the cache is there for when the network is
   missing or too slow to wait for. */
function fromNetwork(req, ms){
  return new Promise((resolve, reject)=>{
    const timer = setTimeout(()=>reject(new Error('slow')), ms);
    fetch(req).then(res=>{ clearTimeout(timer); resolve(res); },
                    err=>{ clearTimeout(timer); reject(err); });
  });
}

self.addEventListener('fetch', ev=>{
  const req = ev.request;
  if(req.method !== 'GET') return;
  if(new URL(req.url).origin !== location.origin) return;

  const page = req.mode === 'navigate';
  ev.respondWith((async ()=>{
    const cache = await caches.open(VERSION);
    try{
      const res = await fromNetwork(req, page ? 3500 : 8000);
      if(res && res.ok) cache.put(req, res.clone());
      return res;
    }catch(e){
      const hit = await cache.match(req) ||
                  (page ? await cache.match('./index.html') : null);
      if(hit) return hit;
      throw e;
    }
  })());
});
