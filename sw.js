/* Name the World - offline support.

   The app is a single self-contained page: no external scripts, styles, fonts
   or images, and it never fetches anything at runtime. So caching the page
   itself is enough to make the whole game work with no connection.

   Bump VERSION to retire the old cache and publish a new one. */
const VERSION = 'ntw-v42';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];
/* the flags game is unplayable without its pictures, so they are precached with
   everything else - 199 files, about 465 KB all told */
const FLAGS = ["AFG", "AGO", "ALB", "AND", "ARE", "ARG", "ARM", "ATG", "AUS", "AUT", "AZE", "BDI", "BEL", "BEN", "BFA", "BGD", "BGR", "BHR", "BHS", "BIH", "BLR", "BLZ", "BOL", "BRA", "BRB", "BRN", "BTN", "BWA", "CAF", "CAN", "CHE", "CHL", "CHN", "CIV", "CMR", "COD", "COG", "COL", "COM", "CPV", "CRI", "CUB", "CYP", "CZE", "DEU", "DJI", "DMA", "DNK", "DOM", "DZA", "ECU", "EGY", "ERI", "ESH", "ESP", "EST", "ETH", "FIN", "FJI", "FRA", "FSM", "GAB", "GBR", "GEO", "GHA", "GIN", "GMB", "GNB", "GNQ", "GRC", "GRD", "GRL", "GTM", "GUY", "HND", "HRV", "HTI", "HUN", "IDN", "IND", "IRL", "IRN", "IRQ", "ISL", "ISR", "ITA", "JAM", "JOR", "JPN", "KAZ", "KEN", "KGZ", "KHM", "KIR", "KNA", "KOR", "KWT", "LAO", "LBN", "LBR", "LBY", "LCA", "LIE", "LKA", "LSO", "LTU", "LUX", "LVA", "MAR", "MCO", "MDA", "MDG", "MDV", "MEX", "MHL", "MKD", "MLI", "MLT", "MMR", "MNE", "MNG", "MOZ", "MRT", "MUS", "MWI", "MYS", "NAM", "NER", "NGA", "NIC", "NLD", "NOR", "NPL", "NRU", "NZL", "OMN", "PAK", "PAN", "PER", "PHL", "PLW", "PNG", "POL", "PRK", "PRT", "PRY", "PSE", "QAT", "ROU", "RUS", "RWA", "SAU", "SDN", "SEN", "SGP", "SLB", "SLE", "SLV", "SMR", "SOM", "SRB", "SSD", "STP", "SUR", "SVK", "SVN", "SWE", "SWZ", "SYC", "SYR", "TCD", "TGO", "THA", "TJK", "TKM", "TLS", "TON", "TTO", "TUN", "TUR", "TUV", "TWN", "TZA", "UGA", "UKR", "URY", "USA", "UZB", "VAT", "VCT", "VEN", "VNM", "VUT", "WSM", "XKX", "YEM", "ZAF", "ZMB", "ZWE"];
for(const c of FLAGS) SHELL.push('./flags/' + c + '.webp');

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
