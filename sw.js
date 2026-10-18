// Service worker : l'app s'ouvre et fonctionne sans réseau. Changer VERSION à chaque mise en ligne.
const VERSION = 'am-1.1.0';
const FICHIERS = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/ui/ctx.js', 'js/ui/dom.js', 'js/ui/forms.js', 'js/ui/exemple.js',
  'js/ui/views/commun.js', 'js/ui/views/aujourdhui.js', 'js/ui/views/planning.js', 'js/ui/views/taches.js',
  'js/ui/views/equipe.js', 'js/ui/views/obligations.js', 'js/ui/views/avalider.js', 'js/ui/views/reglages.js',
  'js/core/dates.js', 'js/core/store.js', 'js/core/defaults.js', 'js/core/agenda.js', 'js/core/equipe.js',
  'js/core/obligations.js', 'js/core/ics.js', 'js/core/voix.js', 'js/core/agendaIphone.js', 'js/sync/github.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Fichiers de l'app : cache d'abord (ouverture instantanée), mise à jour en arrière-plan.
// Les appels à api.github.com ne passent jamais par le cache.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const cached = await cache.match(e.request, { ignoreSearch: true });
    const reseau = fetch(e.request).then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; }).catch(() => cached);
    return cached ?? reseau;
  }));
});
