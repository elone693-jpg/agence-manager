// Serveur statique minimal pour tester l'app en local : node scripts/serve.mjs [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT ?? process.argv[2] ?? 8642);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ics': 'text/calendar' };

createServer(async (req, res) => {
  // Journal des visites venant d'un autre appareil (utile pour vérifier que l'iPhone arrive jusqu'ici).
  const ip = req.socket.remoteAddress?.replace('::ffff:', '');
  if (ip && ip !== '127.0.0.1' && ip !== '::1' && (req.url === '/' || req.url.startsWith('/index'))) {
    console.log(`${new Date().toLocaleTimeString('fr-FR')} visite de ${ip} (${(req.headers['user-agent'] ?? '').match(/iPhone|iPad|Macintosh|Android/)?.[0] ?? 'appareil'})`);
  }
  const chemin = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const fichier = join(RACINE, chemin.endsWith('/') ? `${chemin}index.html` : chemin);
  if (!fichier.startsWith(RACINE)) { res.writeHead(403).end(); return; }
  try {
    const data = await readFile(fichier);
    res.writeHead(200, { 'Content-Type': TYPES[extname(fichier)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' }).end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Introuvable');
  }
}).listen(PORT, () => console.log(`AgenceManager : http://localhost:${PORT}`));
