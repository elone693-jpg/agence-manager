// Dates locales « AAAA-MM-JJ » et heures « HH:MM » : heure de l'agence (fuseau de l'appareil par défaut).
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

// ---------- Fuseau horaire de l'agence ----------
export const fuseauAppareil = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';

function decalageMinutes(utcMs, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(utcMs)).map(x => [x.type, x.value]));
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - utcMs) / 60000);
}

// Heure murale (« 2026-10-20 », « 10:00 ») dans le fuseau tz → instant UTC (Date). Gère l'heure d'été.
export function murVersUtc(date, heure, tz) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (heure || '00:00').split(':').map(Number);
  const brut = Date.UTC(y, m - 1, d, hh, mm);
  let utc = brut - decalageMinutes(brut, tz) * 60000;
  const off2 = decalageMinutes(utc, tz);
  if (brut - off2 * 60000 !== utc) utc = brut - off2 * 60000;
  return new Date(utc);
}

// Instant → { date, heure } dans le fuseau tz.
export function utcVersMur(instant, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(instant).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, heure: `${p.hour}:${p.minute}` };
}

// ---------- Jours fériés ----------
// Territoires : jours fériés légaux propres (code du travail, art. L3422-2 pour l'abolition de l'esclavage).
export const TERRITOIRES = {
  metropole: { nom: 'Métropole', fuseau: 'Europe/Paris', legaux: {} },
  alsacemoselle: { nom: 'Alsace-Moselle', fuseau: 'Europe/Paris', legaux: { vendrediSaint: 'Vendredi saint', '12-26': 'Saint-Étienne' } },
  guadeloupe: { nom: 'Guadeloupe', fuseau: 'America/Guadeloupe', legaux: { '05-27': 'Abolition de l’esclavage' } },
  martinique: { nom: 'Martinique', fuseau: 'America/Martinique', legaux: { '05-22': 'Abolition de l’esclavage' } },
  guyane: { nom: 'Guyane', fuseau: 'America/Cayenne', legaux: { '06-10': 'Abolition de l’esclavage' } },
  reunion: { nom: 'La Réunion', fuseau: 'Indian/Reunion', legaux: { '12-20': 'Abolition de l’esclavage' } },
  mayotte: { nom: 'Mayotte', fuseau: 'Indian/Mayotte', legaux: { '04-27': 'Abolition de l’esclavage' } },
  saintmartin: { nom: 'Saint-Martin', fuseau: 'America/Marigot', legaux: { '05-27': 'Abolition de l’esclavage' } },
  saintbarthelemy: { nom: 'Saint-Barthélemy', fuseau: 'America/St_Barthelemy', legaux: { '10-09': 'Abolition de l’esclavage' } },
};
// Jours chômés d'usage (accords d'entreprise, coutumes locales) : à cocher selon l'agence.
export const USAGES = [
  { id: 'lundiGras', nom: 'Lundi gras', territoires: ['guadeloupe', 'martinique', 'guyane'] },
  { id: 'mardiGras', nom: 'Mardi gras', territoires: ['guadeloupe', 'martinique', 'guyane'] },
  { id: 'cendres', nom: 'Mercredi des Cendres', territoires: ['guadeloupe', 'martinique', 'guyane'] },
  { id: 'vendrediSaint', nom: 'Vendredi saint', territoires: ['guadeloupe', 'martinique', 'guyane'] },
  { id: 'schoelcher', nom: 'Fête Victor Schœlcher (21 juillet)', territoires: ['guadeloupe', 'martinique'] },
  { id: 'morts', nom: 'Jour des morts (2 novembre)', territoires: ['guadeloupe', 'martinique'] },
];

export function territoireDuFuseau(tz = fuseauAppareil()) {
  return Object.entries(TERRITOIRES).find(([k, t]) => k !== 'alsacemoselle' && t.fuseau === tz)?.[0] ?? 'metropole';
}

let configFeries = { territoire: 'metropole', usages: [] };
export function configurerFeries({ territoire, usages } = {}) {
  configFeries = { territoire: TERRITOIRES[territoire] ? territoire : 'metropole', usages: usages ?? [] };
  cacheFeries.clear();
}
const cacheFeries = new Map();

function paques(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function feries(year, { territoire = configFeries.territoire, usages = configFeries.usages } = {}) {
  const cle = `${year}|${territoire}|${usages.join(',')}`;
  if (cacheFeries.has(cle)) return cacheFeries.get(cle);
  const p = paques(year);
  const res = {
    [`${year}-01-01`]: "Jour de l'an",
    [addDays(p, 1)]: 'Lundi de Pâques',
    [`${year}-05-01`]: 'Fête du travail',
    [`${year}-05-08`]: 'Victoire 1945',
    [addDays(p, 39)]: 'Ascension',
    [addDays(p, 50)]: 'Lundi de Pentecôte',
    [`${year}-07-14`]: 'Fête nationale',
    [`${year}-08-15`]: 'Assomption',
    [`${year}-11-01`]: 'Toussaint',
    [`${year}-11-11`]: 'Armistice',
    [`${year}-12-25`]: 'Noël',
  };
  const mobiles = { vendrediSaint: [addDays(p, -2), 'Vendredi saint'], lundiGras: [addDays(p, -48), 'Lundi gras'], mardiGras: [addDays(p, -47), 'Mardi gras'],
    cendres: [addDays(p, -46), 'Mercredi des Cendres'], schoelcher: [`${year}-07-21`, 'Fête Victor Schœlcher'], morts: [`${year}-11-02`, 'Jour des morts'] };
  for (const [k, nom] of Object.entries(TERRITOIRES[territoire]?.legaux ?? {})) {
    if (mobiles[k]) res[mobiles[k][0]] = nom; else res[`${year}-${k}`] = nom;
  }
  for (const u of usages) if (mobiles[u]) res[mobiles[u][0]] ??= mobiles[u][1];
  cacheFeries.set(cle, res);
  return res;
}
export const ferie = iso => feries(Number(iso.slice(0, 4)))[iso] || null;
export const isOuvre = iso => !isWeekend(iso) && !ferie(iso);
