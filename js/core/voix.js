// Analyse d'une phrase dictée en français → tâche, absence ou mémo.
// Entièrement local : aucun texte n'est envoyé à un service externe.
// Règle d'or : en cas de doute (prénom ambigu, personne inconnue, date passée),
// on ne devine pas → le résultat part dans « À valider ».

import { addDays, addMonths, diffDays, dow, mondayOf, toHHMM, toMin } from './dates.js';

const MOIS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const NOMBRES = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, quinze: 15, vingt: 20, trente: 30, 'quarante-cinq': 45 };
const NB = `(\\d{1,3}|${Object.keys(NOMBRES).join('|')})`;
const num = s => (/^\d+$/.test(s) ? Number(s) : NOMBRES[s]);
const MOIS_RE = MOIS.join('|');
const JOURS_RE = JOURS.join('|');

const TYPES = [
  ['maladie', /\b(arret maladie|en arret|malade|maladie)\b/],
  ['formation', /\b(en formation|formation)\b/],
  ['rtt', /\brtt\b/],
  ['recup', /\b(recup|recuperation)\b/],
  ['teletravail', /\b(teletravail|en tele ?travail)\b/],
  ['conges', /\b(conges?|vacances|en cp)\b/],
  ['autre', /\b(absente?|absents|ne sera pas la|pas la)\b/],
];

