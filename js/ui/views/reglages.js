import { esc } from '../dom.js';
import { store, sync, rdvs, calendrier, territoire, fuseau } from '../ctx.js';
import { htmlBoutonsJumelage } from '../jumelage.js';
import { TERRITOIRES, USAGES, territoireDuFuseau, feries, fmtJour } from '../../core/dates.js';

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
      <label class="field f-6"><span>Territoire (jours fériés et fuseau horaire)</span><select data-change="territoire">
        <option value=""${r.territoire ? '' : ' selected'}>Automatique : ${esc(TERRITOIRES[territoireDuFuseau()].nom)} (d’après cet appareil)</option>
        ${Object.entries(TERRITOIRES).map(([k, t]) => `<option value="${k}"${r.territoire === k ? ' selected' : ''}>${esc(t.nom)}</option>`).join('')}</select></label>
      ${usagesHtml(r)}
      <label class="field f-3"><span>Catégorie par défaut</span><select data-change="reglage" data-k="categorieDefaut">${store.categories().map(c => `<option value="${esc(c.id)}"${c.id === r.categorieDefaut ? ' selected' : ''}>${esc(c.nom)}</option>`).join('')}</select></label>
    </div>
  </section>

  <section class="card span-2" id="synchro">
    <header><h2>Synchronisation Mac ↔ iPhone</h2><span class="pill ${sync.etat === 'ok' ? 'ok' : sync.etat === 'erreur' ? 'danger' : ''}">${esc(sync.message)}</span></header>
    <p class="small muted" style="margin-top:0">Chaque appareil (Mac, iPhone) fonctionne seul, même sans réseau. Dès qu’il est en ligne, il se synchronise automatiquement : à l’ouverture, après chaque modification et chaque minute. Les données sont copiées dans votre dépôt GitHub <b>privé</b>.</p>
    <div class="row" style="margin-bottom:10px">${htmlBoutonsJumelage(!!cfg.token)}${cfg.token ? '<button class="btn" type="button" data-act="sync-now">Synchroniser maintenant</button>' : ''}</div>
    ${cfg.token ? '' : '<p class="small muted" style="margin:0 0 8px">Nouvel appareil : sur le Mac déjà connecté, ouvrez Réglages → Synchronisation → <b>Connecter un autre appareil</b>, puis scannez le code ici.</p>'}
    <details><summary class="small" style="cursor:pointer;font-weight:600">${cfg.token ? 'Configuration de la connexion' : 'Première mise en place, sans autre appareil (3 minutes)'}</summary>
      <ol class="steps small">
        <li>Créez un dépôt <b>privé</b> nommé par exemple <code>agence-manager-donnees</code> (sans accent : GitHub remplace les accents par des tirets) : <a href="https://github.com/new" target="_blank" rel="noopener">github.com/new</a>.</li>
        <li>Créez une clé d’accès : <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">nouvelle clé « fine-grained »</a> → <i>Only select repositories</i> : ce dépôt uniquement → <i>Permissions</i> : <b>Contents</b> et <b>Issues</b> en <i>Read and write</i> → expiration 1 an.</li>
        <li>Saisissez ci-dessous le compte, le dépôt et la clé. Les autres appareils se connecteront ensuite par QR code.</li>
      </ol>
    <form class="fields" id="f-sync" autocomplete="off" style="margin-top:10px">
      <label class="field f-2"><span>Compte GitHub</span><input type="text" name="owner" value="${esc(cfg.owner ?? '')}" placeholder="elone693-jpg" autocapitalize="off" spellcheck="false" required></label>
      <label class="field f-2"><span>Dépôt de données</span><input type="text" name="repo" value="${esc(cfg.repo ?? 'agence-manager-donnees')}" autocapitalize="off" spellcheck="false" required></label>
      <label class="field f-2"><span>Clé d’accès</span><input type="password" name="token" value="${cfg.token ? '••••••••' : ''}" placeholder="github_pat_…" autocomplete="off" required></label>
      <div class="row f-6">
        <button class="btn${cfg.token ? '' : ' primary'}" type="submit">Enregistrer et tester</button>
        ${cfg.token ? '<button class="btn danger" type="button" data-act="sync-off">Déconnecter cet appareil</button>' : ''}
      </div>
    </form>
    </details>
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

  ${sectionAgenda(cfg)}

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

