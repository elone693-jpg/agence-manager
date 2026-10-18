// Point d'entrée : navigation, actions de l'interface, saisie/dictée, synchro automatique.

import { store, ui, sauverUi, sync, today, insts, absences, absencesSur, estOuvre, equipe, collab, cat, nomCollab, contexteAnalyse, appliquerAnalyse, conflitsDe, importerAgenda, effacerAgendaImporte, fuseau } from './ui/ctx.js';
import { $, esc, toast, ouvrirDialogue, confirmer, telecharger, ICONES } from './ui/dom.js';
import { ouvrirTache, ouvrirAbsence, ouvrirCollab } from './ui/forms.js';
import { basculerFait } from './ui/views/commun.js';
import * as vAujourdhui from './ui/views/aujourdhui.js';
import * as vPlanning from './ui/views/planning.js';
import * as vTaches from './ui/views/taches.js';
import * as vEquipe from './ui/views/equipe.js';
import * as vObligations from './ui/views/obligations.js';
import * as vAValider from './ui/views/avalider.js';
import * as vReglages from './ui/views/reglages.js';
import { analyser } from './core/voix.js';
import { creneauLibre } from './core/agenda.js';
import { addDays, fmtJour, fmtHeure, toMin } from './core/dates.js';
import { buildIcs } from './core/ics.js';
import { emptyData, merge } from './core/store.js';
import { donneesExemple } from './ui/exemple.js';
import { typeAbsence } from './core/equipe.js';

const VERSION = '1.1.1';
globalThis.AM_VERSION = VERSION;

const VUES = {
  aujourdhui: { mod: vAujourdhui, nom: 'Aujourd’hui', icone: ICONES.aujourdhui },
  planning: { mod: vPlanning, nom: 'Planning', icone: ICONES.planning },
  taches: { mod: vTaches, nom: 'Tâches', icone: ICONES.taches },
  equipe: { mod: vEquipe, nom: 'Équipe', icone: ICONES.equipe },
  obligations: { mod: vObligations, nom: 'Obligations', icone: ICONES.obligations },
  avalider: { mod: vAValider, nom: 'À valider', icone: ICONES.avalider },
  reglages: { mod: vReglages, nom: 'Réglages', icone: ICONES.reglages },
};
const ONGLETS_MOBILE = ['aujourdhui', 'planning', 'taches', 'equipe', 'plus'];

// ---------- Thème ----------
function appliquerTheme() {
  let t = 'auto';
  try { t = localStorage.getItem('am:theme') || 'auto'; } catch { /* stockage indisponible */ }
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t === 'sombre' ? 'dark' : 'light';
}
appliquerTheme();

