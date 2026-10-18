// Formulaires : tâche, absence, collaborateur.

import { store, equipe, equipeActive, cat, conflitsDe, today, nomCollab } from './ctx.js';
import { esc, ouvrirDialogue, toast, confirmer, telecharger, ICONES } from './dom.js';
import { STATUTS, PRIOS, FREQS, instances } from '../core/agenda.js';
import { TYPES_ABSENCE } from '../core/defaults.js';
import { fmtLong, toMin, toHHMM } from '../core/dates.js';
import { buildIcs } from '../core/ics.js';
import { nomComplet } from '../core/equipe.js';

const opts = (list, val) => list.map(o => `<option value="${esc(o.id)}"${o.id === val ? ' selected' : ''}>${esc(o.nom)}</option>`).join('');
const PORTIONS = [{ id: 'journee', nom: 'Journée' }, { id: 'matin', nom: 'Matin' }, { id: 'apresmidi', nom: 'Après-midi' }];

// ---------- Tâche ----------
// id : tâche existante ; occ : date de l'occurrence ouverte (tâche récurrente) ; preset : valeurs initiales.
export function ouvrirTache({ id = null, occ = null, preset = {}, onSave } = {}) {
  const existante = id ? store.get('taches', id) : null;
  const t = existante ? { ...existante } : {
    titre: '', cat: store.reglages().categorieDefaut, date: today(), debut: '', fin: '', collabs: [], statut: 'afaire', prio: 'normale', notes: '', ...preset,
  };
  if (!existante && t.debut && !t.fin) t.fin = toHHMM(toMin(t.debut) + (cat(t.cat).duree ?? 60));
  const recurrente = !!existante?.rec?.freq;
  const occStatut = recurrente && occ ? (existante.occ?.[occ]?.statut ?? 'afaire') : null;
  const obligations = store.list('obligations').filter(o => o.actif);

  const html = `
    <div class="dlg-head"><h2>${existante ? 'Modifier la tâche' : 'Nouvelle tâche'}</h2>
      <button class="btn icon ghost" data-close aria-label="Fermer">${ICONES.fermer}</button></div>
    <form class="dlg-body" id="f-tache" autocomplete="off">
      ${recurrente && occ ? `<div class="alert info">${ICONES.repete.replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-2px"')} Occurrence du ${esc(fmtLong(occ))}.
        <div class="row" style="margin-top:8px">
          <button type="button" class="btn small" data-occ="fait">${occStatut === 'fait' ? 'Marquer à faire' : 'Marquer terminée'}</button>
          <button type="button" class="btn small" data-occ="detacher">Modifier seulement celle-ci</button>
          <button type="button" class="btn small danger" data-occ="annuler">Annuler cette occurrence</button>
        </div><div class="tiny" style="margin-top:6px">Les champs ci-dessous modifient toute la série.</div></div>` : ''}
      <div class="fields">
        <label class="field f-6"><span>Titre</span><input type="text" name="titre" value="${esc(t.titre)}" required autofocus placeholder="Ex. Double écoute"></label>
        <label class="field f-3"><span>Catégorie</span><select name="cat">${opts(store.categories(), t.cat)}</select></label>
        <label class="field f-3"><span>Date <span class="faint">(vide = à planifier)</span></span><input type="date" name="date" value="${esc(t.date)}"></label>
        <label class="field f-2"><span>Début</span><input type="time" name="debut" value="${esc(t.debut)}" step="300"></label>
        <label class="field f-2"><span>Fin</span><input type="time" name="fin" value="${esc(t.fin)}" step="300"></label>
        <label class="field f-2"><span>Priorité</span><select name="prio">${opts(PRIOS, t.prio)}</select></label>
      </div>
      <div class="stack"><span class="small muted" style="font-weight:600">Collaborateurs concernés</span>
        <div class="chips" id="t-collabs">${equipeActive().map(c => `<button type="button" class="chip" data-collab="${c.id}" aria-pressed="${t.collabs?.includes(c.id)}"><span class="dot" style="--c:${esc(c.couleur)}"></span>${esc(nomComplet(c))}</button>`).join('') || '<span class="small faint">Ajoutez votre équipe dans l’onglet Équipe.</span>'}</div>
      </div>
      <div class="fields">
        <label class="field f-2"><span>Statut</span><select name="statut">${opts(STATUTS, t.statut)}</select></label>
        <label class="field f-2"><span>Répétition</span><select name="freq">${opts(FREQS, t.rec?.freq ?? '')}</select></label>
        <label class="field f-2"><span>Jusqu’au</span><input type="date" name="jusqu" value="${esc(t.rec?.jusqu ?? '')}"></label>
        <label class="field f-6"><span>Obligation suivie</span><select name="oblig"><option value="">Aucune</option>${opts(obligations.map(o => ({ id: o.id, nom: o.titre })), t.oblig)}</select></label>
        <label class="field f-6"><span>Notes</span><textarea name="notes" placeholder="Points à aborder… (pas de données de santé)">${esc(t.notes)}</textarea></label>
      </div>
      <div id="t-conflits"></div>
    </form>
    <div class="dlg-foot">
      ${existante ? `<button class="btn danger" data-act-local="suppr">Supprimer</button><button class="btn" data-act-local="ics" title="Ajouter au Calendrier">${ICONES.calendrier}</button>` : ''}
      <span class="spacer"></span>
      <button class="btn" data-close>Annuler</button>
      <button class="btn primary" type="submit" form="f-tache">Enregistrer</button>
    </div>`;

  ouvrirDialogue(html, {
    onMount: (dlg, fermer) => {
      const f = dlg.querySelector('#f-tache');
      const collabs = new Set(t.collabs ?? []);
      const lireForm = () => {
        const v = Object.fromEntries(new FormData(f));
        return { ...t, titre: v.titre.trim(), cat: v.cat, date: v.date, debut: v.debut, fin: v.fin, prio: v.prio, statut: v.statut,
          notes: v.notes, oblig: v.oblig || undefined, collabs: [...collabs],
          rec: v.freq ? { freq: v.freq, ...(v.jusqu ? { jusqu: v.jusqu } : {}) } : undefined, id: existante ? id : undefined };
      };
      const majConflits = () => {
        const cand = lireForm();
        const cs = conflitsDe({ ...cand, key: existante ? (recurrente ? `${id}@${occ}` : id) : '__new' });
        dlg.querySelector('#t-conflits').innerHTML = cs.length ? `<div class="alert warn">${cs.map(c => esc(c.texte)).join('<br>')}</div>` : '';
      };
      f.addEventListener('input', e => {
        if (e.target.name === 'debut' && e.target.value) {
          const fin = f.elements.fin; const d = toMin(e.target.value);
          if (!fin.value || toMin(fin.value) <= d) fin.value = toHHMM(Math.min(d + (cat(f.elements.cat.value).duree ?? 60), 23 * 60 + 55));
        }
        majConflits();
      });
      dlg.querySelector('#t-collabs').addEventListener('click', e => {
        const b = e.target.closest('[data-collab]'); if (!b) return;
        const c = b.dataset.collab;
        collabs.has(c) ? collabs.delete(c) : collabs.add(c);
        b.setAttribute('aria-pressed', collabs.has(c));
        majConflits();
      });
      majConflits();

      f.addEventListener('submit', e => {
        e.preventDefault();
        const v = lireForm();
        if (!v.titre) return toast('Le titre est obligatoire.');
        if (v.debut && v.fin && toMin(v.fin) <= toMin(v.debut)) return toast('La fin doit être après le début.');
        if (v.rec && !v.date) return toast('Une tâche répétée a besoin d’une date de départ.');
        if (!v.debut) v.fin = '';
        if (v.statut === 'fait' && existante?.statut !== 'fait') v.faitLe = today();
        if (!v.rec) delete v.rec;
        if (!v.oblig) delete v.oblig;
        const newId = store.put('taches', v);
        fermer();
        toast(existante ? 'Tâche modifiée' : 'Tâche ajoutée');
        onSave?.(newId);
      });

      dlg.querySelectorAll('[data-occ]').forEach(b => b.onclick = () => {
        const occs = { ...(existante.occ ?? {}) };
        if (b.dataset.occ === 'fait') occs[occ] = { ...occs[occ], statut: occStatut === 'fait' ? 'afaire' : 'fait' };
        if (b.dataset.occ === 'annuler') occs[occ] = { ...occs[occ], annule: true };
        if (b.dataset.occ === 'detacher') {
          occs[occ] = { ...occs[occ], annule: true };
          store.patch('taches', id, { occ: occs });
          const { id: _x, rec: _r, occ: _o, _t: _tt, ...base } = existante;
          const nid = store.put('taches', { ...base, date: occ, statut: occStatut ?? 'afaire' });
          fermer();
          return ouvrirTache({ id: nid });
        }
        store.patch('taches', id, { occ: occs });
        fermer();
        toast(b.dataset.occ === 'annuler' ? 'Occurrence annulée' : 'Occurrence mise à jour');
      });

      dlg.querySelector('[data-act-local="suppr"]')?.addEventListener('click', async () => {
        fermer();
        if (!(await confirmer(recurrente ? 'Supprimer toute la série ?' : 'Supprimer cette tâche ?', { ok: 'Supprimer', danger: true }))) return;
        const sauvegarde = store.get('taches', id);
        store.remove('taches', id);
        toast('Tâche supprimée', { action: 'Annuler', onAction: () => store.put('taches', { ...sauvegarde, id }) });
      });
      dlg.querySelector('[data-act-local="ics"]')?.addEventListener('click', () => {
        const d = occ ?? existante.date;
        if (!d) return toast('Donnez une date à la tâche d’abord.');
        const inst = instances([{ ...existante, id, rec: undefined, date: d }], d, d);
        telecharger(`${existante.titre.replace(/[^\p{L}\d -]/gu, '').slice(0, 40) || 'tache'}.ics`,
          buildIcs({ insts: inst, equipe: equipe(), categorie: cat, rappelMinutes: store.reglages().rappelMinutes }), 'text/calendar');
      });
    },
  });
}

// ---------- Absence ----------
export function ouvrirAbsence({ id = null, preset = {}, onSave } = {}) {
  const existante = id ? store.get('absences', id) : null;
  const a = existante ?? { collab: equipeActive()[0]?.id, type: 'conges', du: today(), au: today(), portionDebut: 'journee', portionFin: 'journee', statut: 'validee', note: '', ...preset };
  if (!equipe().length) return toast('Ajoutez d’abord un collaborateur.');
  ouvrirDialogue(`
    <div class="dlg-head"><h2>${existante ? 'Modifier l’absence' : 'Nouvelle absence'}</h2>
      <button class="btn icon ghost" data-close aria-label="Fermer">${ICONES.fermer}</button></div>
    <form class="dlg-body" id="f-abs">
      <div class="fields">
        <label class="field f-3"><span>Collaborateur</span><select name="collab">${opts(equipe().map(c => ({ id: c.id, nom: nomComplet(c) })), a.collab)}</select></label>
        <label class="field f-3"><span>Type</span><select name="type">${opts(TYPES_ABSENCE, a.type)}</select></label>
        <label class="field f-3"><span>Du</span><input type="date" name="du" value="${esc(a.du)}" required></label>
        <label class="field f-3"><span>Au (inclus)</span><input type="date" name="au" value="${esc(a.au || a.du)}" required></label>
        <label class="field f-3"><span>Premier jour</span><select name="portionDebut">${opts(PORTIONS, a.portionDebut)}</select></label>
        <label class="field f-3"><span>Dernier jour</span><select name="portionFin">${opts(PORTIONS, a.portionFin)}</select></label>
        <label class="field f-3"><span>Statut</span><select name="statut">${opts([{ id: 'validee', nom: 'Validée' }, { id: 'demandee', nom: 'Demandée' }, { id: 'refusee', nom: 'Refusée' }], a.statut)}</select></label>
        <label class="field f-3" data-heures ${a.type === 'formation' ? '' : 'hidden'}><span>Heures de formation (DDA)</span><input type="number" name="heures" min="0" step="0.5" value="${esc(a.heures ?? '')}"></label>
        <label class="field f-6"><span>Commentaire</span><input type="text" name="note" value="${esc(a.note)}" placeholder="Jamais de motif médical"></label>
      </div>
    </form>
    <div class="dlg-foot">
      ${existante ? '<button class="btn danger" data-suppr>Supprimer</button>' : ''}
      <span class="spacer"></span><button class="btn" data-close>Annuler</button>
      <button class="btn primary" type="submit" form="f-abs">Enregistrer</button>
    </div>`, {
    onMount: (dlg, fermer) => {
      const f = dlg.querySelector('#f-abs');
      f.elements.type.onchange = () => { dlg.querySelector('[data-heures]').hidden = f.elements.type.value !== 'formation'; };
      f.elements.du.onchange = () => { if (f.elements.au.value < f.elements.du.value) f.elements.au.value = f.elements.du.value; };
      f.onsubmit = e => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(f));
        if (v.au < v.du) return toast('La date de fin est avant le début.');
        store.put('absences', { ...existante, ...v, heures: v.type === 'formation' && v.heures ? Number(v.heures) : undefined, id: existante ? id : undefined });
        fermer();
        toast(existante ? 'Absence modifiée' : 'Absence ajoutée');
        onSave?.();
      };
      dlg.querySelector('[data-suppr]')?.addEventListener('click', () => {
        const s = store.get('absences', id); store.remove('absences', id); fermer();
        toast('Absence supprimée', { action: 'Annuler', onAction: () => store.put('absences', { ...s, id }) });
      });
    },
  });
}