function sectionAgenda(cfg) {
  const cal = store.reglages().calendrier ?? {};
  const imp = store.get('reglages', 'agendaIphone');
  const nb = rdvs().length;
  const urlIssues = cfg.owner && cfg.repo ? `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/issues` : 'https://api.github.com/repos/<compte>/<dépôt>/issues';
  const webcal = cal.url ? cal.url.replace(/^https:/, 'webcal:') : '';
  return `<section class="card span-2" id="agenda-iphone">
    <header><h2>Agenda de l’iPhone</h2></header>
    ${!cfg.token ? '<div class="alert info">Activez d’abord la synchronisation ci-dessus : l’agenda passe par le même dépôt.</div>' : ''}

    <h3 style="margin:6px 0 6px">1. Vos tâches dans le Calendrier (iPhone, Mac, Apple Watch)</h3>
    <label class="check"><input type="checkbox" data-change="cal-actif" ${cal.actif ? 'checked' : ''} ${cfg.token ? '' : 'disabled'}> Publier mes tâches et absences dans un calendrier « AgenceManager »</label>
    ${cal.actif ? `
      <label class="check small" style="margin-top:6px"><input type="checkbox" data-change="cal-noms" ${cal.nomsComplets ? 'checked' : ''}> Noms complets (sinon initiales, recommandé : visibles sur l’écran verrouillé)</label>
      ${calendrier.message ? `<p class="small ${calendrier.message.includes('non publié') ? '' : 'muted'}" style="${calendrier.message.includes('non publié') ? 'color:var(--danger)' : ''}">${esc(calendrier.message)}</p>` : ''}
      ${cal.url ? `<div class="row" style="margin-top:8px;flex-wrap:nowrap"><input type="text" readonly value="${esc(cal.url)}" aria-label="Lien d’abonnement" style="font-size:12px">
          <button class="btn small" data-act="cal-copier">Copier</button></div>
        <div class="row" style="margin-top:8px"><a class="btn primary small" href="${esc(webcal)}">S’abonner sur cet appareil</a></div>`
        : '<p class="small muted">Le lien d’abonnement apparaîtra après la prochaine synchronisation.</p>'}
      <ol class="steps small">
        <li>Votre clé d’accès doit aussi avoir l’autorisation <b>Gists</b> en <i>Read and write</i> (rubrique <i>Account permissions</i>).</li>
        <li>Sur l’iPhone, touchez <b>S’abonner sur cet appareil</b> (ou Réglages → Apps → Calendrier → Comptes → Ajouter un compte → Autre → <i>Ajouter un calendrier avec abonnement</i>, puis collez le lien).</li>
        <li>Pour des mises à jour rapides : Réglages → Apps → Calendrier → Comptes → <b>Nouvelles données</b> → toutes les 15 minutes.</li>
        <li>L’Apple Watch affiche automatiquement les calendriers de l’iPhone.</li>
      </ol>
      <p class="tiny faint" style="margin:0">Le lien est secret mais pas protégé par mot de passe : ne le partagez pas. Il contient vos tâches (noms en initiales) et les absences sans leur motif ; les rendez-vous importés de l’iPhone n’y sont pas renvoyés.</p>` : ''}

    <h3 style="margin:18px 0 6px">2. Vos rendez-vous de l’iPhone dans AgenceManager</h3>
    <p class="small muted" style="margin-top:0">Un Raccourci envoie les rendez-vous des 31 prochains jours. Ils apparaissent hachurés dans le planning, en lecture seule, et sont pris en compte pour les conflits et les créneaux libres.</p>
    <div class="row small" style="margin-bottom:8px">
      ${imp?.dernierImport ? `<span class="pill ok">Dernier import : ${esc(new Date(imp.dernierImport).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }))}</span><span class="pill">${nb} rendez-vous</span>${imp.ignores ? `<span class="pill warn">${imp.ignores} ligne(s) illisible(s)</span>` : ''}` : '<span class="pill">Aucun import pour l’instant</span>'}
      ${nb ? '<button class="btn small ghost danger" data-act="agenda-effacer">Effacer les rendez-vous importés</button>' : ''}
    </div>
    <details><summary class="small" style="cursor:pointer;font-weight:600">Créer le Raccourci « Agenda vers AgenceManager » (5 minutes)</summary>
      <ol class="steps small">
        <li>App <b>Raccourcis</b> → <b>+</b> → action <b>Rechercher des évènements du calendrier</b> :
          filtre <i>Calendrier</i> <b>n’est pas</b> <i>AgenceManager</i> ; filtre <i>Date de début</i> <b>est dans les prochains</b> <i>31 jours</i> ; limite : désactivée.</li>
        <li>Action <b>Répéter avec chaque élément</b>, et dedans une action <b>Texte</b> contenant exactement :
          <pre class="code">[Date de début]|[Date de fin]|[Toute la journée]|[Calendrier]|[Titre]</pre>
          Pour chaque variable, touchez <i>Élément de la répétition</i> et choisissez la propriété. Pour les deux dates, choisissez le format <b>ISO 8601</b> avec l’heure.</li>
        <li>Après la répétition : action <b>Combiner le texte</b> (<i>Résultats de la répétition</i>, séparateur : <i>Nouvelle ligne</i>).</li>
        <li>Action <b>Texte</b> : première ligne <code>#AGENDA</code>, deuxième ligne la variable <i>Texte combiné</i>.</li>
        <li>Action <b>Obtenir le contenu de l’URL</b> :
          <pre class="code">URL : ${esc(urlIssues)}
Méthode : POST
En-têtes : Authorization = Bearer &lt;votre clé&gt;
           Accept = application/vnd.github+json
Corps (JSON) : title = Agenda
               body = [Texte]</pre></li>
        <li>Nommez-le <b>Agenda vers AgenceManager</b>. À la première exécution, autorisez l’accès au Calendrier.</li>
        <li><b>Automatique</b> : onglet <i>Automatisation</i> → <b>+</b> → <i>Heure de la journée</i> (ex. 7 h 30, tous les jours) → <i>Exécuter immédiatement</i> → choisissez ce raccourci. Ajoutez-en une seconde à 13 h si vous le souhaitez.</li>
      </ol>
      <p class="tiny faint" style="margin:0">Choisissez dans le filtre les seuls calendriers utiles. Si votre iPhone contient l’agenda professionnel de l’entreprise, vérifiez que sa copie dans votre dépôt privé est autorisée.</p>
    </details>
    <details style="margin-top:8px"><summary class="small" style="cursor:pointer">Importer à la main (essai)</summary>
      <textarea id="agenda-test" placeholder="#AGENDA&#10;2026-10-20T14:00:00+02:00|2026-10-20T15:00:00+02:00|Non|Travail|Comité" style="margin-top:8px;font-family:ui-monospace,monospace;font-size:12px"></textarea>
      <button class="btn small" data-act="agenda-test" style="margin-top:6px">Importer ce texte</button>
    </details>
  </section>`;
}