// ---------- Navigation ----------
function lireRoute() {
  const [, vue = 'aujourdhui', query = ''] = location.hash.match(/^#\/([a-z]+)\??(.*)$/) ?? [];
  ui.vue = VUES[vue] ? vue : vue === 'plus' ? 'plus' : 'aujourdhui';
  const f = new URLSearchParams(query).get('f');
  if (f && ui.vue === 'taches') ui.filtreTaches = f;
}

function rendreNav() {
  const inbox = store.list('inbox').length;
  const lien = (id, mobile = false) => {
    const v = VUES[id];
    const courant = ui.vue === id || (mobile && id === 'plus' && ['obligations', 'avalider', 'reglages'].includes(ui.vue));
    if (id === 'plus') return `<a href="#/plus" ${courant ? 'aria-current="page"' : ''}>${ICONES.plusMenu}<span>Plus</span>${inbox ? `<span class="badge">${inbox}</span>` : ''}</a>`;
    const b = id === 'avalider' && inbox ? `<span class="badge">${inbox}</span>` : '';
    return `<a href="#/${id}" ${courant ? 'aria-current="page"' : ''}>${v.icone}<span>${v.nom}</span>${b}</a>`;
  };
  $('#nav').innerHTML = Object.keys(VUES).map(id => lien(id)).join('');
  $('#tabbar').innerHTML = ONGLETS_MOBILE.map(id => lien(id, true)).join('');
}

function vuePlus() {
  return `<div class="stack">${['obligations', 'avalider', 'reglages'].map(id => `<a class="card row" href="#/${id}" style="text-decoration:none;color:inherit">${VUES[id].icone}<b>${VUES[id].nom}</b><span class="spacer"></span>${id === 'avalider' && store.list('inbox').length ? `<span class="badge">${store.list('inbox').length}</span>` : ''}<span class="faint">›</span></a>`).join('')}</div>`;
}

let rafRendu = 0;
function rendre() {
  cancelAnimationFrame(rafRendu);
  rafRendu = requestAnimationFrame(() => {
    // Conserver le focus d'un champ de recherche pendant la frappe.
    const actif = document.activeElement?.dataset?.input;
    const sel = actif ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
    const v = VUES[ui.vue];
    $('#title').textContent = v ? v.mod.titre() : 'Plus';
    document.title = `${v ? v.nom : 'Plus'} · AgenceManager`;
    $('#view').innerHTML = v ? v.mod.render() : vuePlus();
    v?.mod.apresRendu?.();
    rendreNav();
    rendreSync();
    if (actif) { const el = document.querySelector(`[data-input="${actif}"]`); if (el) { el.focus(); el.setSelectionRange(...sel); } }
  });
}

function rendreSync() {
  const b = $('#sync-state');
  b.dataset.etat = sync.etat;
  b.querySelector('span').textContent = sync.message;
  b.title = sync.etat === 'erreur' ? sync.message : 'Synchroniser maintenant';
}

window.addEventListener('hashchange', () => { lireRoute(); window.scrollTo(0, 0); rendre(); });
matchMedia('(max-width: 860px)').addEventListener('change', rendre);
store.onChange(rendre);
sync.onChange(() => { rendreSync(); if (ui.vue === 'reglages') rendre(); });

// ---------- Actions ----------
const ACTIONS = {
  'nouvelle-tache': el => ouvrirTache({ preset: { date: el.dataset.date ?? today() } }),
  'ouvrir-tache': el => ouvrirTache({ id: el.dataset.id, occ: el.dataset.occ || null }),
  'ouvrir-rdv': el => ouvrirRdv(el.dataset.id),
  'basculer-fait': el => basculerFait(el.dataset.id, el.dataset.occ || null),
  'creer-ici': (el, e) => {
    if (e.target !== el) return;
    const min = Number(el.dataset.hmin) * 60 + Math.floor((e.offsetY / 52) * 2) * 30;
    ouvrirTache({ preset: { date: el.dataset.date, debut: `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}` } });
  },
  semaine: el => { vPlanning.changerSemaine(Number(el.dataset.delta)); rendre(); },
  'choisir-jour': el => { ui.jour = el.dataset.date; rendre(); },
  'filtre-taches': el => { ui.filtreTaches = el.dataset.f; sauverUi(); history.replaceState(null, '', '#/taches'); rendre(); },
  'filtre-cat': el => { const c = el.dataset.cat; ui.catsTaches = ui.catsTaches.includes(c) ? ui.catsTaches.filter(x => x !== c) : [...ui.catsTaches, c]; sauverUi(); rendre(); },
  'onglet-equipe': el => { ui.ongletEquipe = el.dataset.o; sauverUi(); rendre(); },
  presence: el => { vEquipe.deplacerPresence(Number(el.dataset.delta)); rendre(); },
  'nouveau-collab': () => ouvrirCollab(),
  'ouvrir-collab': el => ouvrirCollab({ id: el.dataset.id }),
  'nouvelle-absence': el => ouvrirAbsence({ preset: { ...(el.dataset.collab ? { collab: el.dataset.collab } : {}), ...(el.dataset.date ? { du: el.dataset.date, au: el.dataset.date } : {}) } }),
  'ouvrir-absence': el => ouvrirAbsence({ id: el.dataset.id }),
  'valider-absence': el => { store.patch('absences', el.dataset.id, { statut: 'validee' }); toast('Absence validée'); },
  'planifier-oblig': el => planifierObligation(el.dataset.oblig, el.dataset.collab || null),
  'inbox-ouvrir': el => ouvrirDictee(el.dataset.id),
  'inbox-choisir': el => choisirCandidat(el.dataset.id, el.dataset.collab),
  'inbox-suppr': el => { const it = store.get('inbox', el.dataset.id); store.remove('inbox', el.dataset.id); toast('Dictée supprimée', { action: 'Annuler', onAction: () => store.put('inbox', { ...it, id: el.dataset.id }) }); },
  'memo-en-tache': el => { const m = store.get('memos', el.dataset.id); ouvrirTache({ preset: { titre: m.texte, date: '' }, onSave: () => store.remove('memos', el.dataset.id) }); },
  'suppr-memo': el => store.remove('memos', el.dataset.id),
  'sync-now': () => { if (!sync.config()) { location.hash = '#/reglages'; return; } sync.lancer(); },
  'sync-off': async () => { if (await confirmer('Déconnecter cet appareil de la synchro ? Les données restent sur l’appareil.')) { sync.configurer(null); rendre(); } },
  'cal-copier': async () => { try { await navigator.clipboard.writeText(store.reglages().calendrier?.url ?? ''); toast('Lien copié'); } catch { toast('Copie impossible : sélectionnez le lien à la main.'); } },
  'agenda-effacer': async () => { if (await confirmer('Effacer tous les rendez-vous importés de l’iPhone ? Ils reviendront au prochain import.')) { effacerAgendaImporte(); toast('Rendez-vous importés effacés'); } },
  'agenda-test': () => {
    const t = $('#agenda-test')?.value ?? '';
    if (!t.trim()) return toast('Collez d’abord un texte d’import.');
    const r = importerAgenda(t);
    toast(`${r.total} rendez-vous importé(s)${r.ignores ? `, ${r.ignores} ligne(s) illisible(s)` : ''}`);
  },
  'ajout-cat': () => { const r = store.reglages(); store.put('reglages', { ...r, id: 'general', categories: [...r.categories, { id: `cat-${Date.now().toString(36)}`, nom: 'Nouvelle catégorie', couleur: '#6b8e23', duree: 60, objectifMois: 0, mots: [] }] }); },
  'export-ics': () => exporterIcs(),
  'export-json': () => telecharger(`agence-manager-${today()}.json`, JSON.stringify(store.data, null, 1), 'application/json'),
  'charger-exemple': async () => {
    if (equipe().length && !(await confirmer('Ajouter les données d’exemple à vos données actuelles ?'))) return;
    donneesExemple(store); toast('Exemple chargé'); location.hash = '#/planning';
  },
  'tout-effacer': async () => {
    if (!(await confirmer(sync.config() ? 'Effacer les données de cet appareil ? Celles du dépôt reviendront à la prochaine synchro : déconnectez d’abord la synchro pour repartir de zéro.' : 'Effacer toutes les données de cet appareil ? Exportez une sauvegarde avant.', { ok: 'Effacer', danger: true }))) return;
    store.replace(emptyData()); toast('Données effacées');
  },
  capture: () => ouvrirCapture(),
  dicter: el => dicter(el.closest('form').querySelector('input[name="texte"]')),
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || !ACTIONS[el.dataset.act]) return;
  if (el.tagName === 'A') e.preventDefault();
  e.stopPropagation();
  ACTIONS[el.dataset.act](el, e);
});