// ---------- Collaborateur ----------
const COULEURS = ['#4d57d1', '#2fb38a', '#e3a33b', '#e26d8c', '#8b7cf6', '#4a9fe8', '#d9603b', '#3aa6a0', '#9a6dd7', '#6b8e23'];
export function ouvrirCollab({ id = null } = {}) {
  const existant = id ? store.get('equipe', id) : null;
  const c = existant ?? { prenom: '', nom: '', poste: '', entree: '', actif: true, dda: true, couleur: COULEURS[equipe().length % COULEURS.length] };
  ouvrirDialogue(`
    <div class="dlg-head"><h2>${existant ? esc(nomComplet(c)) : 'Nouveau collaborateur'}</h2>
      <button class="btn icon ghost" data-close aria-label="Fermer">${ICONES.fermer}</button></div>
    <form class="dlg-body" id="f-collab" autocomplete="off">
      <div class="fields">
        <label class="field f-3"><span>Prénom</span><input type="text" name="prenom" value="${esc(c.prenom)}" required autofocus></label>
        <label class="field f-3"><span>Nom</span><input type="text" name="nom" value="${esc(c.nom)}"></label>
        <label class="field f-4"><span>Poste</span><input type="text" name="poste" value="${esc(c.poste)}" placeholder="Conseiller, chargé de clientèle…"></label>
        <label class="field f-2"><span>Couleur</span><input type="color" name="couleur" value="${esc(c.couleur)}" style="width:100%;height:40px;border:1px solid var(--border);border-radius:8px;background:none"></label>
        <label class="field f-3"><span>Date d’entrée</span><input type="date" name="entree" value="${esc(c.entree)}"></label>
        <label class="field f-3"><span>Date de sortie</span><input type="date" name="sortie" value="${esc(c.sortie ?? '')}"></label>
      </div>
      <label class="check"><input type="checkbox" name="dda" ${c.dda ? 'checked' : ''}> Concerné par la formation DDA (15 h/an)</label>
      <label class="check"><input type="checkbox" name="actif" ${c.actif !== false ? 'checked' : ''}> Actif dans l’équipe</label>
      <p class="tiny faint" style="margin:0">La date d’entrée sert à calculer les échéances (entretien de parcours professionnel dans l’année qui suit l’embauche, puis tous les 4 ans).</p>
    </form>
    <div class="dlg-foot">
      ${existant ? '<button class="btn danger" data-suppr>Supprimer</button>' : ''}
      <span class="spacer"></span><button class="btn" data-close>Annuler</button>
      <button class="btn primary" type="submit" form="f-collab">Enregistrer</button>
    </div>`, {
    onMount: (dlg, fermer) => {
      const f = dlg.querySelector('#f-collab');
      f.onsubmit = e => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(f));
        store.put('equipe', { ...existant, ...v, prenom: v.prenom.trim(), nom: v.nom.trim(), dda: !!v.dda, actif: !!v.actif, sortie: v.sortie || undefined, id: existant ? id : undefined });
        fermer();
        toast(existant ? 'Fiche mise à jour' : `${v.prenom} ajouté(e) à l’équipe`);
      };
      dlg.querySelector('[data-suppr]')?.addEventListener('click', async () => {
        fermer();
        const n = store.list('taches').filter(t => t.collabs?.includes(id)).length;
        if (!(await confirmer(`Supprimer ${nomCollab(id)} ?${n ? ` ${n} tâche(s) le/la mentionnent encore. Pour garder l’historique, décochez plutôt « Actif ».` : ''}`, { ok: 'Supprimer', danger: true }))) return;
        store.remove('equipe', id);
        toast('Collaborateur supprimé');
      });
    },
  });
}
