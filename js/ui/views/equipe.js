import { esc, ICONES } from '../dom.js';
import { ui, store, today, equipe, absences, nomCollab } from '../ctx.js';
import { vide } from './commun.js';
import { addDays, dow, fmtCourt, fmtJour, isWeekend, ferie } from '../../core/dates.js';
import { absencesLe, actifLe, heuresFormation, initiales, nomComplet, presence, typeAbsence } from '../../core/equipe.js';
import { TYPES_ABSENCE } from '../../core/defaults.js';

export const titre = () => 'Équipe';

const ONGLETS = [{ id: 'presence', nom: 'Présence' }, { id: 'membres', nom: 'Collaborateurs' }, { id: 'absences', nom: 'Absences' }];

export function render() {
  const onglet = ui.ongletEquipe;
  return `
  <div class="row" style="margin-bottom:14px">
    <div class="seg" role="group" aria-label="Affichage">${ONGLETS.map(o => `<button data-act="onglet-equipe" data-o="${o.id}" aria-pressed="${onglet === o.id}">${o.nom}</button>`).join('')}</div>
    <span class="spacer"></span>
    <button class="btn" data-act="nouveau-collab">+ Collaborateur</button>
    <button class="btn primary" data-act="nouvelle-absence">+ Absence</button>
  </div>
  ${!equipe().length ? `<section class="card">${vide('Aucun collaborateur pour l’instant.')}</section>` : onglet === 'presence' ? grille() : onglet === 'membres' ? membres() : listeAbsences()}`;
}

function grille() {
  const d = today();
  const debut = ui.debutPresence;
  const jours = [];
  for (let x = debut; jours.length < 15; x = addDays(x, 1)) if (!isWeekend(x)) jours.push(x);
  const fin = jours.at(-1);
  const membres = equipe().filter(c => jours.some(x => actifLe(c, x)));
  const abs = absences();
  const seuil = store.reglages().seuilPresents ?? 0;

  const cellule = (c, x) => {
    if (!actifLe(c, x)) return '<td class="faint">–</td>';
    if (ferie(x)) return '<td class="we"></td>';
    const a = absencesLe(abs, x).find(z => z.collab === c.id && z.statut !== 'refusee');
    if (!a) return `<td data-act="nouvelle-absence" data-collab="${c.id}" data-date="${x}" style="cursor:copy"></td>`;
    const t = typeAbsence(a.type);
    return `<td><span class="cell-abs${a.portion !== 'journee' ? ` half-${a.portion}` : ''}${a.statut === 'demandee' ? ' demande' : ''}" style="--c:${esc(t.couleur)}" data-act="ouvrir-absence" data-id="${esc(a.id)}" title="${esc(`${nomComplet(c)} · ${t.nom}${a.portion !== 'journee' ? ` (${a.portion === 'matin' ? 'matin' : 'après-midi'})` : ''}${a.statut === 'demandee' ? ' · demandée' : ''}`)}"></span></td>`;
  };

  return `<section class="card">
    <div class="plan-bar">
      <button class="btn icon" data-act="presence" data-delta="-7" aria-label="Précédent">${ICONES.gauche}</button>
      <button class="btn" data-act="presence" data-delta="0">Aujourd’hui</button>
      <button class="btn icon" data-act="presence" data-delta="7" aria-label="Suivant">${ICONES.droite}</button>
      <h2>${esc(fmtCourt(debut))} – ${esc(fmtCourt(fin))}</h2>
      <span class="spacer"></span><span class="small muted">Seuil : ${seuil} présent(s)</span>
    </div>
    <div class="presence"><table>
      <thead><tr><th></th>${jours.map(x => `<th class="${x === d ? 'today' : ''}" title="${esc(fmtJour(x))}">${'LMMJV'[dow(x)]}<br><span style="color:var(--text)">${Number(x.slice(8))}</span></th>`).join('')}</tr></thead>
      <tbody>
        ${membres.map(c => `<tr><td><span class="row" style="gap:6px;flex-wrap:nowrap"><span class="avatar" style="--c:${esc(c.couleur)};width:22px;height:22px;font-size:9px">${esc(initiales(c))}</span>${esc(nomComplet(c))}</span></td>${jours.map(x => cellule(c, x)).join('')}</tr>`).join('')}
        <tr><td><b>Présents</b></td>${jours.map(x => { if (ferie(x)) return `<td class="we tiny" title="${esc(ferie(x))}">férié</td>`; const p = presence(equipe(), abs, x); return `<td class="tot${p.presents < seuil ? ' low' : ''}">${String(p.presents).replace('.', ',')}</td>`; }).join('')}</tr>
      </tbody></table></div>
    <div class="chips" style="margin-top:12px">${TYPES_ABSENCE.map(t => `<span class="pill"><span class="dot" style="--c:${esc(t.couleur)}"></span>${esc(t.nom)}</span>`).join('')}<span class="pill">Hachuré : demandée</span></div>
    <p class="tiny faint" style="margin:8px 0 0">Cliquez sur une case vide pour saisir une absence. Les demandes non validées ne réduisent pas l’effectif.</p>
  </section>`;
}

