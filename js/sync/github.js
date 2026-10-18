// Synchronisation via un dépôt GitHub privé (ex. « agence-manager-donnees ») :
//  - donnees.json : toutes les données, fusionnées élément par élément (voir store.merge) ;
//  - issues ouvertes : dictées envoyées par le Raccourci Apple Watch / iPhone, importées puis fermées.
// La clé d'accès (jeton « fine-grained » limité à ce dépôt : Contents + Issues en lecture/écriture)
// reste sur l'appareil et n'est envoyée qu'à api.github.com.

import { merge, sameData } from '../core/store.js';

const API = 'https://api.github.com';
const FICHIER = 'donnees.json';
const FICHIER_ICS = 'agence-manager.ics';
// Adresse stable (sans numéro de révision) : toujours la dernière version du fichier.
export const urlAbonnement = gist => `https://gist.githubusercontent.com/${gist.owner?.login}/${gist.id}/raw/${FICHIER_ICS}`;

export function utf8ToB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
export function b64ToUtf8(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

// GitHub remplace tout caractère hors [A-Za-z0-9._-] par un tiret à la création du dépôt
// (« agence-manager-données » devient « agence-manager-donn-es ») : on applique la même règle.
export const nomDepot = s => String(s ?? '').trim().replace(/[^A-Za-z0-9._-]/g, '-');
export const nomCompte = s => String(s ?? '').trim().replace(/^@/, '').replace(/^https?:\/\/github\.com\//i, '').replace(/\/.*$/, '');

export class GitHubSync {
  constructor({ owner, repo, token }, fetchImpl = globalThis.fetch.bind(globalThis)) {
    this.owner = owner; this.repo = repo; this.token = token; this.fetch = fetchImpl;
  }

  api(path, opts) { return this.requete(`${API}/repos/${this.owner}/${this.repo}${path}`, opts); }

  async requete(url, { method = 'GET', body } = {}) {
    const res = await this.fetch(url, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    if (res.status === 404 && method === 'GET') return { status: 404, json: null };
    const json = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) {
      const err = new Error(messageErreur(res.status, json));
      err.status = res.status;
      throw err;
    }
    return { status: res.status, json };
  }

  async verifier() {
    const { status, json } = await this.api('');
    if (status === 404) throw new Error(`Dépôt « ${this.owner}/${this.repo} » introuvable : vérifiez son nom exact sur github.com, et que la clé d’accès a bien été créée pour ce dépôt.`);
    if (!json.private) throw new Error('Le dépôt de données doit être privé.');
    return json;
  }

  async lire() {
    const { status, json } = await this.api(`/contents/${FICHIER}`);
    if (status === 404) return { data: null, sha: null };
    let b64 = json.content;
    if (!b64 && json.sha) b64 = (await this.api(`/git/blobs/${json.sha}`)).json.content; // fichier > 1 Mo
    return { data: JSON.parse(b64ToUtf8(b64)), sha: json.sha };
  }

  async ecrire(data, sha) {
    const { json } = await this.api(`/contents/${FICHIER}`, {
      method: 'PUT',
      body: { message: `Synchro ${new Date().toISOString()}`, content: utf8ToB64(JSON.stringify(data)), ...(sha ? { sha } : {}) },
    });
    return json.content.sha;
  }

  // Fusionne local et distant ; renvoie les données fusionnées. Relit et refusionne si un autre
  // appareil a écrit entre-temps (409/422).
  async synchroniser(local) {
    for (let essai = 0; essai < 4; essai++) {
      const { data: distant, sha } = await this.lire();
      const fusion = merge(local, distant ?? {});
      if (distant && sameData(fusion, merge(distant, {}))) return { data: fusion, envoye: false };
      try {
        await this.ecrire(fusion, sha);
        return { data: fusion, envoye: true };
      } catch (e) {
        if (e.status !== 409 && e.status !== 422) throw e;
      }
    }
    throw new Error('Conflit de synchronisation persistant, nouvel essai à la prochaine synchro.');
  }

  // ---------- Calendrier abonné (gist secret) ----------
  // Un gist « secret » n'est pas listé publiquement mais reste lisible par qui connaît l'adresse :
  // c'est le principe des liens d'abonnement des agendas en ligne. Il ne contient que l'export .ics.
  async publierCalendrier(contenu, gistId) {
    const files = { [FICHIER_ICS]: { content: contenu } };
    if (gistId) {
      try {
        const { json } = await this.requete(`${API}/gists/${gistId}`, { method: 'PATCH', body: { files } });
        return { gistId: json.id, url: urlAbonnement(json) };
      } catch (e) {
        if (e.status !== 404) throw e; // gist supprimé : on en recrée un
      }
    }
    const { json } = await this.requete(`${API}/gists`, { method: 'POST', body: { description: 'AgenceManager — calendrier (ne pas partager le lien)', public: false, files } });
    return { gistId: json.id, url: urlAbonnement(json), cree: true };
  }

  async dictees() {
    const { json } = await this.api('/issues?state=open&per_page=50&sort=created&direction=asc');
    return (json ?? []).filter(i => !i.pull_request).map(i => ({
      numero: i.number,
      titre: i.title ?? '',
      texte: (i.body?.trim() || i.title || '').trim(),
      recu: i.created_at,
    }));
  }

  async cloreDictee(numero) {
    await this.api(`/issues/${numero}`, { method: 'PATCH', body: { state: 'closed', state_reason: 'completed' } });
  }
}

function messageErreur(status, json) {
  if (status === 401) return 'Clé d’accès refusée (expirée ou incorrecte).';
  if (status === 403) return json?.message?.includes('rate limit') ? 'Trop de requêtes GitHub, nouvel essai dans quelques minutes.' : 'La clé n’a pas les droits nécessaires (Contents et Issues en écriture, Gists pour le calendrier).';
  return `GitHub a répondu ${status}${json?.message ? ` : ${json.message}` : ''}`;
}
