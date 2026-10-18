import { esc } from '../dom.js';
import { store, today, insts, taches, equipe, equipeActive, absences, nomCollab, cat, estOuvre } from '../ctx.js';
import { ligneInst, vide, majuscule } from './commun.js';
import { addDays, fmtLong, fmtJour, mondayOf, range } from '../../core/dates.js';
import { aPlanifier, enRetard } from '../../core/agenda.js';
import { absencesLe, presence, typeAbsence } from '../../core/equipe.js';
import { echeancier, ETATS } from '../../core/obligations.js';

export const titre = () => {
  const h = new Date().getHours();
  const prenom = store.reglages().prenom;
  return `${h < 18 ? 'Bonjour' : 'Bonsoir'}${prenom ? `, ${prenom}` : ''}`;
};

export function render() {
  const d = today();
  if (!equipe().length && !taches().length) return accueil();

  const jour = insts(d, d, { avecAgenda: true });
  const retard = enRetard(taches(), d);
  const aplan = aPlanifier(taches());
  const inbox = store.list('inbox').length;
  const obligs = echeancier({ obligations: store.list('obligations'), taches: taches(), equipe: equipe(), today: d })
    .filter(r => r.etat === 'retard' || r.etat === 'aplanifier');
  const seuil = store.reglages().seuilPresents ?? 0;
  const joursBas = range(d, addDays(d, 20)).filter(estOuvre)
    .map(x => ({ x, ...presence(equipe(), absences(), x) })).filter(p => p.effectif && p.presents < seuil);
  const absJour = absencesLe(absences(), d).filter(a => a.statut !== 'refusee');
  const finSem = addDays(mondayOf(d), 6);
  const absSemaine = absences().filter(a => a.statut !== 'refusee' && a.du <= finSem && (a.au || a.du) >= d && !absJour.some(x => x.id === a.id))
    .sort((a, b) => a.du.localeCompare(b.du));
  const demain = insts(addDays(d, 1), addDays(d, 1), { avecAgenda: true }).filter(i => i.statut !== 'annule');

  const debutMois = d.slice(0, 8) + '01', finMois = addDays(addDays(debutMois, 31).slice(0, 8) + '01', -1);
  const moisInsts = insts(debutMois, finMois);
  const objectifs = store.categories().filter(c => c.objectifMois > 0).map(c => ({ c, fait: moisInsts.filter(i => i.tache.cat === c.id && i.statut === 'fait').length }));
  const memos = store.list('memos').sort((a, b) => (b._t ?? 0) - (a._t ?? 0)).slice(0, 6);

  return `
  <p class="muted" style="margin:-10px 0 16px">${esc(majuscule(fmtLong(d)))}</p>
  <div class="grid cols-3">
    <section class="card span-2">
      <header><h2>Agenda du jour</h2><button class="btn small" data-act="nouvelle-tache" data-date="${d}">+ Ajouter</button></header>
      <div class="list">${jour.length ? jour.map(i => ligneInst(i)).join('') : vide('Rien de prévu aujourd’hui.')}</div>
      ${demain.length ? `<div class="group-title">Demain</div><div class="list">${demain.slice(0, 4).map(i => ligneInst(i)).join('')}${demain.length > 4 ? `<a class="small" href="#/planning">+ ${demain.length - 4} autre(s)</a>` : ''}</div>` : ''}
    </section>

    <section class="card">
      <header><h2>À traiter</h2></header>
      <div class="stack">
        ${ligneAlerte('#/avalider', inbox, 'dictée(s) à valider', 'accent')}
        ${ligneAlerte('#/taches?f=retard', retard.length, 'tâche(s) en retard', 'danger')}
        ${ligneAlerte('#/obligations', obligs.filter(o => o.etat === 'retard').length, 'obligation(s) en retard', 'danger')}
        ${ligneAlerte('#/obligations', obligs.filter(o => o.etat === 'aplanifier').length, 'obligation(s) à planifier', 'warn')}
        ${ligneAlerte('#/taches?f=aplanifier', aplan.length, 'tâche(s) sans date', 'warn')}
        ${ligneAlerte('#/equipe', joursBas.length, `jour(s) sous ${seuil} présents (3 sem.)`, 'danger')}
        ${!inbox && !retard.length && !obligs.length && !aplan.length && !joursBas.length ? vide('Tout est à jour.') : ''}
      </div>
    </section>

    <section class="card">
      <header><h2>Absences</h2><button class="btn small" data-act="nouvelle-absence">+ Absence</button></header>
      ${absJour.length ? `<div class="group-title" style="margin-top:0">Aujourd’hui</div>${absJour.map(a => ligneAbs(a)).join('')}` : '<p class="small muted" style="margin:0">Toute l’équipe est là aujourd’hui.</p>'}
      ${absSemaine.length ? `<div class="group-title">Cette semaine</div>${absSemaine.map(a => ligneAbs(a, true)).join('')}` : ''}
      ${joursBas.length ? `<div class="alert danger" style="margin-top:10px">Effectif bas : ${joursBas.slice(0, 4).map(j => `${fmtJour(j.x)} (${j.presents}/${j.effectif})`).join(', ')}</div>` : ''}
    </section>

    <section class="card">
      <header><h2>Obligations</h2><a class="small" href="#/obligations">Tout voir</a></header>
      <div class="list">${obligs.slice(0, 5).map(r => `
        <div class="item" style="cursor:default">
          <div class="what"><div class="title">${esc(r.libelle)}</div><div class="meta">Échéance ${esc(fmtJour(r.echeance))}</div></div>
          <span class="pill ${r.etat === 'retard' ? 'danger' : 'warn'}">${ETATS[r.etat].nom}</span>
          <button class="btn small" data-act="planifier-oblig" data-oblig="${esc(r.obligation.id)}" data-collab="${esc(r.collab?.id ?? '')}">Planifier</button>
        </div>`).join('') || vide('Aucune échéance proche.')}</div>
    </section>

    <section class="card">
      <header><h2>Objectifs du mois</h2></header>
      <div class="stack">${objectifs.map(({ c, fait }) => `
        <div><div class="row small"><span class="dot" style="--c:${esc(c.couleur)}"></span><span>${esc(c.nom)}</span><span class="spacer"></span><b>${fait}</b><span class="muted">/ ${c.objectifMois}</span></div>
        <div class="progress" style="--c:${esc(c.couleur)};margin-top:4px"><i style="width:${Math.min(100, Math.round((fait / c.objectifMois) * 100))}%"></i></div></div>`).join('') || vide('Définissez des objectifs dans Réglages.')}</div>
    </section>

    ${memos.length ? `<section class="card span-2"><header><h2>Mémos</h2></header>
      <div class="list">${memos.map(m => `<div class="item" style="cursor:default"><div class="what"><div class="title" style="white-space:normal">${esc(m.texte)}</div><div class="meta">${esc(fmtJour(m.date))}</div></div>
        <button class="btn small ghost" data-act="memo-en-tache" data-id="${m.id}">En tâche</button>
        <button class="btn small ghost" data-act="suppr-memo" data-id="${m.id}" aria-label="Supprimer le mémo">✕</button></div>`).join('')}</div></section>` : ''}
  </div>`;
}

