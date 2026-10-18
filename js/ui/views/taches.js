import { esc } from '../dom.js';
import { ui, store, today, insts, taches, nomCollab } from '../ctx.js';
import { ligneInst, vide } from './commun.js';
import { addDays, fmtJour } from '../../core/dates.js';
import { aPlanifier, enRetard } from '../../core/agenda.js';

export const titre = () => 'Tâches';

const FILTRES = [
  { id: 'avenir', nom: 'À venir' },
  { id: 'retard', nom: 'En retard' },
  { id: 'aplanifier', nom: 'Sans date' },
  { id: 'faites', nom: 'Terminées' },
];

export function render() {
  const d = today();
  const q = ui.rechercheTaches.trim().toLowerCase();
  const cats = ui.catsTaches;
  const garde = i => {
    const t = i.tache ?? i;
    if (cats.length && !cats.includes(t.cat)) return false;
    if (!q) return true;
    return `${t.titre} ${t.notes ?? ''} ${(t.collabs ?? []).map(id => nomCollab(id)).join(' ')}`.toLowerCase().includes(q);
  };

  let liste = [];
  if (ui.filtreTaches === 'avenir') liste = insts(d, addDays(d, 60)).filter(i => ['afaire', 'encours'].includes(i.statut));
  if (ui.filtreTaches === 'retard') liste = enRetard(taches(), d).reverse();
  if (ui.filtreTaches === 'aplanifier') liste = aPlanifier(taches());
  if (ui.filtreTaches === 'faites') liste = insts(addDays(d, -60), d).filter(i => i.statut === 'fait').reverse();
  liste = liste.filter(garde);

  const compte = {
    retard: enRetard(taches(), d).length,
    aplanifier: aPlanifier(taches()).length,
  };

  let corps;
  if (!liste.length) corps = vide({ avenir: 'Aucune tâche à venir.', retard: 'Aucun retard. 👏', aplanifier: 'Toutes les tâches ont une date.', faites: 'Rien de terminé ces 60 derniers jours.' }[ui.filtreTaches]);
  else if (ui.filtreTaches === 'aplanifier') corps = `<div class="list">${liste.map(t => ligneInst(t)).join('')}</div>`;
  else {
    const groupes = new Map();
    for (const i of liste) { if (!groupes.has(i.date)) groupes.set(i.date, []); groupes.get(i.date).push(i); }
    corps = [...groupes].map(([date, is]) => `<div class="group-title">${date === d ? 'Aujourd’hui' : date === addDays(d, 1) ? 'Demain' : esc(fmtJour(date))}</div>
      <div class="list">${is.map(i => ligneInst(i)).join('')}</div>`).join('');
  }

  return `
  <div class="row" style="margin-bottom:12px">
    <div class="seg" role="group" aria-label="Filtre">${FILTRES.map(f => `<button data-act="filtre-taches" data-f="${f.id}" aria-pressed="${ui.filtreTaches === f.id}">${f.nom}${compte[f.id] ? ` <span class="pill ${f.id === 'retard' ? 'danger' : 'warn'}">${compte[f.id]}</span>` : ''}</button>`).join('')}</div>
    <span class="spacer"></span>
    <input type="search" placeholder="Rechercher…" value="${esc(ui.rechercheTaches)}" data-input="recherche-taches" style="max-width:220px" aria-label="Rechercher une tâche">
    <button class="btn primary" data-act="nouvelle-tache" data-date="">+ Tâche</button>
  </div>
  <div class="chips" style="margin-bottom:12px">${store.categories().map(c => `<button class="chip" data-act="filtre-cat" data-cat="${esc(c.id)}" aria-pressed="${cats.includes(c.id)}"><span class="dot" style="--c:${esc(c.couleur)}"></span>${esc(c.nom)}</button>`).join('')}</div>
  <section class="card">${corps}</section>`;
}
