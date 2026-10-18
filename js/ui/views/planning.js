import { esc, ICONES } from '../dom.js';
import { ui, store, today, insts, equipe, absences, cat, nomCollab, conflitsDe } from '../ctx.js';
import { addDays, ferie, fmtCourt, isoWeek, isWeekend, mondayOf, toMin, fmtHeure, dow, nomJour } from '../../core/dates.js';
import { absencesLe, presence } from '../../core/equipe.js';
import { majuscule } from './commun.js';

export const titre = () => 'Planning';
const mobile = () => matchMedia('(max-width: 860px)').matches;
const HOUR = 52;

export function render() {
  const d = today();
  const lundi = ui.semaine;
  const semaine = Array.from({ length: 7 }, (_, i) => addDays(lundi, i));
  const toutes = insts(lundi, addDays(lundi, 6)).filter(i => i.statut !== 'annule');
  const weekendOccupe = toutes.some(i => isWeekend(i.date));
  const montrerWeekend = weekendOccupe || semaine.slice(5).includes(d);
  const jours = mobile() ? [semaine.includes(ui.jour) ? ui.jour : lundi] : semaine.filter(x => montrerWeekend || !isWeekend(x));
  const r = store.reglages();
  const seuil = r.seuilPresents ?? 0;

  // Plage horaire : réglages, élargie aux tâches qui débordent.
  const horaires = toutes.filter(i => i.debut);
  let hMin = Math.floor(toMin(r.heureDebut ?? '08:00') / 60), hMax = Math.ceil(toMin(r.heureFin ?? '19:00') / 60);
  for (const i of horaires) { hMin = Math.min(hMin, Math.floor(toMin(i.debut) / 60)); hMax = Math.max(hMax, Math.ceil((toMin(i.fin) ?? toMin(i.debut) + 60) / 60)); }
  const heures = Array.from({ length: hMax - hMin }, (_, k) => hMin + k);

  const infosJour = x => {
    const abs = absencesLe(absences(), x).filter(a => a.absent && a.statut !== 'refusee');
    const p = presence(equipe(), absences(), x);
    const noms = abs.map(a => nomCollab(a.collab, true) + (a.portion === 'matin' ? ' (mat.)' : a.portion === 'apresmidi' ? ' (ap.-m.)' : '')).join(', ');
    const bas = p.effectif > 0 && p.presents < seuil && !isWeekend(x) && !ferie(x);
    return { abs, noms, bas, p };
  };

  const enTete = x => {
    const f = ferie(x);
    return `<div class="${x === d ? 'today' : ''}"><span style="text-transform:capitalize">${esc(nomJour(dow(x)).slice(0, 3))}.</span><span class="num">${Number(x.slice(8))}</span>${f ? `<span class="ferie">${esc(f)}</span>` : ''}</div>`;
  };
  const journee = x => {
    const { noms, bas, p } = infosJour(x);
    const sansHeure = toutes.filter(i => i.date === x && !i.debut);
    return `<div>${noms ? `<div class="abs-line${bas ? ' low' : ''}" title="Présents : ${p.presents}/${p.effectif}">Absents : ${esc(noms)}</div>` : bas ? `<div class="abs-line low">Présents ${p.presents}/${p.effectif}</div>` : ''}
      ${sansHeure.map(i => `<div class="ev-allday" style="--c:${esc(cat(i.tache.cat).couleur)}" data-act="ouvrir-tache" data-id="${esc(i.id)}" data-occ="${i.recurrent ? esc(i.date) : ''}">${i.statut === 'fait' ? '✓ ' : ''}${esc(i.tache.titre)}</div>`).join('')}</div>`;
  };

  const colonne = x => {
    const evs = disposer(toutes.filter(i => i.date === x && i.debut));
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const now = x === d && nowMin >= hMin * 60 && nowMin <= hMax * 60 ? `<div class="nowline" style="top:${((nowMin - hMin * 60) / 60) * HOUR}px"></div>` : '';
    return `<div class="daycol${x === d ? ' today' : ''}${isWeekend(x) ? ' weekend' : ''}${ferie(x) ? ' ferie' : ''}" data-act="creer-ici" data-date="${x}" data-hmin="${hMin}" style="height:${heures.length * HOUR}px">
      ${now}${evs.map(({ i, col, cols }) => {
        const s = toMin(i.debut), e = toMin(i.fin) ?? s + 60;
        const c = cat(i.tache.cat);
        const conflit = i.statut !== 'fait' && conflitsDe({ ...i.tache, key: i.key, date: i.date }).length > 0;
        const qui = (i.tache.collabs ?? []).map(id => nomCollab(id, true)).join(', ');
        return `<div class="ev${i.statut === 'fait' ? ' done' : ''}${conflit ? ' conflict' : ''}" data-act="ouvrir-tache" data-id="${esc(i.id)}" data-occ="${i.recurrent ? esc(i.date) : ''}"
          style="--c:${esc(c.couleur)};top:${((s - hMin * 60) / 60) * HOUR + 1}px;height:${Math.max(((e - s) / 60) * HOUR - 2, 20)}px;left:calc(${(col / cols) * 100}% + 2px);width:calc(${100 / cols}% - 4px)"
          title="${esc(`${i.tache.titre} · ${i.debut}–${i.fin}${qui ? ` · ${qui}` : ''}${conflit ? ' · conflit' : ''}`)}">
          <b>${i.recurrent ? '↻ ' : ''}${esc(i.tache.titre)}</b><small>${esc(fmtHeure(i.debut))}${i.fin ? `–${esc(fmtHeure(i.fin))}` : ''}${qui ? ` · ${esc(qui)}` : ''}</small></div>`;
      }).join('')}</div>`;
  };

  const strip = `<div class="daystrip only-mobile">${semaine.map(x => `<button data-act="choisir-jour" data-date="${x}" aria-pressed="${x === jours[0]}" class="${toutes.some(i => i.date === x) ? 'has' : ''}">
      <span style="text-transform:capitalize">${esc(nomJour(dow(x)).slice(0, 3))}</span><b>${Number(x.slice(8))}</b></button>`).join('')}</div>`;
  const jm = jours[0];
  const enteteMobile = `<div class="mobile-day only-mobile card" style="padding:10px 12px">
      <div class="row"><b>${esc(majuscule(nomJour(dow(jm))))} ${esc(fmtCourt(jm))}</b>${ferie(jm) ? `<span class="pill danger">${esc(ferie(jm))}</span>` : ''}<span class="spacer"></span>
      <button class="btn small" data-act="nouvelle-tache" data-date="${jm}">+ Tâche</button></div>
      <div style="margin-top:6px">${journee(jm)}</div></div>`;

  return `
  <div class="plan-bar">
    <button class="btn icon" data-act="semaine" data-delta="-7" aria-label="Semaine précédente">${ICONES.gauche}</button>
    <button class="btn" data-act="semaine" data-delta="0">Aujourd’hui</button>
    <button class="btn icon" data-act="semaine" data-delta="7" aria-label="Semaine suivante">${ICONES.droite}</button>
    <h2>${esc(fmtCourt(lundi))} – ${esc(fmtCourt(addDays(lundi, 6)))} <span class="pill">S${isoWeek(lundi)}</span></h2>
    <span class="spacer"></span>
    <span class="small muted only-desktop">${toutes.filter(i => i.statut === 'fait').length}/${toutes.length} terminées</span>
    <button class="btn primary only-desktop" data-act="nouvelle-tache" data-date="${jours.includes(d) ? d : lundi}">+ Tâche</button>
  </div>
  ${strip}${enteteMobile}
  <div class="week" style="--cols:${jours.length};--hour:${HOUR}px">
    <div class="week-head"><div></div>${jours.map(enTete).join('')}</div>
    <div class="week-allday"><div class="tiny faint" style="padding:6px 4px;text-align:right">Journée</div>${jours.map(journee).join('')}</div>
    <div class="week-body" id="week-body">
      <div class="hours">${heures.map(h => `<div>${h}:00</div>`).join('')}</div>
      ${jours.map(colonne).join('')}
    </div>
  </div>
  <p class="tiny faint only-desktop" style="margin-top:8px">Cliquez dans une colonne pour créer une tâche à cette heure. Bordure rouge : conflit d’horaire ou collaborateur absent.</p>`;
}

