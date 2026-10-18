// État partagé de l'application : données, préférences d'affichage, synchro, et raccourcis de lecture.

import { Store, sameData, uid } from '../core/store.js';
import { todayISO, mondayOf, isOuvre, addDays, dow } from '../core/dates.js';
import { instances, conflits } from '../core/agenda.js';
import { absencesLe, nomComplet } from '../core/equipe.js';
import { analyser } from '../core/voix.js';
import { GitHubSync } from '../sync/github.js';

const CLE_DONNEES = 'am:donnees';
const CLE_SYNC = 'am:sync';
const CLE_UI = 'am:ui';

const lire = cle => { try { return JSON.parse(localStorage.getItem(cle) ?? 'null'); } catch { return null; } };
const ecrire = (cle, v) => { try { localStorage.setItem(cle, JSON.stringify(v)); return true; } catch { return false; } };

export const store = new Store(lire(CLE_DONNEES) ?? undefined);

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
export const insts = (from, to) => instances(taches(), from, to);
export const absencesSur = d => absencesLe(absences(), d);
export const estOuvre = d => isOuvre(d);
export const cat = id => store.categorie(id);
export const collab = id => store.get('equipe', id);
export const nomCollab = (id, court = false) => { const c = collab(id); return !c ? '?' : court ? `${c.prenom} ${c.nom?.[0] ?? ''}.` : nomComplet(c); };
export const conflitsDe = t => (t.date ? conflits(t, insts(t.date, t.date), absencesSur(t.date), equipe()) : []);

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
      const dictees = await gh.dictees();
      for (const d of dictees) {
        if (d.texte) appliquerAnalyse(d.texte, analyser(d.texte, contexteAnalyse()), { id: `voix-${d.numero}`, source: 'montre', recu: d.recu });
      }
      // 2. Fusion avec le dépôt.
      const { data } = await gh.synchroniser(store.data);
      if (!sameData(data, store.data)) store.replace(data);
      // 3. Dictées clôturées seulement une fois enregistrées dans le dépôt.
      for (const d of dictees) await gh.cloreDictee(d.numero).catch(() => {});
      if (dictees.length) this.nouvellesDictees?.(dictees.length);
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

// Raccourcis de dates pour les vues.
export const semaineDe = iso => Array.from({ length: 7 }, (_, i) => addDays(mondayOf(iso), i));
