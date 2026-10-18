// État partagé de l'application : données, préférences d'affichage, synchro, et raccourcis de lecture.

import { Store, sameData, uid } from '../core/store.js';
import { todayISO, mondayOf, isOuvre, addDays, dow, TERRITOIRES, territoireDuFuseau, fuseauAppareil, configurerFeries } from '../core/dates.js';
import { instances, conflits } from '../core/agenda.js';
import { absencesLe, nomComplet } from '../core/equipe.js';
import { analyser } from '../core/voix.js';
import { GitHubSync } from '../sync/github.js';
import { estImportAgenda, lireImport, planImport, instancesRdv } from '../core/agendaIphone.js';
import { buildIcs } from '../core/ics.js';

const CLE_DONNEES = 'am:donnees';
const CLE_SYNC = 'am:sync';
const CLE_UI = 'am:ui';

const lire = cle => { try { return JSON.parse(localStorage.getItem(cle) ?? 'null'); } catch { return null; } };
const ecrire = (cle, v) => { try { localStorage.setItem(cle, JSON.stringify(v)); return true; } catch { return false; } };

export const store = new Store(lire(CLE_DONNEES) ?? undefined);

// Territoire de l'agence (jours fériés) et fuseau horaire : réglés, sinon déduits de l'appareil.
export const territoire = () => store.reglages().territoire || territoireDuFuseau();
export const fuseau = () => (store.reglages().territoire ? TERRITOIRES[store.reglages().territoire]?.fuseau : null) || fuseauAppareil();
const appliquerFeries = () => configurerFeries({ territoire: territoire(), usages: store.reglages().usagesFeries ?? [] });
appliquerFeries();
store.onChange(appliquerFeries);

let saveTimer;
store.onChange(() => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!ecrire(CLE_DONNEES, store.data)) console.warn('Sauvegarde locale impossible (stockage plein ou privé).');
  }, 150);
});

const today0 = todayISO();
// Le week-end, le planning s'ouvre sur la semaine qui vient.
export const semaineParDefaut = d => (dow(d) >= 5 ? addDays(mondayOf(d), 7) : mondayOf(d));
export const ui = {
  vue: 'aujourdhui',
  semaine: semaineParDefaut(today0),
  jour: today0,
  filtreTaches: 'avenir',
  catsTaches: [],
  rechercheTaches: '',
  ongletEquipe: 'presence',
  debutPresence: mondayOf(today0),
  ...(lire(CLE_UI) ?? {}),
};
// Une réouverture le lendemain doit revenir sur la semaine en cours.
if (ui.jour < today0) { ui.jour = today0; ui.semaine = semaineParDefaut(today0); ui.debutPresence = mondayOf(today0); }
export const sauverUi = () => ecrire(CLE_UI, { filtreTaches: ui.filtreTaches, ongletEquipe: ui.ongletEquipe, catsTaches: ui.catsTaches });

export const today = () => todayISO();
export const equipe = () => store.list('equipe').sort((a, b) => (a.prenom + a.nom).localeCompare(b.prenom + b.nom, 'fr'));
export const equipeActive = () => equipe().filter(c => c.actif !== false);
export const absences = () => store.list('absences');
export const taches = () => store.list('taches');
export const rdvs = () => store.list('agenda');
// avecAgenda : ajoute les rendez-vous importés de l'iPhone (lecture seule).
export const insts = (from, to, { avecAgenda = false } = {}) => {
  const t = instances(taches(), from, to);
  if (!avecAgenda) return t;
  return [...t, ...instancesRdv(rdvs(), from, to)].sort((a, b) => (a.date + (a.debut || '99')).localeCompare(b.date + (b.debut || '99')));
};
export const absencesSur = d => absencesLe(absences(), d);
export const estOuvre = d => isOuvre(d);
const CAT_AGENDA = { id: '__agenda', nom: 'Agenda iPhone', couleur: '#8a919d', duree: 60 };
export const cat = id => (id === '__agenda' ? CAT_AGENDA : store.categorie(id));
export const collab = id => store.get('equipe', id);
export const nomCollab = (id, court = false) => { const c = collab(id); return !c ? '?' : court ? `${c.prenom} ${c.nom?.[0] ?? ''}.` : nomComplet(c); };
export const conflitsDe = t => (t.date ? conflits(t, insts(t.date, t.date, { avecAgenda: true }), absencesSur(t.date), equipe()) : []);

// ---------- Création depuis une phrase (saisie ou dictée) ----------
export function contexteAnalyse() {
  const r = store.reglages();
  return { today: today(), equipe: equipeActive(), categories: store.categories(), categorieDefaut: r.categorieDefaut };
}

// Applique une analyse : création directe si elle est sûre, sinon élément « À valider ».
// id déterministe pour les dictées (voix-<n°>) : un second traitement ne crée pas de doublon.
export function appliquerAnalyse(texte, analyse, { id = uid(), source = 'saisie', recu = new Date().toISOString() } = {}) {
  for (const col of ['taches', 'absences', 'memos', 'inbox']) if (store.data[col][id]) return { col: null, id };
  if (analyse.ok && analyse.action === 'tache') {
    store.put('taches', { id, titre: analyse.titre, cat: analyse.cat, date: analyse.date, debut: analyse.debut, fin: analyse.fin,
      collabs: analyse.collabs, statut: 'afaire', prio: 'normale', notes: '', source });
    return { col: 'taches', id };
  }
  if (analyse.ok && analyse.action === 'absence') {
    store.put('absences', { id, collab: analyse.collab, type: analyse.type, du: analyse.du, au: analyse.au,
      portionDebut: analyse.portionDebut, portionFin: analyse.portionFin, statut: 'validee', note: '', source });
    return { col: 'absences', id };
  }
  if (analyse.ok && analyse.action === 'memo') {
    store.put('memos', { id, texte: analyse.texte, date: today(), source });
    return { col: 'memos', id };
  }
  store.put('inbox', { id, texte, analyse, source, recu });
  return { col: 'inbox', id };
}

