// Équipe, absences et présence.
// Collaborateur : { prenom, nom, poste, entree, sortie?, actif, couleur, dda }
// Absence : { collab, du, au, type, portionDebut, portionFin, statut: 'validee'|'demandee', heures?, note }
//   portionDebut/portionFin : 'journee' | 'matin' | 'apresmidi'
//   Jamais de motif médical : le type « maladie » suffit.

import { TYPES_ABSENCE } from './defaults.js';

export const nomComplet = c => `${c.prenom} ${c.nom}`.trim();
export const initiales = c => `${c.prenom?.[0] ?? ''}${c.nom?.[0] ?? ''}`.toUpperCase();
export const typeAbsence = id => TYPES_ABSENCE.find(t => t.id === id) ?? TYPES_ABSENCE.at(-2);

export const actifLe = (c, date) => c.actif !== false && (!c.entree || c.entree <= date) && (!c.sortie || c.sortie >= date);

// Absences effectives un jour donné, avec la portion concernée ce jour-là.
export function absencesLe(absences, date, { inclureDemandees = true } = {}) {
  const out = [];
  for (const a of absences) {
    if (!a.du || a.du > date || (a.au || a.du) < date) continue;
    if (a.statut === 'refusee' || (!inclureDemandees && a.statut === 'demandee')) continue;
    let portion = 'journee';
    if (a.du === date && a.portionDebut && a.portionDebut !== 'journee') portion = a.portionDebut;
    if ((a.au || a.du) === date && a.portionFin && a.portionFin !== 'journee') portion = a.du === date && portion !== 'journee' ? portion : a.portionFin;
    out.push({ ...a, portion, absent: typeAbsence(a.type).absent });
  }
  return out;
}

// Présents un jour : 1 par journée, 0,5 par demi-journée d'absence. Le télétravail compte comme présent.
export function presence(equipe, absences, date) {
  const actifs = equipe.filter(c => actifLe(c, date));
  const abs = absencesLe(absences, date, { inclureDemandees: false }).filter(a => a.absent);
  let presents = 0;
  for (const c of actifs) {
    const mine = abs.filter(a => a.collab === c.id);
    if (mine.some(a => a.portion === 'journee')) continue;
    const demi = new Set(mine.map(a => a.portion));
    presents += demi.size >= 2 ? 0 : demi.size === 1 ? 0.5 : 1;
  }
  return { presents, effectif: actifs.length };
}

// Heures de formation DDA réalisées sur l'année civile (absences « formation » validées).
export function heuresFormation(absences, collabId, annee) {
  return absences
    .filter(a => a.collab === collabId && a.type === 'formation' && a.statut !== 'refusee' && a.statut !== 'demandee')
    .filter(a => (a.du || '').startsWith(String(annee)))
    .reduce((s, a) => s + (Number(a.heures) || 0), 0);
}
