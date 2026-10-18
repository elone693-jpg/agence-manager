// Export iCalendar (RFC 5545) pour l'app Calendrier de l'iPhone, du Mac et de l'Apple Watch.
// Heures exprimées en heure de Paris (TZID) avec la définition du fuseau : correct de part et
// d'autre des changements d'heure. Noms en initiales par défaut (écran verrouillé, montre).

import { addDays } from './dates.js';
import { initiales } from './equipe.js';

const esc = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const d8 = iso => iso.replace(/-/g, '');
const dt = (iso, hhmm) => `${d8(iso)}T${hhmm.replace(':', '')}00`;
const stamp = now => now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// Pliage à 75 octets sans couper un caractère accentué.
export function fold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts = []; let cur = '', len = 0, limit = 75;
  for (const ch of line) {
    const l = enc.encode(ch).length;
    if (len + l > limit) { parts.push(cur); cur = ''; len = 0; limit = 74; }
    cur += ch; len += l;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

const VTIMEZONE = [
  'BEGIN:VTIMEZONE', 'TZID:Europe/Paris',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
  'END:VTIMEZONE',
];

// insts : instances (voir agenda.instances) ; absences : absences validées.
export function buildIcs({ insts, absences = [], equipe = [], categorie, nomsComplets = false, rappelMinutes = null, now = new Date() }) {
  const who = id => { const c = equipe.find(x => x.id === id); return !c ? '' : nomsComplets ? `${c.prenom} ${c.nom}` : `${initiales(c).split('').join('.')}.`; };
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AgenceManager//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:AgenceManager', 'X-WR-TIMEZONE:Europe/Paris', ...VTIMEZONE];
  for (const i of insts) {
    if (i.statut === 'annule') continue;
    const t = i.tache;
    const noms = (t.collabs ?? []).map(who).filter(Boolean).join(', ');
    const titre = noms && !nomsComplets ? `${t.titre} — ${noms}` : t.titre;
    L.push('BEGIN:VEVENT', `UID:${i.key.replace('@', '-')}@agencemanager`, `DTSTAMP:${stamp(now)}`);
    if (i.debut) {
      L.push(`DTSTART;TZID=Europe/Paris:${dt(i.date, i.debut)}`, `DTEND;TZID=Europe/Paris:${dt(i.date, i.fin || i.debut)}`);
    } else {
      L.push(`DTSTART;VALUE=DATE:${d8(i.date)}`, `DTEND;VALUE=DATE:${d8(addDays(i.date, 1))}`, 'TRANSP:TRANSPARENT');
    }
    L.push(`SUMMARY:${esc(titre)}`);
    if (categorie) L.push(`CATEGORIES:${esc(categorie(t.cat).nom)}`);
    if (i.statut === 'fait') L.push('STATUS:CONFIRMED');
    if (rappelMinutes != null && i.debut) {
      L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(titre)}`, `TRIGGER:-PT${rappelMinutes}M`, 'END:VALARM');
    }
    L.push('END:VEVENT');
  }
  for (const a of absences) {
    if (a.statut !== 'validee') continue;
    // Libellé générique : jamais le type ni le motif d'une absence.
    L.push('BEGIN:VEVENT', `UID:abs-${a.id}@agencemanager`, `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${d8(a.du)}`, `DTEND;VALUE=DATE:${d8(addDays(a.au || a.du, 1))}`,
      `SUMMARY:${esc(`Absent — ${who(a.collab)}`)}`, 'TRANSP:TRANSPARENT', 'END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.map(fold).join('\r\n') + '\r\n';
}
