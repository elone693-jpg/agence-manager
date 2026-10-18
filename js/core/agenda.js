// Tâches et occurrences de tâches récurrentes.
// Une tâche : { titre, cat, date, debut, fin, collabs[], statut, prio, notes, rec?, occ?, oblig? }
//   date '' = « à planifier » ; debut '' = sans horaire.
//   rec = { freq: 'hebdo' | '2sem' | 'mensuel', jusqu?: 'AAAA-MM-JJ' }
//   occ = { 'AAAA-MM-JJ': { statut?, annule? } } : état propre à une occurrence.

import { addDays, addMonths, diffDays, toMin } from './dates.js';

export const STATUTS = [
  { id: 'afaire', nom: 'À faire' },
  { id: 'encours', nom: 'En cours' },
  { id: 'fait', nom: 'Terminé' },
  { id: 'annule', nom: 'Annulé' },
];
export const PRIOS = [
  { id: 'normale', nom: 'Normale' },
  { id: 'haute', nom: 'Haute' },
  { id: 'urgente', nom: 'Urgente' },
];
export const FREQS = [
  { id: '', nom: 'Aucune' },
  { id: 'hebdo', nom: 'Chaque semaine' },
  { id: '2sem', nom: 'Toutes les 2 semaines' },
  { id: 'mensuel', nom: 'Chaque mois' },
];

// Dates des occurrences d'une tâche dans [from, to].
export function occurrences(t, from, to) {
  if (!t.date) return [];
  if (!t.rec?.freq) return t.date >= from && t.date <= to ? [t.date] : [];
  const end = t.rec.jusqu && t.rec.jusqu < to ? t.rec.jusqu : to;
  const out = [];
  if (t.rec.freq === 'mensuel') {
    for (let i = 0, d = t.date; d <= end; i++, d = addMonths(t.date, i)) if (d >= from) out.push(d);
  } else {
    const step = t.rec.freq === '2sem' ? 14 : 7;
    let d = t.date;
    if (d < from) d = addDays(t.date, Math.ceil(diffDays(t.date, from) / step) * step);
    for (; d <= end; d = addDays(d, step)) out.push(d);
  }
  return out.filter(d => !t.occ?.[d]?.annule);
}

// Instances affichables (une par occurrence) dans [from, to], triées.
export function instances(taches, from, to) {
  const out = [];
  for (const t of taches) {
    for (const date of occurrences(t, from, to)) {
      const recurrent = !!t.rec?.freq;
      out.push({
        key: recurrent ? `${t.id}@${date}` : t.id,
        id: t.id, tache: t, date, debut: t.debut || '', fin: t.fin || '',
        statut: recurrent ? (t.occ?.[date]?.statut ?? 'afaire') : (t.statut ?? 'afaire'),
        recurrent,
      });
    }
  }
  return out.sort((a, b) => (a.date + (a.debut || '99')).localeCompare(b.date + (b.debut || '99')));
}

export const aPlanifier = taches => taches.filter(t => !t.date && !['fait', 'annule'].includes(t.statut));

export function enRetard(taches, today) {
  // Les occurrences récurrentes non faites des 60 derniers jours comptent aussi.
  return instances(taches, addDays(today, -60), addDays(today, -1)).filter(i => ['afaire', 'encours'].includes(i.statut));
}

const overlaps = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;

// Conflits d'une instance (ou d'une tâche en cours d'édition) avec les autres instances et les absences.
export function conflits(cand, autres, absencesDuJour, equipe = []) {
  const res = [];
  if (!cand.date) return res;
  const s = toMin(cand.debut), e = toMin(cand.fin) ?? (s != null ? s + 60 : null);
  if (s != null) {
    for (const o of autres) {
      if (o.key === cand.key || o.id === cand.id && !o.recurrent) continue;
      if (o.date !== cand.date || o.statut === 'annule' || !o.debut) continue;
      const os = toMin(o.debut), oe = toMin(o.fin) ?? os + 60;
      if (overlaps(s, e, os, oe)) res.push({ type: 'chevauchement', texte: `Chevauche « ${o.tache.titre} » (${o.debut}–${o.fin || '?'})` });
    }
  }
  for (const a of absencesDuJour) {
    if (!cand.collabs?.includes(a.collab)) continue;
    if (s != null && a.portion === 'matin' && s >= 13 * 60) continue;
    if (s != null && a.portion === 'apresmidi' && (e ?? s) <= 13 * 60) continue;
    const c = equipe.find(x => x.id === a.collab);
    res.push({ type: 'absence', texte: `${c ? c.prenom : 'Collaborateur'} est absent(e) ce jour-là` });
  }
  return res;
}

// Premier créneau libre (jour ouvré, heures d'ouverture) à partir d'une date, sans conflit.
export function creneauLibre({ depuis, duree, collabs = [], insts, absencesSur, estOuvre, heureDebut = '08:30', heureFin = '18:00', joursMax = 30 }) {
  for (let i = 0; i < joursMax; i++) {
    const date = addDays(depuis, i);
    if (!estOuvre(date)) continue;
    const abs = absencesSur(date);
    if (collabs.some(c => abs.some(a => a.collab === c && a.portion === 'journee'))) continue;
    const jour = insts.filter(x => x.date === date && x.debut && x.statut !== 'annule')
      .map(x => [toMin(x.debut), toMin(x.fin) ?? toMin(x.debut) + 60]).sort((a, b) => a[0] - b[0]);
    for (let s = toMin(heureDebut); s + duree <= toMin(heureFin); s += 30) {
      if (overlaps(s, s + duree, 12 * 60, 13 * 60 + 30)) continue; // pause déjeuner 12 h – 13 h 30
      if (jour.some(([a, b]) => overlaps(s, s + duree, a, b))) continue;
      const cand = { date, debut: hh(s), fin: hh(s + duree), collabs };
      if (conflits(cand, [], abs).length) continue;
      return cand;
    }
  }
  return null;
}
const hh = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