document.addEventListener('input', e => {
  if (e.target.dataset.input === 'recherche-taches') { ui.rechercheTaches = e.target.value; rendre(); }
});

document.addEventListener('change', async e => {
  const el = e.target, k = el.dataset.change;
  if (!k) return;
  const r = store.reglages();
  if (k === 'reglage') store.put('reglages', { ...r, id: 'general', [el.dataset.k]: el.dataset.num != null ? Number(el.value) : el.value });
  if (k === 'theme') { try { localStorage.setItem('am:theme', el.value); } catch { /* ignoré */ } appliquerTheme(); }
  if (k === 'cat') {
    const cats = r.categories.map((c, i) => (i === Number(el.dataset.i)
      ? { ...c, [el.dataset.k]: el.dataset.k === 'mots' ? el.value.split(',').map(s => s.trim()).filter(Boolean) : el.dataset.num != null ? Number(el.value) : el.value } : c));
    store.put('reglages', { ...r, id: 'general', categories: cats });
  }
  if (k === 'cal-actif') {
    store.put('reglages', { ...r, id: 'general', calendrier: { ...(r.calendrier ?? {}), actif: el.checked } });
    if (el.checked) { toast('Publication du calendrier…'); sync.lancer(); }
  }
  if (k === 'territoire') store.put('reglages', { ...r, id: 'general', territoire: el.value, usagesFeries: [] });
  if (k === 'usage-ferie') {
    const u = new Set(r.usagesFeries ?? []);
    el.checked ? u.add(el.dataset.u) : u.delete(el.dataset.u);
    store.put('reglages', { ...r, id: 'general', usagesFeries: [...u] });
  }
  if (k === 'cal-noms') store.put('reglages', { ...r, id: 'general', calendrier: { ...(r.calendrier ?? {}), nomsComplets: el.checked } });
  if (k === 'oblig-actif') store.patch('obligations', el.dataset.id, { actif: el.checked });
  if (k === 'oblig-periode') store.patch('obligations', el.dataset.id, { periodeMois: Math.max(1, Number(el.value) || 1) });
  if (k === 'oblig-alerte') store.patch('obligations', el.dataset.id, { alerteJours: Math.max(0, Number(el.value) || 0) });
  if (k === 'import-json') {
    try {
      const data = JSON.parse(await el.files[0].text());
      store.replace(merge(store.data, data)); toast('Sauvegarde importée et fusionnée');
    } catch { toast('Fichier illisible.'); }
  }
});