function ligneAlerte(href, n, texte, ton) {
  if (!n) return '';
  return `<a class="item" href="${href}" style="text-decoration:none;color:inherit"><span class="pill ${ton}" style="min-width:30px;justify-content:center">${n}</span><span class="what">${esc(texte)}</span><span class="faint">›</span></a>`;
}

function ligneAbs(a, avecDates = false) {
  const t = typeAbsence(a.type);
  const p = a.portion && a.portion !== 'journee' ? (a.portion === 'matin' ? ' (matin)' : ' (après-midi)') : '';
  return `<div class="item" data-act="ouvrir-absence" data-id="${esc(a.id)}">
    <span class="dot" style="--c:${esc(t.couleur)}"></span>
    <div class="what"><div class="title">${esc(nomCollab(a.collab))}${esc(p)}</div>
    <div class="meta">${esc(t.absent ? 'Absent(e)' : t.nom)}${avecDates ? ` · ${esc(fmtJour(a.du))}${a.au && a.au !== a.du ? ` → ${esc(fmtJour(a.au))}` : ''}` : ''}${a.statut === 'demandee' ? ' · demandée' : ''}</div></div></div>`;
}

function accueil() {
  return `<section class="card" style="max-width:640px">
    <h2 style="font-size:20px;margin-bottom:8px">Bienvenue 👋</h2>
    <p class="muted" style="margin-top:0">Trois étapes pour démarrer :</p>
    <ol class="steps">
      <li><b>Ajoutez votre équipe</b> : prénoms, noms et dates d’entrée (pour les échéances d’entretiens).</li>
      <li><b>Saisissez ou dictez</b> vos rendez-vous : « Double écoute avec Marc mardi 14 h ».</li>
      <li><b>Activez la synchro</b> dans Réglages pour retrouver tout sur l’iPhone et dicter depuis l’Apple Watch.</li>
    </ol>
    <div class="row" style="margin-top:14px">
      <button class="btn primary" data-act="nouveau-collab">Ajouter un collaborateur</button>
      <button class="btn" data-act="charger-exemple">Essayer avec un exemple</button>
    </div>
  </section>`;
}
