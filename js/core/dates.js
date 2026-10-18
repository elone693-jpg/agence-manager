// Dates locales « AAAA-MM-JJ » et heures « HH:MM » (heure de Paris, celle des appareils).
// Les objets Date sont créés à midi pour ne jamais être décalés par un changement d'heure.

const pad = n => String(n).padStart(2, '0');

export const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISO = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const todayISO = (now = new Date()) => toISO(now);
export const isISO = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

export function addDays(iso, n) { const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d); }

// Ajoute des mois en restant sur le dernier jour si le mois cible est plus court (31/01 + 1 mois = 28/02).
export function addMonths(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y, m - 1 + n, 1, 12);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0, 12).getDate();
  target.setDate(Math.min(d, last));
  return toISO(target);
}

export const diffDays = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 86400000);
// 0 = lundi … 6 = dimanche
export const dow = iso => (fromISO(iso).getDay() + 6) % 7;
export const mondayOf = iso => addDays(iso, -dow(iso));
export const isWeekend = iso => dow(iso) >= 5;

export function isoWeek(iso) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const jan4 = new Date(d.getFullYear(), 0, 4, 12);
  return 1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
}

export const toMin = hhmm => { if (!hhmm) return null; const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
export const toHHMM = min => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

export function range(from, to) { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; }

const JOURS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
const JOURS_LONG = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MOIS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export const fmtJour = iso => { const [, m, d] = iso.split('-').map(Number); return `${JOURS[dow(iso)]} ${d} ${MOIS[m - 1]}`; };
export const fmtLong = iso => { const [y, m, d] = iso.split('-').map(Number); return `${JOURS_LONG[dow(iso)]} ${d} ${MOIS_LONG[m - 1]} ${y}`; };
export const fmtCourt = iso => { const [, m, d] = iso.split('-').map(Number); return `${d} ${MOIS[m - 1]}`; };
export const fmtMois = iso => { const [y, m] = iso.split('-').map(Number); return `${MOIS_LONG[m - 1]} ${y}`; };
export const fmtHeure = hhmm => (hhmm ? hhmm.replace(/^0(\d)/, '$1').replace(':', ' h ').replace(/ h 00$/, ' h') : '');
export const nomJour = i => JOURS_LONG[i];
export const nomMois = i => MOIS_LONG[i];

// Jours fériés français (métropole).
export function feries(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  const paques = `${year}-${pad(month)}-${pad(day)}`;
  return {
    [`${year}-01-01`]: "Jour de l'an",
    [addDays(paques, 1)]: 'Lundi de Pâques',
    [`${year}-05-01`]: 'Fête du travail',
    [`${year}-05-08`]: 'Victoire 1945',
    [addDays(paques, 39)]: 'Ascension',
    [addDays(paques, 50)]: 'Lundi de Pentecôte',
    [`${year}-07-14`]: 'Fête nationale',
    [`${year}-08-15`]: 'Assomption',
    [`${year}-11-01`]: 'Toussaint',
    [`${year}-11-11`]: 'Armistice',
    [`${year}-12-25`]: 'Noël',
  };
}
export const ferie = iso => feries(Number(iso.slice(0, 4)))[iso] || null;
export const isOuvre = iso => !isWeekend(iso) && !ferie(iso);
