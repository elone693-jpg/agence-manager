import { esc } from '../dom.js';
import { store, nomCollab, cat } from '../ctx.js';
import { vide } from './commun.js';
import { fmtJour, fmtHeure } from '../../core/dates.js';
import { typeAbsence } from '../../core/equipe.js';

export const titre = () => 'À valider';

export function render() {
  const items = store.list('inbox').sort((a, b) => (a.recu ?? '').localeCompare(b.recu ?? ''));
  if (!items.length) return `<section class="card">${vide('Rien à valider. Les dictées comprises sans ambiguïté sont ajoutées directement.')}</section>`;
  return `<p class="muted" style="margin-top:-6px">Ces dictées n’ont pas été ajoutées automatiquement : vérifiez-les.</p>
  <div class="stack">${items.map(carte).join('')}</div>`;
}

function carte(it) {
  const a = it.analyse ?? {};
  let resume = '';
  if (a.action === 'tache') {
    resume = `<b>${esc(a.titre)}</b> · ${esc(cat(a.cat).nom)}${a.date ? ` · ${esc(fmtJour(a.date))}` : ' · sans date'}${a.debut ? ` · ${esc(fmtHeure(a.debut))}–${esc(fmtHeure(a.fin))}` : ''}${a.collabs?.length ? ` · ${esc(a.collabs.map(id => nomCollab(id)).join(', '))}` : ''}`;
  } else if (a.action === 'absence') {
    resume = `<b>Absence</b> · ${esc(a.collab ? nomCollab(a.collab) : 'personne à préciser')} · ${esc(typeAbsence(a.type).nom)}${a.du ? ` · ${esc(fmtJour(a.du))}${a.au && a.au !== a.du ? ` → ${esc(fmtJour(a.au))}` : ''}` : ''}`;
  } else resume = 'Non comprise';
  const candidats = (a.candidats ?? []).filter(id => store.get('equipe', id));
  return `<section class="card">
    <div class="row" style="align-items:flex-start;flex-wrap:nowrap">
      <div style="flex:1;min-width:0">
        <div style="font-size:16px">« ${esc(it.texte)} »</div>
        <div class="small muted" style="margin-top:4px">${it.source === 'montre' ? 'Apple Watch / Raccourci' : 'Saisie'}${it.recu ? ` · ${esc(new Date(it.recu).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }))}` : ''}</div>
      </div>
    </div>
    <div class="small" style="margin-top:10px">Compris : ${resume}</div>
    <div class="chips" style="margin-top:8px">${(a.raisons ?? []).map(r => `<span class="pill warn">${esc(r)}</span>`).join('')}</div>
    ${candidats.length ? `<div class="row small" style="margin-top:10px"><span class="muted">C’est :</span>${candidats.map(id => `<button class="chip" data-act="inbox-choisir" data-id="${esc(it.id)}" data-collab="${esc(id)}">${esc(nomCollab(id))}</button>`).join('')}</div>` : ''}
    <div class="row" style="margin-top:12px">
      <button class="btn primary small" data-act="inbox-ouvrir" data-id="${esc(it.id)}">Vérifier et créer</button>
      <button class="btn small danger" data-act="inbox-suppr" data-id="${esc(it.id)}">Supprimer</button>
    </div>
  </section>`;
}