document.addEventListener('submit', async e => {
  if (e.target.id !== 'f-sync') return;
  e.preventDefault();
  const v = Object.fromEntries(new FormData(e.target));
  const ancien = sync.config();
  const token = v.token.includes('•') ? ancien?.token : v.token.trim();
  if (!token) return toast('Collez la clé d’accès.');
  const { GitHubSync, nomDepot, nomCompte } = await import('./sync/github.js');
  const cfg = { owner: nomCompte(v.owner), repo: nomDepot(v.repo), token };
  // Le nom corrigé reste visible dans le champ, même si un message d'erreur suit.
  e.target.elements.owner.value = cfg.owner;
  e.target.elements.repo.value = cfg.repo;
  try {
    await new GitHubSync(cfg).verifier();
    sync.configurer(cfg);
    toast('Connexion réussie, synchronisation…');
    await sync.lancer();
  } catch (err) { toast(err.message || 'Échec de la connexion.', { duree: 7000 }); }
});

// ---------- Obligations ----------
function planifierObligation(obligId, collabId) {
  const o = store.get('obligations', obligId);
  const c = collabId ? collab(collabId) : null;
  const r = store.reglages();
  const d = today();
  const slot = creneauLibre({ depuis: addDays(d, 1), duree: o.duree ?? 60, collabs: c ? [c.id] : [], insts: insts(d, addDays(d, 45), { avecAgenda: true }),
    absencesSur, estOuvre, heureDebut: r.heureDebut, heureFin: r.heureFin });
  ouvrirTache({ preset: { titre: c ? `${o.titre} — ${c.prenom}` : o.titre, cat: o.cat, oblig: o.id, collabs: c ? [c.id] : [], date: slot?.date ?? '', debut: slot?.debut ?? '', fin: slot?.fin ?? '' } });
  if (slot) toast(`Créneau proposé : ${fmtJour(slot.date)} à ${fmtHeure(slot.debut)}`);
}

// ---------- Rendez-vous importés de l'iPhone ----------
function ouvrirRdv(id) {
  const r = store.get('agenda', id);
  if (!r) return;
  const imp = store.get('reglages', 'agendaIphone');
  const quand = r.journee ? `${fmtJour(r.date)}${r.jusqu ? ` → ${fmtJour(r.jusqu)}` : ''} · journée` : `${fmtJour(r.date)} · ${fmtHeure(r.debut)}${r.fin ? `–${fmtHeure(r.fin)}` : ''}`;
  ouvrirDialogue(`
    <div class="dlg-head"><h2>📅 ${esc(r.titre)}</h2><button class="btn icon ghost" data-close aria-label="Fermer">${ICONES.fermer}</button></div>
    <div class="dlg-body">
      <div><b>${esc(quand)}</b></div>
      <div class="small muted">Calendrier « ${esc(r.calendrier || '?')} » de l’iPhone${imp?.dernierImport ? ` · importé le ${esc(new Date(imp.dernierImport).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }))}` : ''}</div>
      <p class="small muted" style="margin:0">Pour le modifier, changez-le dans le Calendrier de l’iPhone : il sera mis à jour au prochain import.</p>
    </div>
    <div class="dlg-foot"><span class="spacer"></span><button class="btn" data-close>Fermer</button>
      <button class="btn primary" data-copier>Créer une tâche liée</button></div>`, {
    onMount: (dlg, fermer) => {
      dlg.querySelector('[data-copier]').onclick = () => {
        fermer();
        setTimeout(() => ouvrirTache({ preset: { titre: `Préparer : ${r.titre}`, date: r.date, debut: '', fin: '' } }), 0);
      };
    },
  });
}