function usagesHtml(r) {
  const t = territoire();
  const dispo = USAGES.filter(u => u.territoires.includes(t));
  const an = new Date().getFullYear();
  const legaux = Object.entries(feries(an, { territoire: t, usages: [] })).filter(([d]) => !(d in feries(an, { territoire: 'metropole', usages: [] })));
  return `<div class="f-6 small">
    <div class="muted">Fuseau horaire : <b>${esc(fuseau())}</b>${legaux.length ? ` · Férié${legaux.length > 1 ? 's' : ''} propre${legaux.length > 1 ? 's' : ''} : ${legaux.map(([d, n]) => `${esc(n)} (${esc(fmtJour(d))})`).join(', ')}` : ''}</div>
    ${dispo.length ? `<div style="margin-top:8px;font-weight:600" class="muted">Jours chômés d’usage dans votre agence :</div>
      <div class="chips" style="margin-top:6px">${dispo.map(u => `<label class="chip" style="cursor:pointer"><input type="checkbox" data-change="usage-ferie" data-u="${u.id}" ${(r.usagesFeries ?? []).includes(u.id) ? 'checked' : ''} style="accent-color:var(--accent)"> ${esc(u.nom)}</label>`).join('')}</div>
      <div class="tiny faint" style="margin-top:4px">Selon votre accord d’entreprise. Ces jours sont traités comme fériés (planning, créneaux libres, effectif).</div>` : ''}
  </div>`;
}