export function apresRendu() {
  const body = document.getElementById('week-body');
  if (!body || body.dataset.scrolled) return;
  const now = body.querySelector('.nowline');
  if (now) body.scrollTop = Math.max(0, parseFloat(now.style.top) - 120);
  body.dataset.scrolled = '1';
}

// Place les tâches qui se chevauchent côte à côte.
function disposer(evs) {
  const items = evs.map(i => ({ i, s: toMin(i.debut), e: toMin(i.fin) ?? toMin(i.debut) + 60 })).sort((a, b) => a.s - b.s || b.e - a.e);
  const out = [];
  let groupe = [], finGroupe = -1;
  const fermer = () => {
    const colsFin = [];
    for (const it of groupe) {
      let c = colsFin.findIndex(fin => fin <= it.s);
      if (c === -1) { c = colsFin.length; colsFin.push(it.e); } else colsFin[c] = it.e;
      it.col = c;
    }
    for (const it of groupe) out.push({ i: it.i, col: it.col, cols: colsFin.length });
    groupe = [];
  };
  for (const it of items) {
    if (it.s >= finGroupe && groupe.length) fermer();
    groupe.push(it); finGroupe = Math.max(finGroupe, it.e);
  }
  if (groupe.length) fermer();
  return out;
}

export function changerSemaine(delta) {
  if (delta === 0) { ui.semaine = mondayOf(today()); ui.jour = today(); return; } // « Aujourd'hui » : la semaine qui contient aujourd'hui
  if (mobile()) { ui.jour = addDays(ui.jour, delta); ui.semaine = mondayOf(ui.jour); return; }
  ui.semaine = addDays(ui.semaine, delta);
  ui.jour = ui.semaine;
}