// ---------- Dictées à valider ----------
function ouvrirDictee(id) {
  const it = store.get('inbox', id);
  const a = it.analyse ?? {};
  const retirer = () => store.remove('inbox', id);
  if (a.action === 'absence') return ouvrirAbsence({ preset: { collab: a.collab ?? undefined, type: a.type, du: a.du, au: a.au, portionDebut: a.portionDebut, portionFin: a.portionFin }, onSave: retirer });
  if (a.action === 'memo') { store.put('memos', { texte: a.texte, date: today() }); return retirer(); }
  ouvrirTache({ preset: { titre: a.titre ?? it.texte, cat: a.cat, date: a.date ?? '', debut: a.debut ?? '', fin: a.fin ?? '', collabs: a.collabs ?? [] }, onSave: retirer });
}

function choisirCandidat(id, collabId) {
  const it = store.get('inbox', id);
  const a = { ...it.analyse };
  if (a.action === 'absence') a.collab = collabId; else a.collabs = [...new Set([...(a.collabs ?? []), collabId])];
  a.candidats = [];
  a.raisons = (a.raisons ?? []).filter(r => !r.startsWith('plusieurs'));
  a.ok = !a.raisons.length;
  if (a.ok) {
    store.remove('inbox', id);
    appliquerAnalyse(it.texte, a, { source: it.source });
    toast(a.action === 'absence' ? 'Absence ajoutée' : `Ajouté : ${a.titre}`);
  } else store.put('inbox', { ...it, id, analyse: a });
}

// ---------- Saisie en langage naturel ----------
function resumer(a) {
  if (a.action === 'memo') return `→ Mémo : ${esc(a.texte)}`;
  const raisons = a.raisons?.length ? `<div style="color:var(--warn);margin-top:4px">À valider : ${esc(a.raisons.join(', '))}</div>` : '';
  if (a.action === 'absence') {
    return `→ <b>Absence</b> · ${esc(a.collab ? nomCollab(a.collab) : '?')} · ${esc(typeAbsence(a.type).nom)}${a.du ? ` · ${esc(fmtJour(a.du))}${a.au !== a.du ? ` → ${esc(fmtJour(a.au))}` : ''}` : ''}${a.portionDebut !== 'journee' ? ` (${a.portionDebut === 'matin' ? 'matin' : 'après-midi'})` : ''}${raisons}`;
  }
  const cs = a.date ? conflitsDe({ ...a, key: '__apercu', statut: 'afaire' }) : [];
  const alerte = cs.length ? `<div style="color:var(--danger);margin-top:4px">⚠ ${esc(cs.map(c => c.texte).join(' · '))}</div>` : '';
  return `${alerte}→ <b>${esc(a.titre)}</b> · <span class="dot" style="--c:${esc(cat(a.cat).couleur)};display:inline-block"></span> ${esc(cat(a.cat).nom)}${a.catDevinee ? ' <span class="faint">(par défaut)</span>' : ''}
    · ${a.date ? esc(fmtJour(a.date)) : 'sans date'}${a.debut ? ` · ${esc(fmtHeure(a.debut))}–${esc(fmtHeure(a.fin))}` : ''}${a.collabs?.length ? ` · ${esc(a.collabs.map(id => nomCollab(id)).join(', '))}` : ''}${raisons}`;
}

function brancherCapture(form, apres) {
  const input = form.querySelector('input[name="texte"]');
  const preview = form.querySelector('.preview');
  const maj = () => {
    const t = input.value.trim();
    preview.hidden = t.length < 3;
    if (!preview.hidden) preview.innerHTML = resumer(analyser(t, contexteAnalyse()));
  };
  input.addEventListener('input', maj);
  input.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== input) preview.hidden = true; }, 200));
  input.addEventListener('focus', maj);
  form.addEventListener('submit', e => {
    e.preventDefault();
    const t = input.value.trim();
    if (!t) return;
    const a = analyser(t, contexteAnalyse());
    const res = appliquerAnalyse(t, a);
    input.value = ''; preview.hidden = true;
    apres?.();
    if (res.col === 'inbox') toast(`À valider : ${a.raisons.join(', ') || 'phrase non comprise'}`, { action: 'Voir', onAction: () => { location.hash = '#/avalider'; } });
    else {
      const label = res.col === 'taches' ? `Ajouté : ${a.titre}${a.date ? `, ${fmtJour(a.date)}` : ''}${a.debut ? ` ${fmtHeure(a.debut)}` : ''}` : res.col === 'absences' ? 'Absence ajoutée' : 'Mémo ajouté';
      toast(label, { action: 'Annuler', onAction: () => store.remove(res.col, res.id) });
    }
  });
  input.dispatchEvent(new Event('input'));
}

