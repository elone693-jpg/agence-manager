import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyser, _setHorloge } from '../js/core/voix.js';
import { DEFAUT_CATEGORIES } from '../js/core/defaults.js';

// Samedi 17 octobre 2026, 10 h.
const today = '2026-10-17';
_setHorloge(() => 10 * 60);
const equipe = [
  { id: 'marc', prenom: 'Marc', nom: 'Durand' },
  { id: 'carla', prenom: 'Carla', nom: 'Petit' },
  { id: 'lea1', prenom: 'Léa', nom: 'Martin' },
  { id: 'lea2', prenom: 'Léa', nom: 'Bernard' },
  { id: 'sandra', prenom: 'Sandra', nom: 'Koné' },
];
const ctx = { today, equipe, categories: DEFAUT_CATEGORIES };
const A = t => analyser(t, ctx);

test('double écoute avec un prénom unique, jour de semaine et heure', () => {
  const r = A('Double écoute avec Marc mardi à 14 h');
  assert.equal(r.action, 'tache');
  assert.equal(r.ok, true);
  assert.equal(r.cat, 'coaching');
  assert.equal(r.date, '2026-10-20');
  assert.equal(r.debut, '14:00');
  assert.equal(r.fin, '15:00');
  assert.deepEqual(r.collabs, ['marc']);
  assert.equal(r.titre, 'Double écoute avec Marc');
});

test('prénom porté par deux personnes : jamais deviné', () => {
  const r = A('Entretien avec Léa lundi 9h');
  assert.equal(r.ok, false);
  assert.match(r.raisons.join(), /plusieurs Lea/i);
  assert.deepEqual(r.candidats.sort(), ['lea1', 'lea2']);
  assert.equal(r.date, '2026-10-19');
  assert.equal(r.debut, '09:00');
});

test('prénom + nom lève l’ambiguïté', () => {
  const r = A('Entretien avec Léa Bernard lundi 9h30');
  assert.equal(r.ok, true);
  assert.deepEqual(r.collabs, ['lea2']);
  assert.equal(r.debut, '09:30');
  assert.equal(r.cat, 'entretien');
});

test('absence sur une plage de dates', () => {
  const r = A('Carla en congés du 2 au 6 novembre');
  assert.equal(r.action, 'absence');
  assert.equal(r.ok, true);
  assert.equal(r.collab, 'carla');
  assert.equal(r.type, 'conges');
  assert.equal(r.du, '2026-11-02');
  assert.equal(r.au, '2026-11-06');
});

test('absence d’une demi-journée', () => {
  const r = A('Sandra absente demain matin');
  assert.equal(r.action, 'absence');
  assert.equal(r.du, '2026-10-18');
  assert.equal(r.portionDebut, 'matin');
  assert.equal(r.type, 'autre');
});

test('arrêt maladie toute la semaine prochaine, sans aucun motif', () => {
  const r = A('Marc en arrêt maladie toute la semaine prochaine');
  assert.equal(r.type, 'maladie');
  assert.equal(r.du, '2026-10-19');
  assert.equal(r.au, '2026-10-23');
});

test('plage horaire explicite', () => {
  const r = A('Révision technique MRH jeudi de 10h à 12h');
  assert.equal(r.cat, 'revision');
  assert.equal(r.date, '2026-10-22');
  assert.equal(r.debut, '10:00');
  assert.equal(r.fin, '12:00');
});

test('tâche sans date → à planifier', () => {
  const r = A('Rappelle-moi de valider les visas');
  assert.equal(r.action, 'tache');
  assert.equal(r.ok, true);
  assert.equal(r.date, '');
  assert.equal(r.cat, 'admin');
  assert.equal(r.titre, 'Valider les visas');
});

test('« à 2 h » au bureau = 14 h ; « 9 h du matin » reste 9 h', () => {
  assert.equal(A('Point équipe demain à 2h').debut, '14:00');
  assert.equal(A('Point équipe demain à 9 heures du matin').debut, '09:00');
  assert.equal(A('Brief demain 2 heures de l’après-midi').debut, '14:00');
});

test('date en toutes lettres et format court', () => {
  assert.equal(A('Reporting mensuel le 3 novembre à 10h').date, '2026-11-03');
  assert.equal(A('Reporting le 05/11 à 10h').date, '2026-11-05');
  assert.equal(A('Comité le 26 à 15h').date, '2026-10-26');
});

test('date récemment passée → à valider ; mois passé lointain → année suivante', () => {
  const r = A('Bilan avec Marc le 10 octobre à 9h');
  assert.equal(r.ok, false);
  assert.match(r.raisons.join(), /date passée/);
  assert.equal(A('Séminaire le 15 mars à 9h').date, '2027-03-15');
});

test('durée explicite', () => {
  const r = A('Coaching Carla vendredi 11h pendant 30 minutes');
  assert.equal(r.debut, '11:00');
  assert.equal(r.fin, '11:30');
  assert.deepEqual(r.collabs, ['carla']);
});

test('« dans 2 heures » est un délai, pas 14 h', () => {
  const r = A('Appeler la direction dans 2 heures');
  assert.equal(r.date, today);
  assert.equal(r.debut, '12:00');
});

test('« 1:1 » n’est pas une heure', () => {
  const r = A('1:1 avec Sandra mercredi à 16h');
  assert.equal(r.cat, 'entretien');
  assert.equal(r.debut, '16:00');
  assert.equal(r.date, '2026-10-21');
});

test('personne hors équipe signalée', () => {
  const r = A('Déjeuner avec Paul jeudi à 12h30');
  assert.equal(r.ok, false);
  assert.match(r.raisons.join(), /Paul/);
});

test('midi et après-midi ne se confondent pas', () => {
  assert.equal(A('Point visa demain midi').debut, '12:00');
  assert.equal(A('Point visa demain après-midi').debut, '14:00');
});

test('mémo', () => {
  const r = A('Mémo : commander des fournitures');
  assert.equal(r.action, 'memo');
  assert.equal(r.texte, 'Commander des fournitures');
});

test('jour de la semaine prochaine et fin de semaine', () => {
  // Samedi 17 : la semaine prochaine commence lundi 19.
  assert.equal(A('Debrief mardi de la semaine prochaine à 15h').date, '2026-10-20');
  // Lundi 19 : « mardi » = demain 20, « mardi de la semaine prochaine » = 27.
  const lundi = { ...ctx, today: '2026-10-19' };
  assert.equal(analyser('Debrief mardi à 15h', lundi).date, '2026-10-20');
  assert.equal(analyser('Debrief mardi de la semaine prochaine à 15h', lundi).date, '2026-10-27');
  assert.equal(A('Reporting en fin de semaine').date, '2026-10-23');
});
