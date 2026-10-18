import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GitHubSync, utf8ToB64, b64ToUtf8, nomDepot, nomCompte } from '../js/sync/github.js';

test('noms saisis : même transformation que GitHub', () => {
  assert.equal(nomDepot('agence-manager-données'), 'agence-manager-donn-es');
  assert.equal(nomDepot(' agence manager '), 'agence-manager');
  assert.equal(nomDepot('agence-manager-donnees'), 'agence-manager-donnees');
  assert.equal(nomCompte('@elone693-jpg'), 'elone693-jpg');
  assert.equal(nomCompte('https://github.com/elone693-jpg/agence'), 'elone693-jpg');
});

// Faux GitHub en mémoire : contenu + sha, avec option pour simuler une écriture concurrente.
function fauxGitHub({ initial = null, concurrent = null } = {}) {
  let contenu = initial ? JSON.stringify(initial) : null, sha = initial ? 's0' : null, n = 0, ecritures = 0;
  const issues = [{ number: 7, title: 'voix', body: 'Coaching Marc demain 10h', created_at: '2026-10-18T08:00:00Z' }];
  const fetch = async (url, { method = 'GET', body } = {}) => {
    const path = url.replace('https://api.github.com/repos/fred/donnees', '');
    const r = (status, json) => ({ status, ok: status < 300, json: async () => json });
    if (path === '/contents/donnees.json' && method === 'GET') return contenu == null ? r(404, {}) : r(200, { sha, content: utf8ToB64(contenu) });
    if (path === '/contents/donnees.json' && method === 'PUT') {
      const b = JSON.parse(body);
      if (concurrent && ecritures === 0) { contenu = JSON.stringify(concurrent); sha = 'autre'; ecritures++; return r(409, { message: 'conflict' }); }
      if ((b.sha ?? null) !== sha) return r(409, { message: 'sha' });
      contenu = b64ToUtf8(b.content); sha = `s${++n}`; ecritures++;
      return r(200, { content: { sha } });
    }
    if (path.startsWith('/issues?')) return r(200, issues.filter(i => !i.closed));
    if (path === '/issues/7' && method === 'PATCH') { issues[0].closed = true; return r(200, {}); }
    return r(500, {});
  };
  return { fetch, get contenu() { return JSON.parse(contenu); }, get ecritures() { return ecritures; } };
}

const cfg = { owner: 'fred', repo: 'donnees', token: 't' };

test('UTF-8 aller-retour (accents, emoji)', () => {
  const s = 'Révision tarifs — Léa Koné ✅';
  assert.equal(b64ToUtf8(utf8ToB64(s)), s);
});

test('premier envoi quand le dépôt est vide', async () => {
  const gh = fauxGitHub();
  const local = { taches: { a: { titre: 'A', _t: Date.now() } } };
  const r = await new GitHubSync(cfg, gh.fetch).synchroniser(local);
  assert.equal(r.envoye, true);
  assert.equal(gh.contenu.taches.a.titre, 'A');
});

test('rien n’est envoyé si le distant contient déjà tout', async () => {
  const t = Date.now();
  const gh = fauxGitHub({ initial: { taches: { a: { titre: 'A', _t: t } } } });
  const r = await new GitHubSync(cfg, gh.fetch).synchroniser({ taches: { a: { titre: 'A', _t: t } } });
  assert.equal(r.envoye, false);
  assert.equal(gh.ecritures, 0);
});

test('écriture concurrente d’un autre appareil : relecture, fusion, aucun élément perdu', async () => {
  const t = Date.now();
  const gh = fauxGitHub({ initial: { taches: {} }, concurrent: { taches: { iphone: { titre: 'depuis iPhone', _t: t } } } });
  const r = await new GitHubSync(cfg, gh.fetch).synchroniser({ taches: { mac: { titre: 'depuis Mac', _t: t } } });
  assert.equal(r.envoye, true);
  assert.deepEqual(Object.keys(gh.contenu.taches).sort(), ['iphone', 'mac']);
});

test('dictées : lecture des issues ouvertes puis clôture', async () => {
  const gh = fauxGitHub();
  const s = new GitHubSync(cfg, gh.fetch);
  const d = await s.dictees();
  assert.deepEqual(d.map(x => [x.numero, x.texte]), [[7, 'Coaching Marc demain 10h']]);
  await s.cloreDictee(7);
  assert.equal((await s.dictees()).length, 0);
});