function ouvrirCapture() {
  ouvrirDialogue(`
    <div class="dlg-head"><h2>Ajouter</h2><button class="btn icon ghost" data-close aria-label="Fermer">${ICONES.fermer}</button></div>
    <form class="dlg-body" id="capture-dlg" autocomplete="off" style="position:relative">
      <div class="row" style="flex-wrap:nowrap">
        <input type="text" name="texte" placeholder="« Coaching Marc jeudi 10h »" autofocus enterkeyhint="done" aria-label="Phrase à ajouter">
        <button class="btn icon" type="button" data-act="dicter" aria-label="Dicter"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>
      </div>
      <div class="preview" hidden style="position:static"></div>
      <div class="row"><button class="btn primary" type="submit">Ajouter</button><span class="spacer"></span>
        <button class="btn small ghost" type="button" data-close data-act="nouvelle-tache" data-date="${today()}">Formulaire complet</button></div>
      <p class="tiny faint" style="margin:0">Astuce : sur iPhone, le micro du clavier permet aussi de dicter.</p>
    </form>`, { onMount: (dlg, fermer) => brancherCapture(dlg.querySelector('#capture-dlg'), fermer) });
}

function dicter(input) {
  const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  if (!SR) { input.focus(); toast('Utilisez le micro du clavier pour dicter.'); return; }
  const rec = new SR();
  rec.lang = 'fr-FR'; rec.interimResults = true; rec.maxAlternatives = 1;
  rec.onresult = ev => { input.value = [...ev.results].map(r => r[0].transcript).join(' '); input.dispatchEvent(new Event('input')); };
  rec.onerror = ev => toast(ev.error === 'not-allowed' ? 'Micro non autorisé.' : 'Dictée interrompue.');
  rec.onend = () => input.focus();
  rec.start();
  toast('Parlez…', { duree: 2500 });
}

// ---------- Export calendrier ----------
function exporterIcs() {
  const d = today(), fin = addDays(d, 56);
  const ics = buildIcs({
    insts: insts(d, fin), equipe: equipe(), categorie: cat, nomsComplets: $('#ics-noms')?.checked,
    absences: absences().filter(a => a.du <= fin && (a.au || a.du) >= d), rappelMinutes: store.reglages().rappelMinutes, fuseau: fuseau(),
  });
  telecharger(`agence-manager-${d}.ics`, ics, 'text/calendar');
}

// ---------- Synchro automatique ----------
let syncTimer;
const planifierSync = (delai = 2000) => { clearTimeout(syncTimer); syncTimer = setTimeout(() => sync.lancer(), delai); };
store.onChange(() => { if (!sync.enCours && sync.config()) planifierSync(); });
sync.agendaImporte = r => toast(`Agenda iPhone : ${r.total} rendez-vous à jour${r.supprimes ? `, ${r.supprimes} retiré(s)` : ''}`);
sync.nouvellesDictees = n => toast(`${n} dictée(s) reçue(s) de la montre`, { action: 'Voir', onAction: () => { location.hash = store.list('inbox').length ? '#/avalider' : '#/planning'; } });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { rendre(); planifierSync(300); } });
window.addEventListener('online', () => planifierSync(300));
setInterval(() => { if (document.visibilityState === 'visible') sync.lancer(); }, 60000);

// ---------- Démarrage ----------
lireRoute();
brancherCapture($('#capture-top'));
document.addEventListener('keydown', e => {
  if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !$('#dlg').open) { e.preventDefault(); ouvrirTache({ preset: { date: today() } }); }
  if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); $('#capture-top input').focus(); }
});
rendre();
if (sync.config()) planifierSync(200);
// Hors ligne uniquement en production (HTTPS) : en local, le cache masquerait les modifications.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  // Nouvelle version installée : recharger une fois pour l'utiliser tout de suite.
  const avaitUneVersion = !!navigator.serviceWorker.controller;
  let recharge = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!avaitUneVersion || recharge || $('#dlg').open) return;
    recharge = true;
    location.reload();
  });
  navigator.serviceWorker.register('sw.js').then(reg => {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
}