function membres() {
  const annee = Number(today().slice(0, 4));
  const objectif = store.reglages().ddaHeures ?? 15;
  return `<div class="grid cols-3">${equipe().map(c => {
    const h = heuresFormation(absences(), c.id, annee);
    return `<section class="card" data-act="ouvrir-collab" data-id="${c.id}" style="cursor:pointer;${c.actif === false ? 'opacity:.55' : ''}">
      <div class="row" style="flex-wrap:nowrap"><span class="avatar" style="--c:${esc(c.couleur)}">${esc(initiales(c))}</span>
        <div style="min-width:0"><b>${esc(nomComplet(c))}</b><div class="small muted">${esc(c.poste || '—')}${c.actif === false ? ' · inactif' : ''}</div></div></div>
      <div class="small muted" style="margin-top:10px">Entrée : ${c.entree ? esc(fmtJour(c.entree)) : '<span class="pill warn">à renseigner</span>'}</div>
      ${c.dda ? `<div style="margin-top:8px"><div class="row small"><span>Formation DDA ${annee}</span><span class="spacer"></span><b>${String(h).replace('.', ',')} h</b><span class="muted">/ ${objectif} h</span></div>
        <div class="progress" style="--c:${h >= objectif ? 'var(--ok)' : 'var(--warn)'};margin-top:4px"><i style="width:${Math.min(100, (h / objectif) * 100)}%"></i></div></div>` : ''}
    </section>`;
  }).join('')}</div>`;
}

function listeAbsences() {
  const d = today();
  const toutes = absences().sort((a, b) => a.du.localeCompare(b.du));
  const demandees = toutes.filter(a => a.statut === 'demandee' && (a.au || a.du) >= d);
  const avenir = toutes.filter(a => a.statut === 'validee' && (a.au || a.du) >= d);
  const passees = toutes.filter(a => (a.au || a.du) < d).reverse().slice(0, 15);
  const ligne = a => {
    const t = typeAbsence(a.type);
    return `<div class="item" data-act="ouvrir-absence" data-id="${esc(a.id)}">
      <span class="dot" style="--c:${esc(t.couleur)}"></span>
      <div class="what"><div class="title">${esc(nomCollab(a.collab))} · ${esc(t.nom)}</div>
        <div class="meta">${esc(fmtJour(a.du))}${a.au && a.au !== a.du ? ` → ${esc(fmtJour(a.au))}` : ''}${a.portionDebut && a.portionDebut !== 'journee' ? ` · ${a.portionDebut === 'matin' ? 'matin' : 'après-midi'}` : ''}${a.heures ? ` · ${a.heures} h` : ''}</div></div>
      ${a.statut === 'demandee' ? `<button class="btn small" data-act="valider-absence" data-id="${esc(a.id)}">Valider</button>` : ''}
    </div>`;
  };
  return `<div class="grid cols-2">
    <section class="card"><header><h2>Demandes à traiter</h2></header><div class="list">${demandees.map(ligne).join('') || vide('Aucune demande en attente.')}</div></section>
    <section class="card"><header><h2>En cours et à venir</h2></header><div class="list">${avenir.map(ligne).join('') || vide('Aucune absence prévue.')}</div></section>
    <section class="card span-2"><header><h2>Passées</h2></header><div class="list">${passees.map(ligne).join('') || vide('—')}</div></section>
  </div>`;
}

export function deplacerPresence(delta) {
  ui.debutPresence = delta === 0 ? addDays(today(), -dow(today())) : addDays(ui.debutPresence, delta);
}
