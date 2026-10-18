import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, ferie, isoWeek, dow, fmtJour } from '../js/core/dates.js';
import { occurrences, instances, conflits, creneauLibre, enRetard } from '../js/core/agenda.js';
import { absencesLe, presence, heuresFormation } from '../js/core/equipe.js';
import { echeancier } from '../js/core/obligations.js';
import { buildIcs, fold } from '../js/core/ics.js';
import { Store, merge, sameData, emptyData } from '../js/core/store.js';
import { DEFAUT_OBLIGATIONS } from '../js/core/defaults.js';

test('dates : mois plus courts, fériés, semaines ISO', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2026-10-17', 48), '2030-10-17');
  assert.equal(ferie('2027-03-29'), 'Lundi de Pâques');
  assert.equal(ferie('2026-11-01'), 'Toussaint');
  assert.equal(ferie('2026-05-25'), 'Lundi de Pentecôte');
  assert.equal(isoWeek('2026-10-17'), 42);
  assert.equal(isoWeek('2027-01-01'), 53);
  assert.equal(dow('2026-10-25'), 6); // jour du changement d'heure : dimanche, sans décalage
  assert.equal(fmtJour('2026-10-26'), 'lun. 26 oct.');
});

test('récurrences : hebdo, 2 semaines, mensuelle, occurrence annulée', () => {
  const t = { id: 't', date: '2026-10-02', rec: { freq: 'hebdo' }, occ: { '2026-10-16': { annule: true } } };
  assert.deepEqual(occurrences(t, '2026-10-12', '2026-10-31'), ['2026-10-23', '2026-10-30']);
  assert.deepEqual(occurrences({ date: '2026-10-05', rec: { freq: '2sem' } }, '2026-10-06', '2026-11-03'), ['2026-10-19', '2026-11-02']);
  assert.deepEqual(occurrences({ date: '2026-01-31', rec: { freq: 'mensuel', jusqu: '2026-04-30' } }, '2026-01-01', '2026-12-31'),
    ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
});

const T = (id, date, debut, fin, extra = {}) => ({ id, titre: id, date, debut, fin, statut: 'afaire', collabs: [], ...extra });

test('conflits : chevauchement, bord à bord accepté, annulée ignorée, absence', () => {
  const insts = instances([T('A', '2026-10-19', '09:00', '10:00'), T('B', '2026-10-19', '11:00', '12:00', { statut: 'annule' })], '2026-10-19', '2026-10-19');
  assert.equal(conflits(T('X', '2026-10-19', '09:30', '10:30'), insts, []).length, 1);
  assert.equal(conflits(T('X', '2026-10-19', '10:00', '11:00'), insts, []).length, 0);
  assert.equal(conflits(T('X', '2026-10-19', '11:00', '12:00'), insts, []).length, 0);
  const abs = absencesLe([{ id: 'a', collab: 'carla', du: '2026-10-19', au: '2026-10-23', type: 'conges', statut: 'validee' }], '2026-10-23');
  assert.equal(conflits(T('E', '2026-10-23', '16:00', '17:00', { collabs: ['carla'] }), [], abs)[0].type, 'absence');
  assert.equal(conflits(T('E', '2026-10-23', '16:00', '17:00', { collabs: ['marc'] }), [], abs).length, 0);
});

test('demi-journée : absente le matin, disponible l’après-midi', () => {
  const abs = absencesLe([{ id: 'a', collab: 'c', du: '2026-10-20', au: '2026-10-20', portionDebut: 'matin', type: 'rtt', statut: 'validee' }], '2026-10-20');
  assert.equal(abs[0].portion, 'matin');
  assert.equal(conflits(T('E', '2026-10-20', '10:00', '11:00', { collabs: ['c'] }), [], abs).length, 1);
  assert.equal(conflits(T('E', '2026-10-20', '14:00', '15:00', { collabs: ['c'] }), [], abs).length, 0);
});

test('présence : demi-journées, télétravail présent, demandes non comptées', () => {
  const equipe = ['a', 'b', 'c', 'd'].map(id => ({ id, prenom: id, nom: '', actif: true }));
  const absences = [
    { collab: 'a', du: '2026-10-20', au: '2026-10-20', type: 'conges', statut: 'validee' },
    { collab: 'b', du: '2026-10-20', au: '2026-10-20', type: 'rtt', portionDebut: 'apresmidi', statut: 'validee' },
    { collab: 'c', du: '2026-10-20', au: '2026-10-20', type: 'teletravail', statut: 'validee' },
    { collab: 'd', du: '2026-10-20', au: '2026-10-20', type: 'conges', statut: 'demandee' },
  ];
  assert.deepEqual(presence(equipe, absences, '2026-10-20'), { presents: 2.5, effectif: 4 });
});

test('créneau libre : saute week-end, absences, déjeuner et créneaux pris', () => {
  const insts = instances([T('A', '2026-10-19', '08:30', '11:30')], '2026-10-19', '2026-10-30');
  const absences = [{ collab: 'c', du: '2026-10-20', au: '2026-10-20', type: 'conges', statut: 'validee' }];
  const r = creneauLibre({ depuis: '2026-10-17', duree: 60, collabs: [], insts, absencesSur: d => absencesLe(absences, d), estOuvre: d => dow(d) < 5 && !ferie(d) });
  // Samedi 17 → lundi 19 ; 08:30–11:30 pris, 11:30–12:30 empiète sur le déjeuner → 13:30.
  assert.deepEqual(r, { date: '2026-10-19', debut: '13:30', fin: '14:30', collabs: [] });
  const r2 = creneauLibre({ depuis: '2026-10-20', duree: 60, collabs: ['c'], insts, absencesSur: d => absencesLe(absences, d), estOuvre: d => dow(d) < 5 });
  assert.equal(r2.date, '2026-10-21');
});

test('retards : occurrences récurrentes passées non faites', () => {
  const taches = [T('R', '2026-10-05', '15:00', '16:00', { rec: { freq: 'hebdo' }, occ: { '2026-10-05': { statut: 'fait' } } })];
  assert.deepEqual(enRetard(taches, '2026-10-17').map(i => i.date), ['2026-10-12']);
});

test('obligations : à partir de l’entrée, de la dernière réalisation, planifiée', () => {
  const equipe = [
    { id: 'nouveau', prenom: 'N', nom: 'X', entree: '2026-03-01', actif: true },
    { id: 'ancien', prenom: 'A', nom: 'Y', entree: '2015-01-01', actif: true },
    { id: 'planif', prenom: 'P', nom: 'Z', entree: '2015-01-01', actif: true },
  ];
  const taches = [
    T('e1', '2023-09-01', '10:00', '11:00', { oblig: 'epp', collabs: ['ancien'], statut: 'fait' }),
    T('e2', '2026-11-05', '10:00', '11:00', { oblig: 'epp', collabs: ['planif'] }),
  ];
  const rows = echeancier({ obligations: DEFAUT_OBLIGATIONS.filter(o => o.id === 'epp'), taches, equipe, today: '2026-10-17' });
  const by = id => rows.find(r => r.collab.id === id);
  assert.equal(by('nouveau').echeance, '2027-03-01');
  assert.equal(by('nouveau').etat, 'ajour');
  assert.equal(by('ancien').echeance, '2027-09-01');
  assert.equal(by('planif').etat, 'planifie');
  assert.equal(by('planif').prochaine, '2026-11-05');
  // Ancien collaborateur sans aucun historique : à planifier, pas « 9 ans de retard ».
  const sansHisto = echeancier({ obligations: DEFAUT_OBLIGATIONS.filter(o => o.id === 'coaching'), taches: [], equipe: [equipe[1]], today: '2026-10-17' });
  assert.equal(sansHisto[0].etat, 'aplanifier');
  assert.equal(sansHisto[0].echeance, '2026-10-17');
});

test('DDA : heures de formation de l’année', () => {
  const abs = [
    { collab: 'c', du: '2026-03-02', type: 'formation', heures: 7, statut: 'validee' },
    { collab: 'c', du: '2026-09-10', type: 'formation', heures: 3.5, statut: 'validee' },
    { collab: 'c', du: '2025-09-10', type: 'formation', heures: 7, statut: 'validee' },
    { collab: 'c', du: '2026-11-10', type: 'formation', heures: 7, statut: 'demandee' },
  ];
  assert.equal(heuresFormation(abs, 'c', 2026), 10.5);
});

test('ICS : fuseau Paris, échappement, absences génériques, lignes ≤ 75 octets', () => {
  const equipe = [{ id: 'carla', prenom: 'Carla', nom: 'Petit' }, { id: 'lea', prenom: 'Léa', nom: 'Martin' }];
  const taches = [
    T('t1', '2026-10-26', '09:00', '10:00', { titre: 'Entretien annuel; objectifs, primes', cat: 'entretien', collabs: ['carla'] }),
    T('t2', '2026-10-23', '', '', { titre: 'Visa contrats', cat: 'admin' }),
    T('t3', '2026-10-24', '09:00', '10:00', { titre: 'Annulée', statut: 'annule' }),
  ];
  const ics = buildIcs({
    insts: instances(taches, '2026-10-01', '2026-11-30'), equipe, rappelMinutes: 10,
    absences: [{ id: 'a1', collab: 'lea', du: '2026-10-29', au: '2026-10-30', type: 'maladie', note: 'arrêt médical', statut: 'validee' }],
    now: new Date('2026-10-17T20:00:00Z'),
  });
  assert.ok(ics.includes('DTSTART;TZID=Europe/Paris:20261026T090000'));
  assert.ok(ics.includes('BEGIN:VTIMEZONE'));
  assert.ok(ics.includes('SUMMARY:Entretien annuel\\; objectifs\\, primes — C.P.'));
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261023'));
  assert.ok(ics.includes('DTEND;VALUE=DATE:20261031'));
  assert.ok(ics.includes('TRIGGER:-PT10M'));
  assert.ok(!/Annulée|maladie|médical/i.test(ics));
  for (const l of ics.split('\r\n')) assert.ok(new TextEncoder().encode(l).length <= 75, l);
  assert.equal(fold('X:' + 'é'.repeat(80)).split('\r\n ').join(''), 'X:' + 'é'.repeat(80));
});

test('fusion : la plus récente gagne, suppressions propagées et purgées après 90 jours', () => {
  const now = Date.UTC(2026, 9, 17);
  const h = now - 3600000;
  const a = { taches: { x: { titre: 'A', _t: h + 10 }, y: { titre: 'y', _t: h + 5 }, old: { _del: true, _t: now - 100 * 86400000 } } };
  const b = { taches: { x: { titre: 'B', _t: h + 20 }, y: { _del: true, _t: h + 6 }, z: { titre: 'z', _t: h + 1 } } };
  const m = merge(a, b, now);
  assert.equal(m.taches.x.titre, 'B');
  assert.equal(m.taches.y._del, true);
  assert.equal(m.taches.z.titre, 'z');
  assert.equal(m.taches.old, undefined);
  assert.ok(sameData({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 }));
});

test('store : écritures ordonnées même dans la même milliseconde', () => {
  const s = new Store(emptyData(1000), () => 1000);
  const id = s.put('taches', { titre: 'a' });
  assert.equal(s.get('taches', id).id, id, 'get() renvoie l’identifiant');
  assert.equal(s.data.taches[id].id, undefined, 'l’identifiant n’est pas dupliqué dans les données');
  const t1 = s.data.taches[id]._t;
  s.patch('taches', id, { titre: 'b' });
  assert.ok(s.data.taches[id]._t > t1);
  s.remove('taches', id);
  assert.equal(s.get('taches', id), null);
  assert.equal(s.list('taches').length, 0);
});