// ---------- Synchronisation ----------
export const sync = {
  etat: 'off', message: 'Synchro désactivée', derniere: null, enCours: false, listeners: new Set(),
  config() { return lire(CLE_SYNC); },
  configurer(cfg) { cfg ? ecrire(CLE_SYNC, cfg) : localStorage.removeItem(CLE_SYNC); this.set(cfg ? 'pret' : 'off', cfg ? 'Synchro prête' : 'Synchro désactivée'); },
  set(etat, message) { this.etat = etat; this.message = message; for (const fn of this.listeners) fn(); },
  onChange(fn) { this.listeners.add(fn); },

  async lancer() {
    const cfg = this.config();
    if (!cfg?.token) return this.set('off', 'Synchro désactivée');
    if (!navigator.onLine) return this.set('horsligne', 'Hors ligne : envoi au retour du réseau');
    if (this.enCours) { this.relancer = true; return; }
    this.enCours = true;
    this.set('encours', 'Synchronisation…');
    try {
      const gh = new GitHubSync(cfg);
      // 1. Dictées en attente → éléments locaux (ids déterministes).
      // Les issues « Agenda » viennent du Raccourci d'import de l'agenda iPhone.
      const dictees = await gh.dictees();
      let rdvImportes = null;
      for (const d of dictees) {
        if (!d.texte) continue;
        if (estImportAgenda(d.titre, d.texte)) rdvImportes = importerAgenda(d.texte, new Date(d.recu));
        else appliquerAnalyse(d.texte, analyser(d.texte, contexteAnalyse()), { id: `voix-${d.numero}`, source: 'montre', recu: d.recu });
      }
      // 2. Fusion avec le dépôt.
      const { data } = await gh.synchroniser(store.data);
      if (!sameData(data, store.data)) store.replace(data);
      // 3. Dictées clôturées seulement une fois enregistrées dans le dépôt.
      for (const d of dictees) await gh.cloreDictee(d.numero).catch(() => {});
      const nbDictees = dictees.filter(d => !estImportAgenda(d.titre, d.texte)).length;
      if (nbDictees) this.nouvellesDictees?.(nbDictees);
      if (rdvImportes) this.agendaImporte?.(rdvImportes);
      // 4. Calendrier abonné (iPhone, Mac, montre) : republié seulement s'il a changé.
      await publierCalendrierSiBesoin(gh);
      this.derniere = new Date();
      this.set('ok', `Synchronisé à ${this.derniere.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`);
    } catch (e) {
      this.set(navigator.onLine ? 'erreur' : 'horsligne', navigator.onLine ? e.message : 'Hors ligne : envoi au retour du réseau');
    } finally {
      this.enCours = false;
      if (this.relancer) { this.relancer = false; setTimeout(() => this.lancer(), 500); }
    }
  },
};
if (sync.config()?.token) sync.etat = 'pret';

// ---------- Agenda de l'iPhone ----------
// Applique un import du Raccourci (instantané des 31 prochains jours).
export function importerAgenda(texte, recu = new Date()) {
  const { rdv, ignores } = lireImport(texte, fuseau());
  const { ecrire: aEcrire, supprimer, total } = planImport(rdvs(), rdv, recu, undefined, fuseau());
  for (const r of aEcrire) store.put('agenda', r);
  for (const id of supprimer) store.remove('agenda', id);
  store.put('reglages', { ...(store.get('reglages', 'agendaIphone') ?? {}), id: 'agendaIphone', dernierImport: recu.toISOString(), total, ignores: ignores.length });
  return { total, ajoutes: aEcrire.length, supprimes: supprimer.length, ignores: ignores.length };
}

export function effacerAgendaImporte() { for (const r of rdvs()) store.remove('agenda', r.id); }

export const calendrier = {
  message: '',
  // Fenêtre publiée : 2 semaines passées, 4 mois à venir.
  contenu() {
    const d = today();
    const r = store.reglages();
    return buildIcs({ insts: insts(addDays(d, -14), addDays(d, 120)), absences: absences(), equipe: equipe(), categorie: cat,
      nomsComplets: !!r.calendrier?.nomsComplets, rappelMinutes: r.rappelMinutes, fuseau: fuseau() });
  },
};

async function publierCalendrierSiBesoin(gh) {
  const r = store.reglages();
  if (!r.calendrier?.actif) return;
  const ics = calendrier.contenu();
  const empreinte = `${r.calendrier.gistId ?? ''}:${ics.length}:${hashTexte(ics)}`;
  if (lire('am:ics') === empreinte) return;
  try {
    const res = await gh.publierCalendrier(ics, r.calendrier.gistId);
    if (res.gistId !== r.calendrier.gistId || res.url !== r.calendrier.url) {
      store.put('reglages', { ...store.reglages(), id: 'general', calendrier: { ...r.calendrier, gistId: res.gistId, url: res.url } });
      sync.relancer = true; // envoyer le lien aux autres appareils
    }
    ecrire('am:ics', `${res.gistId}:${ics.length}:${hashTexte(ics)}`);
    calendrier.message = `Calendrier publié à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  } catch (e) {
    calendrier.message = e.status === 403 || e.status === 404
      ? 'Calendrier non publié : ajoutez l’autorisation « Gists » (lecture et écriture) à votre clé d’accès.'
      : `Calendrier non publié : ${e.message}`;
  }
}
const hashTexte = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };

// Raccourcis de dates pour les vues.
export const semaineDe = iso => Array.from({ length: 7 }, (_, i) => addDays(mondayOf(iso), i));
