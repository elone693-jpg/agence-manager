// Export iCalendar (RFC 5545) pour l'app Calendrier de l'iPhone, du Mac et de l'Apple Watch.
// Les heures saisies sont celles de l'agence (fuseau `fuseau`) ; elles sont écrites en temps universel (Z),
// que tout calendrier affiche correctement, quels que soient le fuseau de l'appareil et les changements d'heure.
// Noms en initiales par défaut (écran verrouillé, montre).

import { addDays, murVersUtc, fuseauAppareil } from './dates.js';
import { initiales } from './equipe.js';

const esc = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const d8 = iso => iso.replace(/-/g, '');
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

// insts : instances (voir agenda.instances) ; absences : absences validées.
export function buildIcs({ insts, absences = [], equipe = [], categorie, nomsComplets = false, rappelMinutes = null, now = new Date(), fuseau = fuseauAppareil() }) {
  const who = id => { const c = equipe.find(x => x.id === id); return !c ? '' : nomsComplets ? `${c.prenom} ${c.nom}` : `${initiales(c).split('').join('.')}.`; };
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AgenceManager//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:AgenceManager', `X-WR-TIMEZONE:${fuseau}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT15M', 'X-PUBLISHED-TTL:PT15M'];
  for (const i of insts) {
    // Les rendez-vous importés de l'iPhone y sont déjà : ne pas les renvoyer (doublons).
    if (i.statut === 'annule' || i.externe) continue;
    const t = i.tache;
    const noms = (t.collabs ?? []).map(who).filter(Boolean).join(', ');
    const titre = noms && !nomsComplets ? `${t.titre} — ${noms}` : t.titre;
    // DTSTAMP = date de dernière modification : le fichier ne change que si les données changent.
    L.push('BEGIN:VEVENT', `UID:${i.key.replace('@', '-')}@agencemanager`, `DTSTAMP:${stamp(t._t ? new Date(t._t) : now)}`);
    if (i.debut) {
      L.push(`DTSTART:${stamp(murVersUtc(i.date, i.debut, fuseau))}`, `DTEND:${stamp(murVersUtc(i.date, i.fin || i.debut, fuseau))}`);
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
    L.push('BEGIN:VEVENT', `UID:abs-${a.id}@agencemanager`, `DTSTAMP:${stamp(a._t ? new Date(a._t) : now)}`,
      `DTSTART;VALUE=DATE:${d8(a.du)}`, `DTEND;VALUE=DATE:${d8(addDays(a.au || a.du, 1))}`,
      `SUMMARY:${esc(`Absent — ${who(a.collab)}`)}`, 'TRANSP:TRANSPARENT', 'END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.map(fold).join('\r\n') + '\r\n';
}
