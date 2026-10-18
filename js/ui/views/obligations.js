import { esc } from '../dom.js';
import { store, today, taches, equipe, cat } from '../ctx.js';
import { vide } from './commun.js';
import { fmtJour } from '../../core/dates.js';
import { echeancier, ETATS } from '../../core/obligations.js';

export const titre = () => 'Obligations';
const TON = { retard: 'danger', aplanifier: 'warn', planifie: 'accent', ajour: 'ok' };

const periode = m => (m % 12 === 0 ? `${m / 12} an${m > 12 ? 's' : ''}` : `${m} mois`);

export function render() {
  const d = today();
  const rows = echeancier({ obligations: store.list('obligations'), taches: taches(), equipe: equipe(), today: d });
  const parEtat = Object.keys(ETATS).map(e => [e, rows.filter(r => r.etat === e)]);
  const modeles = store.list('obligations').sort((a, b) => a.titre.localeCompare(b.titre, 'fr'));

  const ligne = r => `<div class="item" style="cursor:default">
    <span class="dot" style="--c:${esc(cat(r.obligation.cat).couleur)}"></span>
    <div class="what"><div class="title">${esc(r.libelle)}</div>
      <div class="meta">${r.derniere ? `Dernière : ${esc(fmtJour(r.derniere))} · ` : 'Jamais réalisée · '}Échéance : ${esc(fmtJour(r.echeance))}${r.prochaine ? ` · prévue le ${esc(fmtJour(r.prochaine))}${r.horsDelai ? ' (après l’échéance)' : ''}` : ''}</div></div>
    <span class="pill ${TON[r.etat]}">${r.etat === 'retard' ? `${-r.jours} j de retard` : r.etat === 'aplanifier' ? (r.jours === 0 ? 'à faire' : `dans ${r.jours} j`) : ETATS[r.etat].nom}</span>
    ${r.etat === 'retard' || r.etat === 'aplanifier' || r.etat === 'ajour' ? `<button class="btn small${r.etat === 'ajour' ? ' ghost' : ''}" data-act="planifier-oblig" data-oblig="${esc(r.obligation.id)}" data-collab="${esc(r.collab?.id ?? '')}">Planifier</button>` : ''}
  </div>`;

  return `
  ${!equipe().length ? '<div class="alert info" style="margin-bottom:14px">Ajoutez votre équipe (avec les dates d’entrée) pour suivre les obligations par collaborateur.</div>' : ''}
  <div class="stack" style="gap:16px">
    ${parEtat.filter(([e, rs]) => e !== 'ajour' && rs.length).map(([e, rs]) => `<section class="card"><header><h2>${ETATS[e].nom} <span class="pill ${TON[e]}">${rs.length}</span></h2></header>
      <div class="list">${rs.map(ligne).join('')}</div></section>`).join('') || `<section class="card">${vide('Aucune obligation à traiter.')}</section>`}
    <section class="card"><header><h2>À jour <span class="pill ok">${parEtat.find(([e]) => e === 'ajour')[1].length}</span></h2></header>
      <details><summary class="small muted" style="cursor:pointer">Afficher</summary><div class="list">${parEtat.find(([e]) => e === 'ajour')[1].map(ligne).join('')}</div></details></section>
  </div>

  <section class="card" style="margin-top:16px">
    <header><h2>Règles de suivi</h2><span class="small muted">Modifiables selon vos accords d’entreprise</span></header>
    <div class="list">${modeles.map(o => `<div class="item" style="cursor:default;flex-wrap:wrap">
      <label class="check" style="flex:1;min-width:220px"><input type="checkbox" data-change="oblig-actif" data-id="${esc(o.id)}" ${o.actif ? 'checked' : ''}>
        <span><b>${esc(o.titre)}</b><br><span class="tiny muted">${o.parCollab ? 'Par collaborateur' : 'Agence'} · tous les ${esc(periode(o.periodeMois))}${o.premiereMois ? ` · 1re : ${esc(periode(o.premiereMois))} après l’entrée` : ''}</span></span></label>
      <label class="field" style="width:110px"><span>Tous les (mois)</span><input type="number" min="1" max="120" value="${o.periodeMois}" data-change="oblig-periode" data-id="${esc(o.id)}"></label>
      <label class="field" style="width:110px"><span>Alerte (jours)</span><input type="number" min="0" max="365" value="${o.alerteJours ?? 15}" data-change="oblig-alerte" data-id="${esc(o.id)}"></label>
      ${o.note ? `<div class="tiny faint" style="flex-basis:100%">${esc(o.note)}</div>` : ''}
    </div>`).join('')}</div>
    <p class="tiny faint" style="margin:10px 0 0">Une obligation est « réalisée » quand une tâche liée (champ « Obligation suivie ») est marquée terminée. Le bouton Planifier propose le premier créneau libre, hors absences.</p>
  </section>`;
}
