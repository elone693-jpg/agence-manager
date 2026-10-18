// Données d'exemple, recalées sur la semaine en cours, pour essayer l'app.
import { addDays, dow, mondayOf, todayISO } from '../core/dates.js';

export function donneesExemple(store) {
  // Le week-end, l'exemple démarre la semaine suivante pour montrer des tâches à venir.
  const l = dow(todayISO()) >= 5 ? addDays(mondayOf(todayISO()), 7) : mondayOf(todayISO());
  const j = n => addDays(l, n);
  const c = {};
  for (const [k, prenom, nom, poste, entree, couleur] of [
    ['marc', 'Marc', 'Durand', 'Conseiller', '2019-04-01', '#4d57d1'],
    ['carla', 'Carla', 'Petit', 'Chargée de clientèle', '2022-09-12', '#2fb38a'],
    ['lea1', 'Léa', 'Martin', 'Conseillère', '2026-02-02', '#e3a33b'],
    ['lea2', 'Léa', 'Bernard', 'Conseillère', '2017-06-19', '#e26d8c'],
    ['sandra', 'Sandra', 'Koné', 'Gestionnaire sinistres', '2021-01-04', '#8b7cf6'],
    ['thomas', 'Thomas', 'Leroy', 'Alternant', '2026-09-01', '#4a9fe8'],
  ]) c[k] = store.put('equipe', { prenom, nom, poste, entree, couleur, actif: true, dda: k !== 'thomas' });

  const t = (titre, catId, date, debut, fin, collabs = [], extra = {}) =>
    store.put('taches', { titre, cat: catId, date, debut, fin, collabs: collabs.map(k => c[k]), statut: 'afaire', prio: 'normale', notes: '', ...extra });
  t('Double écoute', 'coaching', j(0), '09:00', '10:30', ['marc'], { oblig: 'coaching' });
  t('Entretien de suivi', 'entretien', j(1), '09:00', '10:00', ['carla']);
  t('Visa contrats trimestriels', 'admin', j(1), '14:00', '16:00', [], { oblig: 'visa', prio: 'haute' });
  t('Révision technique produits MRH', 'revision', j(2), '10:00', '12:00');
  t('1:1', 'entretien', j(2), '15:00', '15:30', ['sandra']);
  t('Double écoute', 'coaching', j(3), '09:00', '10:30', ['lea1'], { oblig: 'coaching' });
  t('Reporting mensuel agence', 'admin', j(4), '10:00', '12:00', [], { oblig: 'reporting' });
  t('Debrief équipe', 'reunion', j(4), '15:00', '16:00', [], { rec: { freq: 'hebdo' } });
  t('Brief du lundi', 'reunion', j(0), '08:30', '09:00', [], { rec: { freq: 'hebdo' } });
  t('Double écoute', 'coaching', j(-5), '09:00', '10:00', ['sandra'], { oblig: 'coaching', statut: 'fait', faitLe: j(-5) });
  t('Entretien de parcours professionnel', 'entretien', '2023-03-14', '10:00', '11:30', ['marc'], { oblig: 'epp', statut: 'fait', faitLe: '2023-03-14' });
  t('Préparer le plan de formation 2027', 'admin', '', '', '');
  t('Relancer le service sinistres', 'admin', j(-2), '', '', [], { prio: 'urgente' });

  store.put('absences', { collab: c.carla, type: 'conges', du: j(7), au: j(11), portionDebut: 'journee', portionFin: 'journee', statut: 'validee', note: '' });
  store.put('absences', { collab: c.lea2, type: 'formation', du: j(2), au: j(2), portionDebut: 'journee', portionFin: 'journee', statut: 'validee', heures: 7, note: '' });
  store.put('absences', { collab: c.sandra, type: 'rtt', du: j(4), au: j(4), portionDebut: 'apresmidi', portionFin: 'apresmidi', statut: 'validee', note: '' });
  store.put('absences', { collab: c.marc, type: 'conges', du: j(14), au: j(18), portionDebut: 'journee', portionFin: 'journee', statut: 'demandee', note: '' });
  store.put('absences', { collab: c.thomas, type: 'formation', du: j(9), au: j(10), portionDebut: 'journee', portionFin: 'journee', statut: 'validee', note: 'École' });
  store.put('memos', { texte: 'Commander des fournitures pour l’accueil', date: todayISO() });
  store.put('inbox', { texte: 'Entretien avec Léa lundi 9h', source: 'montre', recu: new Date().toISOString(),
    analyse: { action: 'tache', ok: false, raisons: ['plusieurs Léa possibles'], titre: 'Entretien avec Léa', cat: 'entretien', date: j(7), debut: '09:00', fin: '10:00', collabs: [], candidats: [c.lea1, c.lea2] } });
}
