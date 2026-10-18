import { esc } from '../dom.js';
import { store, sync } from '../ctx.js';

export const titre = () => 'Réglages';

export function render() {
  const r = store.reglages();
  const cfg = sync.config() ?? {};
  const theme = (() => { try { return localStorage.getItem('am:theme') || 'auto'; } catch { return 'auto'; } })();
  const urlIssues = cfg.owner && cfg.repo ? `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/issues` : 'https://api.github.com/repos/<compte>/<dépôt>/issues';

  return `<div class="grid cols-2">
  <section class="card">
    <header><h2>Profil</h2></header>
    <div class="fields">
      <label class="field f-3"><span>Votre prénom</span><input type="text" value="${esc(r.prenom ?? '')}" data-change="reglage" data-k="prenom" placeholder="Fred"></label>
      <label class="field f-3"><span>Thème (cet appareil)</span><select data-change="theme">${['auto', 'clair', 'sombre'].map(t => `<option value="${t}"${t === theme ? ' selected' : ''}>${t === 'auto' ? 'Automatique' : t === 'clair' ? 'Clair' : 'Sombre'}</option>`).join('')}</select></label>
    </div>
  </section>

  <section class="card">
    <header><h2>Agence</h2></header>
    <div class="fields">
      <label class="field f-2"><span>Ouverture</span><input type="time" value="${esc(r.heureDebut)}" data-change="reglage" data-k="heureDebut"></label>
      <label class="field f-2"><span>Fermeture</span><input type="time" value="${esc(r.heureFin)}" data-change="reglage" data-k="heureFin"></label>
      <label class="field f-2"><span>Présents min.</span><input type="number" min="0" value="${r.seuilPresents}" data-change="reglage" data-k="seuilPresents" data-num></label>
      <label class="field f-3"><span>Formation DDA (h/an)</span><input type="number" min="0" value="${r.ddaHeures}" data-change="reglage" data-k="ddaHeures" data-num></label>
      <label class="field f-3"><span>Catégorie par défaut</span><select data-change="reglage" data-k="categorieDefaut">${store.categories().map(c => `<option value="${esc(c.id)}"${c.id === r.categorieDefaut ? ' selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
    </div>
  </section>

  <section class="card span-2" id="synchro">
    <header><h2>Synchronisation Mac ↔ iPhone</h2><span class="pill ${sync.etat === 'ok' ? 'ok' : sync.etat === 'erreur' ? 'danger' : ''}">${esc(sync.message)}</span></header>
    <p class="small muted" style="margin-top:0">Vos données restent sur vos appareils et sont copiées dans un dépôt GitHub <b>privé</b> qui vous appartient. Aucun serveur tiers.</p>
    <details ${cfg.token ? '' : 'open'}><summary class="small" style="cursor:pointer;font-weight:600">Mise en place (une seule fois, 3 minutes)</summary>
      <ol class="steps small">
        <li>Créez un dépôt <b>privé</b> nommé par exemple <code>agence-manager-donnees</code> (sans accent : GitHub remplace les accents par des tirets) : <a href="https://github.com/new" target="_blank" rel="noopener">github.com/new</a>.</li>
        <li>Créez une clé d’accès : <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">nouvelle clé « fine-grained »</a> → <i>Only select repositories</i> : ce dépôt uniquement → <i>Permissions</i> : <b>Contents</b> et <b>Issues</b> en <i>Read and write</i> → expiration 1 an.</li>
        <li>Saisissez ci-dessous le compte, le dépôt et la clé, sur le Mac puis sur l’iPhone.</li>
      </ol></details>
    <form class="fields" id="f-sync" autocomplete="off" style="margin-top:10px">
      <label class="field f-2"><span>Compte GitHub</span><input type="text" name="owner" value="${esc(cfg.owner ?? '')}" placeholder="elone693-jpg" autocapitalize="off" spellcheck="false" required></label>
      <label class="field f-2"><span>Dépôt de données</span><input type="text" name="repo" value="${esc(cfg.repo ?? 'agence-manager-donnees')}" autocapitalize="off" spellcheck="false" required></label>
      <label class="field f-2"><span>Clé d’accès</span><input type="password" name="token" value="${cfg.token ? '••••••••' : ''}" placeholder="github_pat_…" autocomplete="off" required></label>
      <div class="row f-6">
        <button class="btn primary" type="submit">Enregistrer et tester</button>
        ${cfg.token ? '<button class="btn" type="button" data-act="sync-now">Synchroniser maintenant</button><button class="btn danger" type="button" data-act="sync-off">Déconnecter cet appareil</button>' : ''}
      </div>
    </form>
  </section>

  <section class="card span-2">
    <header><h2>Raccourci Apple Watch / Siri</h2></header>
    <p class="small muted" style="margin-top:0">Dictez sur la montre : la phrase est déposée dans le dépôt et analysée par l’app à la synchro suivante (sur le Mac ou l’iPhone). Ce qui est ambigu arrive dans « À valider ».</p>
    <ol class="steps small">
      <li>App <b>Raccourcis</b> sur l’iPhone → <b>+</b> → action <b>Dicter le texte</b> (langue : Français ; arrêt : après une courte pause).</li>
      <li>Action <b>Obtenir le contenu de l’URL</b> :
        <pre class="code">URL : ${esc(urlIssues)}
Méthode : POST
En-têtes : Authorization = Bearer &lt;votre clé&gt;
           Accept = application/vnd.github+json
Corps (JSON) : title = Dictée
               body = [Texte dicté]</pre></li>
      <li>Action <b>Afficher le résultat</b> avec le texte « Noté ✓ ».</li>
      <li>Nommez le raccourci « <b>Agenda</b> », puis dans ses détails activez <b>Afficher sur l’Apple Watch</b>.</li>
      <li>Sur la montre : complication <i>Raccourcis</i> sur le cadran (le plus fiable), bouton Action (Ultra) ou « Dis Siri, Agenda ».</li>
    </ol>
    <p class="tiny faint" style="margin:0">Exemples : « Double écoute avec Marc mardi à 14 h » · « Carla en congés du 2 au 6 novembre » · « Rappelle-moi de valider les visas » · « Mémo : commander des fournitures ».</p>
  </section>

  <section class="card span-2">
    <header><h2>Catégories</h2><button class="btn small" data-act="ajout-cat">+ Catégorie</button></header>
    <div class="list">${store.categories().map((c, k) => `<div class="item" style="cursor:default;flex-wrap:wrap;align-items:flex-end">
      <input type="color" value="${esc(c.couleur)}" data-change="cat" data-i="${k}" data-k="couleur" aria-label="Couleur" style="width:40px;height:40px;border:1px solid var(--border);border-radius:8px;background:none;padding:2px">
      <label class="field" style="flex:2;min-width:160px"><span>Nom</span><input type="text" value="${esc(c.nom)}" data-change="cat" data-i="${k}" data-k="nom"></label>
      <label class="field" style="width:96px"><span>Durée (min)</span><input type="number" min="5" step="5" value="${c.duree}" data-change="cat" data-i="${k}" data-k="duree" data-num></label>
      <label class="field" style="width:96px"><span>Objectif/mois</span><input type="number" min="0" value="${c.objectifMois ?? 0}" data-change="cat" data-i="${k}" data-k="objectifMois" data-num></label>
      <label class="field" style="flex:3;min-width:200px"><span>Mots reconnus à la dictée</span><input type="text" value="${esc((c.mots ?? []).join(', '))}" data-change="cat" data-i="${k}" data-k="mots"></label>
    </div>`).join('')}</div>
  </section>

  <section class="card">
    <header><h2>Calendrier Apple</h2></header>
    <p class="small muted" style="margin-top:0">Exporte les 8 prochaines semaines (tâches et absences validées) en fichier .ics à ouvrir sur l’iPhone ou le Mac. Les noms sont en initiales, car ils s’affichent sur l’écran verrouillé et la montre.</p>
    <label class="check small"><input type="checkbox" id="ics-noms"> Noms complets</label>
    <div class="row" style="margin-top:10px"><button class="btn" data-act="export-ics">Exporter le calendrier</button></div>
  </section>

  <section class="card">
    <header><h2>Sauvegarde</h2></header>
    <div class="row">
      <button class="btn" data-act="export-json">Exporter (.json)</button>
      <label class="btn">Importer<input type="file" accept="application/json,.json" data-change="import-json" hidden></label>
    </div>
    <div class="row" style="margin-top:10px">
      <button class="btn small ghost" data-act="charger-exemple">Charger l’exemple</button>
      <button class="btn small danger" data-act="tout-effacer">Tout effacer sur cet appareil</button>
    </div>
    <p class="tiny faint" style="margin:10px 0 0">Version ${esc(globalThis.AM_VERSION ?? '')} · Données sur cet appareil : ${Math.round(JSON.stringify(store.data).length / 1024)} Ko.</p>
  </section>
  </div>`;
}