const ACTIONS = /^(?:\s*(?:ajoute|ajouter|planifie|planifier|programme|programmer|mets|mettre|cree|creer|prevois|prevoir|cale|caler|organise|organiser|note|noter|rappelle[- ]moi|il faut que je|il faut|je dois|penser a|pense a)\b(?:\s+(?:de|d'|que|un|une|le|la|les))?)+/;

// Minuscules et accents retirés, caractère par caractère : les positions restent alignées avec le texte d'origine.
const norm = s => [...s].map(ch => ch.normalize('NFD')[0].toLowerCase()).join('').replace(/[’`]/g, "'");

export function analyser(texte, { today, equipe = [], categories = [], categorieDefaut = 'admin' }) {
  const original = String(texte ?? '').trim().replace(/\s+/g, ' ');
  let w = norm(original);
  const spans = [];
  const mask = (start, len) => { w = w.slice(0, start) + ' '.repeat(len) + w.slice(start + len); spans.push([start, start + len]); };
  const take = (re, fn) => { const m = re.exec(w); if (!m) return null; const r = fn(m); if (r !== false) mask(m.index, m[0].length); return r === false ? null : (r ?? m); };
  const raisons = [];

  // Mémo explicite.
  if (/^\s*(memo|note|idee)\s*:?\s/.test(w) && !/\b(a|de) \d{1,2} ?h/.test(w)) {
    return { action: 'memo', ok: true, texte: cap(original.replace(/^\s*(mémo|memo|note|idée|idee)\s*:?\s*/i, '')), raisons };
  }

  // Catégorie (avant l'heure : « 1:1 » ne doit pas être lu comme 1 h 01).
  let cat = null, catLen = 0;
  for (const c of categories) for (const mot of c.mots ?? []) {
    const m = new RegExp(`(^|[^a-z0-9])(${escapeRe(norm(mot))})(?=$|[^a-z0-9])`).exec(w);
    if (m && mot.length > catLen) { cat = c.id; catLen = mot.length; }
  }
  for (const m of [...w.matchAll(/\b1 ?(?::|to|a) ?1\b/g)]) w = w.slice(0, m.index) + ' '.repeat(m[0].length) + w.slice(m.index + m[0].length);

  // Personnes.
  const { collabs, ambigus, inconnus } = trouverPersonnes(original, w, equipe);

  // Type d'absence.
  let typeAbs = null;
  for (const [id, re] of TYPES) if (re.test(w)) { typeAbs = id; break; }
  const estAbsence = typeAbs && collabs.length + ambigus.length >= 1 && !cat;

  // ---- Dates ----
  let date = null, du = null, au = null, defautHeure = null, portion = 'journee';
  const resoudreJourMois = (j, mIdx, an) => {
    let d = iso(an ?? Number(today.slice(0, 4)), mIdx, j);
    if (!an && d < today) {
      if (diffDays(d, today) <= 31) raisons.push('date passée');
      else d = iso(Number(today.slice(0, 4)) + 1, mIdx, j);
    }
    return d;
  };
  const prochainJour = (jIdx, strict = true) => { let n = (jIdx - dow(today) + 7) % 7; if (n === 0 && strict) n = 7; return addDays(today, n); };

  // Plages (absences surtout).
  take(new RegExp(`\\bdu (\\d{1,2})(?:er)?(?: (${MOIS_RE}))? au (\\d{1,2})(?:er)? (${MOIS_RE})(?: (\\d{4}))?\\b`), m => {
    const mFin = MOIS.indexOf(m[4]); const mDeb = m[2] ? MOIS.indexOf(m[2]) : mFin; const an = m[5] ? Number(m[5]) : null;
    du = resoudreJourMois(Number(m[1]), mDeb, an); au = resoudreJourMois(Number(m[3]), mFin, an);
    if (au < du) au = iso(Number(au.slice(0, 4)) + 1, mFin, Number(m[3]));
  });
  if (!du) take(new RegExp(`\\bdu (${JOURS_RE})( prochain)? au (${JOURS_RE})\\b`), m => {
    du = prochainJour(JOURS.indexOf(m[1]), true); au = addDays(du, (JOURS.indexOf(m[3]) - JOURS.indexOf(m[1]) + 7) % 7);
  });
  if (!du) take(/\b(?:toute )?la semaine prochaine\b/, m => {
    if (!estAbsence) return false; du = addDays(mondayOf(today), 7); au = addDays(du, 4);
  });
  if (!du) take(/\b(?:toute )?cette semaine\b/, m => {
    if (!estAbsence) return false; du = today; au = addDays(mondayOf(today), 4);
  });
  if (!du) take(new RegExp(`\\bjusqu'?(?:a|au) (${JOURS_RE})\\b`), m => { du = today; au = prochainJour(JOURS.indexOf(m[1]), false); });

  // Date simple.
  if (!du) {
    take(/\bapres[- ]demain\b/, () => { date = addDays(today, 2); })
      || take(/\bdemain\b/, () => { date = addDays(today, 1); })
      || take(/\baujourd'? ?hui\b/, () => { date = today; })
      || take(new RegExp(`\\bdans ${NB} (jours?|semaines?)\\b`), m => { date = addDays(today, num(m[1]) * (m[2].startsWith('semaine') ? 7 : 1)); })
      || take(new RegExp(`\\b(?:(?:${JOURS_RE}) )?(?:le )?(\\d{1,2})(?:er)? (${MOIS_RE})(?: (\\d{4}))?\\b`), m => { date = resoudreJourMois(Number(m[1]), MOIS.indexOf(m[2]), m[3] ? Number(m[3]) : null); })
      || take(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/, m => { const an = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : null; date = resoudreJourMois(Number(m[1]), Number(m[2]) - 1, an); })
      || take(new RegExp(`\\b(${JOURS_RE}) (\\d{1,2})(?!\\d| ?h\\b| ?heures?\\b|:)\\b`), m => {
        const j = Number(m[2]); let d = iso(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, j);
        if (d < today) d = addMonths(d, 1);
        if (dow(d) !== JOURS.indexOf(m[1])) raisons.push('jour et date incohérents');
        date = d;
      })
      || take(new RegExp(`\\b(${JOURS_RE}) de la semaine prochaine\\b`), m => { date = addDays(addDays(mondayOf(today), 7), JOURS.indexOf(m[1])); })
      || take(new RegExp(`\\b(${JOURS_RE})(?: prochain)?\\b`), m => { date = prochainJour(JOURS.indexOf(m[1]), true); })
      || take(/\b(?:en )?fin de (?:la )?semaine\b/, () => { date = dow(today) <= 4 ? addDays(mondayOf(today), 4) : addDays(mondayOf(today), 11); })
      || take(/\bla semaine prochaine\b/, () => { date = addDays(mondayOf(today), 7); })
      || take(/\b(?:le )(\d{1,2})(?:er)?(?!\d| ?h\b| ?heures?\b|:)\b/, m => {
        const j = Number(m[1]); if (j < 1 || j > 31) return false;
        let d = iso(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, j);
        if (d < today) d = addMonths(d, 1);
        date = d;
      });
    take(/\b(?:ce|cet|le|dans l'|en)? ?(matin|apres[- ]midi|soir)\b/, m => {
      const k = m[1].startsWith('matin') ? 'matin' : m[1].startsWith('soir') ? 'soir' : 'apresmidi';
      if (!date && /^(ce|cet)/.test(m[0].trim())) date = today;
      defautHeure = k === 'matin' ? '09:00' : k === 'soir' ? '18:00' : '14:00';
      portion = k === 'soir' ? 'apresmidi' : k;
    });
  }

  // ---- Heures et durée ----
  let debut = null, fin = null, duree = null;
  const heure = (h, mn, suffixe) => {
    let H = Number(h); const M = mn ? Number(mn) : 0;
    if (suffixe && /apres|soir/.test(suffixe) && H < 12) H += 12;
    else if (!suffixe && H >= 1 && H <= 6) H += 12; // « à 2 h » au bureau = 14 h
    return H <= 23 && M <= 59 ? toHHMM(H * 60 + M) : null;
  };
  const H = `(\\d{1,2}) ?(?:h|heures?|:)(?: ?(\\d{2}))?`;
  const SUF = `(?: (du matin|de l'apres[- ]midi|du soir))?`;

  take(new RegExp(`\\bdans ${NB} ?(h|heures?|minutes?|min)\\b`), m => {
    const n = num(m[1]); const t = nowMinutes() + (m[2].startsWith('h') ? n * 60 : n);
    if (t >= 24 * 60) return false;
    debut = toHHMM(Math.ceil(t / 5) * 5); date ??= today;
  });
  take(new RegExp(`\\bpendant ${NB} ?(h|heures?|minutes?|min)(?: ?(\\d{2}|et demie?))?\\b`), m => {
    const n = num(m[1]); duree = m[2].startsWith('h') ? n * 60 + (m[3] ? (m[3].startsWith('et') ? 30 : Number(m[3])) : 0) : n;
  }) || take(/\b(?:pendant |d')?une demi[- ]heure\b/, () => { duree = 30; })
    || take(/\bpendant une heure(?: et demie?)?\b/, m => { duree = m[0].includes('demi') ? 90 : 60; });

  if (!debut) take(new RegExp(`\\bde ${H} (?:a|jusqu'a) ${H}${SUF}\\b`), m => {
    debut = heure(m[1], m[2], m[5]); fin = heure(m[3], m[4], m[5]);
    if (debut && fin && fin <= debut) fin = heure(Number(m[3]) + 12, m[4], null);
  }) || take(new RegExp(`\\b(?:a |vers |pour )?${H}${SUF}\\b`), m => { debut = heure(m[1], m[2], m[3]); })
    || take(/\b(?:a |vers )?(?<!apres[- ])midi\b/, () => { debut = '12:00'; });

  // ---- Assemblage ----
  if (estAbsence) {
    const startDate = du ?? date;
    const res = { action: 'absence', collab: collabs[0] ?? null, type: typeAbs, du: startDate, au: au ?? startDate,
      portionDebut: du ? 'journee' : portion, portionFin: du ? 'journee' : portion, raisons };
    if (ambigus.length) raisons.push(`plusieurs ${ambigus.map(a => a.mot).join(', ')} possibles`);
    if (collabs.length > 1) raisons.push('plusieurs personnes citées');
    if (!startDate) raisons.push('date non comprise');
    res.ok = !raisons.length && !!res.collab;
    res.candidats = ambigus.flatMap(a => a.ids);
    return res;
  }

  if (!debut && defautHeure) debut = defautHeure;
  const catId = cat ?? categorieDefaut;
  const catDef = categories.find(c => c.id === catId);
  if (debut && !fin) fin = toHHMM(Math.min(toMin(debut) + (duree ?? catDef?.duree ?? 60), 23 * 60 + 59));

  let titre = original;
  for (const [s, e] of spans.sort((a, b) => b[0] - a[0])) titre = titre.slice(0, s) + ' '.repeat(e - s) + titre.slice(e);
  titre = nettoyerTitre(titre);
  if (!titre) titre = catDef?.nom ?? 'Tâche';

  if (ambigus.length) raisons.push(`plusieurs ${ambigus.map(a => a.mot).join(', ')} possibles`);
  if (inconnus.length) raisons.push(`${inconnus.join(', ')} ne fait pas partie de l'équipe`);
  if (!date && (debut || defautHeure)) date = debut && toMin(debut) > nowMinutes() ? today : addDays(today, 1);

  return {
    action: 'tache', ok: !raisons.length, raisons, titre, cat: catId, catDevinee: !cat,
    date: date ?? '', debut: debut ?? '', fin: fin ?? '', collabs, candidats: ambigus.flatMap(a => a.ids),
  };
}

function trouverPersonnes(original, w, equipe) {
  const collabs = new Set(), ambigus = [], inconnus = [];
  const n = equipe.map(c => ({ id: c.id, p: norm(c.prenom ?? ''), nom: norm(c.nom ?? '') }));
  const has = s => s && new RegExp(`(^|[^a-z])${escapeRe(s)}(?=$|[^a-z])`).test(w);
  const prenomsVus = new Set();
  for (const c of n) if (c.p && c.nom && has(`${c.p} ${c.nom}`)) { collabs.add(c.id); prenomsVus.add(c.p); }
  for (const c of n) if (c.nom && !collabs.has(c.id) && has(c.nom) && n.filter(x => x.nom === c.nom).length === 1) { collabs.add(c.id); prenomsVus.add(c.p); }
  for (const p of new Set(n.map(c => c.p))) {
    if (!p || prenomsVus.has(p) || !has(p)) continue;
    const ids = n.filter(c => c.p === p).map(c => c.id);
    if (ids.length === 1) collabs.add(ids[0]); else ambigus.push({ mot: cap(p), ids });
  }
  // « avec Paul » : Paul n'est pas dans l'équipe → on le signale au lieu de l'ignorer.
  const STOP = new Set(['le', 'la', 'les', "l'equipe", 'equipe', 'tout', 'tous', 'toute', 'moi', 'lui', 'elle', 'eux', 'mon', 'ma', 'mes', 'son', 'sa', 'ses', 'un', 'une', 'des', 'le', 'client', 'direction', 'agence']);
  for (const m of original.matchAll(/\bavec ([A-ZÀ-Ý][\p{L}'-]+)/gu)) {
    const mot = norm(m[1]);
    if (STOP.has(mot)) continue;
    if (!n.some(c => c.p === mot || c.nom === mot)) inconnus.push(m[1]);
  }
  return { collabs: [...collabs], ambigus, inconnus };
}

function nettoyerTitre(s) {
  let t = s.replace(/\s+/g, ' ').trim();
  const n = norm(t);
  const m = ACTIONS.exec(n);
  if (m) t = t.slice(m[0].length);
  t = t.replace(/\s+/g, ' ').trim()
    .replace(/^(?:(?:un|une|le|la|les|de|d'|du|des|pour|à|a)\s+)+/i, '')
    .replace(/(?:\s+(?:avec|à|a|le|la|de|du|pour|et|,|\.))+$/i, '')
    .replace(/\s+([,.])/g, '$1').replace(/[,.]$/, '').trim();
  return cap(t);
}

const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const iso = (y, mIdx, d) => `${y}-${String(mIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
let nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
export const _setHorloge = fn => { nowMinutes = fn; };
