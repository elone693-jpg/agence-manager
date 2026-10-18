// Rendez-vous importés de l'agenda de l'iPhone par un Raccourci.
//
// Le Raccourci dépose un texte (issue GitHub) de la forme :
//   #AGENDA
//   2026-10-20T14:00:00+02:00|2026-10-20T15:00:00+02:00|Non|Travail|Comité de direction
//   2026-10-23T00:00:00+02:00|2026-10-24T00:00:00+02:00|Oui|Famille|Anniversaire
// Champs : début | fin | toute la journée | calendrier | titre (le titre peut contenir « | »).
//
// Chaque import est un instantané des 31 prochains jours : il remplace les rendez-vous déjà importés
// qui commencent après le moment de l'import (déplacements et suppressions sont donc repris),
// et laisse intacts ceux du passé.

import { addDays, toISO, toHHMM, utcVersMur, fuseauAppareil } from './dates.js';

export const MARQUEUR = '#AGENDA';
export const HORIZON_JOURS = 31;
export const CALENDRIER_APP = 'AgenceManager'; // le calendrier abonné de l'app : jamais réimporté

export const estImportAgenda = (titre, corps) => /^\s*#AGENDA\b/i.test(corps ?? '') || /^\s*agenda\s*$/i.test(titre ?? '');

const MOIS = { janv: 0, jan: 0, fevr: 1, fev: 1, mars: 2, mar: 2, avr: 3, mai: 4, juin: 5, juil: 6, aout: 7, sept: 8, sep: 8, oct: 9, nov: 10, dec: 11 };
const sansAccent = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Date du Raccourci → { date: 'AAAA-MM-JJ', heure: 'HH:MM' } dans le fuseau de l'agence.
// Accepte l'ISO 8601 (format recommandé) et les formats français courants, au cas où.
export function lireDate(s, fuseau = fuseauAppareil()) {
  const t = String(s ?? '').trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t)) {
    if (/([+-]\d{2}:?\d{2}|Z)$/.test(t)) {
      const d = new Date(t);
      if (Number.isNaN(d.getTime())) return null;
      return utcVersMur(d, fuseau);
    }
    return { date: t.slice(0, 10), heure: t.slice(11, 16) };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return { date: t, heure: '00:00' };
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[^\d]+(\d{1,2})[:h](\d{2}))?/.exec(t);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return { date: `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`, heure: m[4] ? `${m[4].padStart(2, '0')}:${m[5]}` : '00:00' };
  }
  m = /^(?:[a-zé.]+\s+)?(\d{1,2})\s+([a-zéû.]+)\s+(\d{4})(?:[^\d]+(\d{1,2})[:h](\d{2}))?/i.exec(t);
  if (m) {
    const mois = MOIS[sansAccent(m[2]).replace('.', '').slice(0, 4)] ?? MOIS[sansAccent(m[2]).replace('.', '').slice(0, 3)];
    if (mois == null) return null;
    return { date: `${m[3]}-${String(mois + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`, heure: m[4] ? `${m[4].padStart(2, '0')}:${m[5]}` : '00:00' };
  }
  return null;
}

const oui = s => /^(oui|yes|true|vrai|1)$/i.test(String(s ?? '').trim());

// Petit hachage stable (FNV-1a) pour identifier un rendez-vous.
export function hash(s) {
  let h = 0x811c9dc5;
  for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

// Texte du Raccourci → liste de rendez-vous { id, titre, calendrier, date, debut, fin, journee }.
export function lireImport(texte, fuseau = fuseauAppareil()) {
  const rdv = [], ignores = [];
  for (const brute of String(texte ?? '').split(/\r?\n/)) {
    const ligne = brute.trim();
    if (!ligne || ligne.startsWith('#')) continue;
    const parts = ligne.split('|');
    if (parts.length < 5) { ignores.push(ligne); continue; }
    const [sDebut, sFin, sJournee, sCal, ...reste] = parts;
    const titre = reste.join('|').trim() || '(sans titre)';
    const calendrier = sCal.trim();
    const d = lireDate(sDebut, fuseau), f = lireDate(sFin, fuseau);
    if (!d) { ignores.push(ligne); continue; }
    if (calendrier.toLowerCase() === CALENDRIER_APP.toLowerCase()) continue;
    // Journée entière : déclarée, ou déduite (minuit → minuit).
    const journee = oui(sJournee) || (d.heure === '00:00' && (!f || f.heure === '00:00' || f.heure === '23:59'));
    const r = { titre, calendrier, date: d.date, debut: '', fin: '', journee };
    if (!journee) {
      r.debut = d.heure;
      r.fin = f && f.date === d.date && f.heure > d.heure ? f.heure : '';
      if (f && f.date > d.date) r.fin = '23:59';
    } else if (f) {
      // Fin exclusive (lendemain à minuit) → dernier jour inclus.
      const dernier = f.heure === '00:00' && f.date > d.date ? addDays(f.date, -1) : f.date;
      if (dernier > d.date) r.jusqu = dernier;
    }
    r.id = `rdv-${hash(`${calendrier}|${titre}|${d.date}|${r.debut}`)}`;
    rdv.push(r);
  }
  // Doublons exacts (même événement listé deux fois) : un seul.
  const vus = new Set();
  return { rdv: rdv.filter(r => (vus.has(r.id) ? false : vus.add(r.id))), ignores };
}

// Opérations à appliquer pour un import reçu à l'instant `recu` (Date).
// existants : rendez-vous déjà en base [{ id, date, debut, ... }].
export function planImport(existants, rdv, recu, horizon = HORIZON_JOURS, fuseau = fuseauAppareil()) {
  const { date: jour, heure } = utcVersMur(recu, fuseau);
  const fin = addDays(jour, horizon);
  const dansFenetre = r => r.date <= fin && (r.date > jour || (r.date === jour && (r.journee || (r.debut || '00:00') >= heure)));
  const nouveaux = new Map(rdv.filter(dansFenetre).map(r => [r.id, r]));
  const supprimer = existants.filter(e => dansFenetre(e) && !nouveaux.has(e.id)).map(e => e.id);
  const ecrire = [...nouveaux.values()].filter(r => {
    const e = existants.find(x => x.id === r.id);
    return !e || e.titre !== r.titre || e.fin !== r.fin || e.calendrier !== r.calendrier || e.jusqu !== r.jusqu || e.journee !== r.journee;
  });
  return { ecrire, supprimer, total: nouveaux.size };
}

// Rendez-vous → instances affichables (même forme que agenda.instances), sur [from, to].
export function instancesRdv(rdvs, from, to) {
  const out = [];
  for (const r of rdvs) {
    const der = r.jusqu ?? r.date;
    if (der < from || r.date > to) continue;
    for (let d = r.date < from ? from : r.date; d <= der && d <= to; d = addDays(d, 1)) {
      out.push({ key: `${r.id}@${d}`, id: r.id, date: d, debut: r.journee ? '' : r.debut, fin: r.journee ? '' : r.fin,
        statut: 'afaire', recurrent: false, externe: true,
        tache: { titre: r.titre, cat: '__agenda', collabs: [], calendrier: r.calendrier } });
    }
  }
  return out;
}
