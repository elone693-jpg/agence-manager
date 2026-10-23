import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { lienJumelage, lireJumelage } from '../js/sync/jumelage.js';

const cfg = { owner: 'elone693-jpg', repo: 'agence-manager-donn-es', token: 'github_pat_' + 'A1b2C3'.repeat(14) };
const BASE = 'https://elone693-jpg.github.io/agence-manager/#/reglages';

test('lien de jumelage : aller-retour, base nettoyée, codes invalides refusés', () => {
  const lien = lienJumelage(cfg, BASE);
  assert.ok(lien.startsWith('https://elone693-jpg.github.io/agence-manager/#/jumeler?c='));
  assert.deepEqual(lireJumelage(lien), cfg);
  assert.equal(lireJumelage('https://example.com/autre'), null);
  assert.equal(lireJumelage('#/jumeler?c=pasdujson'), null);
  assert.equal(lireJumelage(''), null);
});

test('le QR code généré se relit avec le décodeur de l’iPhone', () => {
  const ctx = { self: {}, window: {} };
  vm.runInNewContext(readFileSync('js/vendor/qrcode.min.js', 'utf8') + ';self.qrcode=qrcode;', ctx);
  vm.runInNewContext(readFileSync('js/vendor/jsQR.js', 'utf8'), ctx);
  const lien = lienJumelage(cfg, BASE);
  const qr = ctx.self.qrcode(0, 'M'); qr.addData(lien); qr.make();
  const n = qr.getModuleCount(), cell = 4, marge = 4 * cell, taille = n * cell + 2 * marge;
  const px = new Uint8ClampedArray(taille * taille * 4).fill(255);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) {
    for (let dy = 0; dy < cell; dy++) for (let dx = 0; dx < cell; dx++) {
      const i = ((marge + y * cell + dy) * taille + (marge + x * cell + dx)) * 4;
      px[i] = px[i + 1] = px[i + 2] = 0;
    }
  }
  const lu = ctx.self.jsQR(px, taille, taille);
  assert.ok(lu, 'QR lisible');
  assert.deepEqual(lireJumelage(lu.data), cfg);
});
