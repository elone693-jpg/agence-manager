import { esc } from '../dom.js';
import { cat, nomCollab, store } from '../ctx.js';
import { fmtJour, fmtHeure } from '../../core/dates.js';
import { ICONES } from '../dom.js';

// Ligne de liste pour une instance de tâche (ou une tâche sans date).
export function ligneInst(i, { avecDate = false } = {}) {
  const t = i.tache ?? i;
  const c = cat(t.cat);
  const fait = i.statut === 'fait';
  const quand = [avecDate && i.date ? fmtJour(i.date) : '', i.debut ? `${fmtHeure(i.debut)}${i.fin ? `–${fmtHeure(i.fin)}` : ''}` : (avecDate ? '' : 'Journée')].filter(Boolean).join(' · ');
  const qui = (t.collabs ?? []).map(id => nomCollab(id, true)).join(', ');
  const prio = t.prio === 'urgente' ? '<span class="pill danger">Urgent</span>' : t.prio === 'haute' ? '<span class="pill warn">Haute</span>' : '';
  return `<div class="item${fait ? ' done' : ''}" data-act="ouvrir-tache" data-id="${esc(i.id ?? t.id)}" data-occ="${i.recurrent ? esc(i.date) : ''}">
    <button class="tick" style="--c:${esc(c.couleur)}" data-act="basculer-fait" data-id="${esc(i.id ?? t.id)}" data-occ="${i.recurrent ? esc(i.date) : ''}" aria-pressed="${fait}" aria-label="${fait ? 'Marquer à faire' : 'Marquer terminé'}"></button>
    <div class="what"><div class="title">${esc(t.titre)} ${i.recurrent ? `<span class="faint" title="Répétée">${ICONES.repete.replace('<svg', '<svg style="width:12px;height:12px;vertical-align:-1px"')}</span>` : ''}</div>
      <div class="meta"><span class="dot" style="--c:${esc(c.couleur)};display:inline-block;margin-right:4px"></span>${esc(c.nom)}${qui ? ` · ${esc(qui)}` : ''}</div></div>
    ${prio}
    <div class="when nowrap" style="text-align:right">${esc(quand)}</div>
  </div>`;
}

export const majuscule = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
export const vide = texte => `<div class="empty">${esc(texte)}</div>`;

export function basculerFait(id, occ) {
  const t = store.get('taches', id);
  if (!t) return;
  if (occ) {
    const occs = { ...(t.occ ?? {}) };
    const etait = occs[occ]?.statut === 'fait';
    occs[occ] = { ...occs[occ], statut: etait ? 'afaire' : 'fait' };
    store.patch('taches', id, { occ: occs });
  } else {
    const fait = t.statut === 'fait';
    store.patch('taches', id, { statut: fait ? 'afaire' : 'fait', faitLe: fait ? undefined : new Date().toISOString().slice(0, 10) });
  }
}
