// Échéancier des obligations managériales.
// La prochaine échéance part de la dernière tâche « terminée » liée à l'obligation (champ oblig)
// et au collaborateur ; à défaut, de la date d'entrée (+ premiereMois), sinon elle est due tout de suite.

import { addMonths, diffDays } from './dates.js';
import { instances } from './agenda.js';
import { actifLe, nomComplet } from './equipe.js';

export const ETATS = {
  retard: { nom: 'En retard', ordre: 0 },
  aplanifier: { nom: 'À planifier', ordre: 1 },
  planifie: { nom: 'Planifié', ordre: 2 },
  ajour: { nom: 'À jour', ordre: 3 },
};

export function echeancier({ obligations, taches, equipe, today }) {
  const insts = instances(taches, '2000-01-01', addMonths(today, 24));
  const rows = [];
  for (const o of obligations.filter(o => o.actif)) {
    const cibles = o.parCollab
      ? equipe.filter(c => actifLe(c, today) && (!o.collabs?.length || o.collabs.includes(c.id)))
      : [null];
    for (const c of cibles) {
      const liees = insts.filter(i => i.tache.oblig === o.id && (!c || i.tache.collabs?.includes(c.id)));
      const faites = liees.filter(i => i.statut === 'fait').map(i => i.tache.faitLe || i.date).sort();
      const derniere = faites.at(-1) ?? null;
      const prochaine = liees.filter(i => ['afaire', 'encours'].includes(i.statut) && i.date >= today).map(i => i.date).sort()[0] ?? null;
      // Sans historique, on ne peut pas affirmer un retard : l'obligation est « à planifier »
      // (sauf première échéance encore à venir après une embauche récente).
      let echeance;
      if (derniere) echeance = addMonths(derniere, o.periodeMois);
      else if (c?.entree && o.premiereMois && addMonths(c.entree, o.premiereMois) > today) echeance = addMonths(c.entree, o.premiereMois);
      else echeance = today;
      const jours = diffDays(today, echeance);
      let etat;
      // Déjà planifié : c'est pris en charge, même si la date dépasse l'échéance (signalé par horsDelai).
      if (prochaine) etat = 'planifie';
      else if (jours < 0) etat = 'retard';
      else if (jours <= (o.alerteJours ?? 15)) etat = 'aplanifier';
      else etat = 'ajour';
      rows.push({ obligation: o, collab: c, libelle: c ? `${o.titre} — ${nomComplet(c)}` : o.titre, derniere, prochaine, echeance, jours, etat,
        horsDelai: !!prochaine && prochaine > echeance });
    }
  }
  return rows.sort((a, b) => ETATS[a.etat].ordre - ETATS[b.etat].ordre || a.echeance.localeCompare(b.echeance));
}
