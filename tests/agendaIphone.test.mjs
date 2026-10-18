process.env.TZ = 'Europe/Paris';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireDate, lireImport, planImport, instancesRdv, estImportAgenda } from '../js/core/agendaIphone.js';
import { conflits } from '../js/core/agenda.js';

test('dates du Raccourci : ISO avec fuseau, ISO UTC, formats français', () => {
  assert.deepEqual(lireDate('2026-10-20T14:00:00+02:00'), { date: '2026-10-20', heure: '14:00' });
  assert.deepEqual(lireDate('2026-10-26T08:00:00Z'), { date: '2026-10-26', heure: '09:00' }); // après le passage à l'heure d'hiver
  assert.deepEqual(lireDate('2026-10-20T14:30:00'), { date: '2026-10-20', heure: '14:30' });
  assert.deepEqual(lireDate('20/10/2026 14:30'), { date: '2026-10-20', heure: '14:30' });
  assert.deepEqual(lireDate('20 oct. 2026 à 14:30'), { date: '2026-10-20', heure: '14:30' });
  assert.deepEqual(lireDate('mardi 3 novembre 2026 à 09:15'), { date: '2026-11-03', heure: '09:15' });
  assert.equal(lireDate('n’importe quoi'), null);
});

const TEXTE = `#AGENDA
2026-10-20T14:00:00+02:00|2026-10-20T15:30:00+02:00|Non|Travail|Comité de direction
2026-10-21T09:00:00+02:00|2026-10-21T10:00:00+02:00|Non|AgenceManager|Double écoute — M.D.
2026-10-23T00:00:00+02:00|2026-10-26T00:00:00+01:00|Oui|Famille|Vacances | Bretagne
2026-10-22T18:00:00+02:00|2026-10-23T09:00:00+02:00|Non|Travail|Séminaire
ligne invalide
2026-10-20T14:00:00+02:00|2026-10-20T15:30:00+02:00|Non|Travail|Comité de direction`;

test('lecture : calendrier de l’app ignoré, journées entières, titre avec « | », doublons', () => {
  const { rdv, ignores } = lireImport(TEXTE);
  assert.equal(ignores.length, 1);
  assert.equal(rdv.length, 3);
  const comite = rdv.find(r => r.titre === 'Comité de direction');
  assert.deepEqual([comite.date, comite.debut, comite.fin, comite.journee], ['2026-10-20', '14:00', '15:30', false]);
  const vac = rdv.find(r => r.titre === 'Vacances | Bretagne');
  assert.deepEqual([vac.date, vac.jusqu, vac.journee], ['2026-10-23', '2026-10-25', true]);
  const sem = rdv.find(r => r.titre === 'Séminaire');
  assert.equal(sem.fin, '23:59');
  assert.ok(!rdv.some(r => r.calendrier === 'AgenceManager'), 'pas de boucle avec le calendrier abonné');
  assert.equal(lireImport(TEXTE).rdv[0].id, comite.id, 'identifiant stable');
});

test('import = instantané : déplacé ou supprimé sur l’iPhone → repris ; passé conservé', () => {
  const recu = new Date('2026-10-20T10:00:00+02:00');
  const existants = [
    { id: 'passe', titre: 'Hier', date: '2026-10-19', debut: '09:00', fin: '10:00' },
    { id: 'ce-matin', titre: 'Ce matin', date: '2026-10-20', debut: '08:00', fin: '09:00' },
    { id: 'supprime', titre: 'Annulé sur iPhone', date: '2026-10-22', debut: '11:00', fin: '12:00' },
    { id: 'loin', titre: 'Dans 2 mois', date: '2026-12-20', debut: '11:00', fin: '12:00' },
  ];
  const { rdv } = lireImport(TEXTE);
  const p = planImport(existants, rdv, recu);
  assert.deepEqual(p.supprimer, ['supprime']);
  assert.equal(p.ecrire.length, 3);
  // Second import identique : rien à écrire.
  const apres = rdv;
  assert.equal(planImport(apres, rdv, recu).ecrire.length, 0);
  assert.equal(planImport(apres, rdv, recu).supprimer.length, 0);
});

test('affichage et conflits : un RDV iPhone bloque le créneau', () => {
  const { rdv } = lireImport(TEXTE);
  const insts = instancesRdv(rdv, '2026-10-20', '2026-10-26');
  assert.equal(insts.filter(i => i.tache.titre === 'Vacances | Bretagne').length, 3);
  const cand = { id: 'x', key: 'x', date: '2026-10-20', debut: '15:00', fin: '16:00', collabs: [] };
  assert.equal(conflits(cand, insts, []).length, 1);
  assert.equal(conflits({ ...cand, debut: '15:30', fin: '16:30' }, insts, []).length, 0);
});

test('reconnaissance d’une issue d’import', () => {
  assert.ok(estImportAgenda('Agenda', '2026-10-20T14:00|…'));
  assert.ok(estImportAgenda('Dictée', '#AGENDA\n…'));
  assert.ok(!estImportAgenda('Dictée', 'Agenda de la réunion demain 10h'));
});

test('Guadeloupe : un import ISO est lu dans le fuseau de l’agence', async () => {
  const { lireDate: ld, lireImport: li } = await import('../js/core/agendaIphone.js');
  assert.deepEqual(ld('2026-10-20T14:00:00-04:00', 'America/Guadeloupe'), { date: '2026-10-20', heure: '14:00' });
  assert.deepEqual(ld('2026-10-20T18:00:00Z', 'America/Guadeloupe'), { date: '2026-10-20', heure: '14:00' });
  const { rdv } = li('#AGENDA\n2026-10-20T14:00:00-04:00|2026-10-20T15:00:00-04:00|Non|Travail|Comité', 'America/Guadeloupe');
  assert.deepEqual([rdv[0].date, rdv[0].debut, rdv[0].fin], ['2026-10-20', '14:00', '15:00']);
});
