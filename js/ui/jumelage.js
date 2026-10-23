// Jumelage d'un appareil par QR code : affichage sur l'appareil déjà connecté, scanner sur le nouveau.

import { store, sync } from './ctx.js';
import { esc, ouvrirDialogue, toast, confirmer, ICONES } from './dom.js';
import { lienJumelage, lireJumelage } from '../sync/jumelage.js';
import { emptyData } from '../core/store.js';

const scripts = new Map();
function chargerScript(src) {
  if (!scripts.has(src)) {
    scripts.set(src, new Promise((ok, ko) => {
      const s = Object.assign(document.createElement('script'), { src, onload: ok, onerror: () => { scripts.delete(src); ko(new Error('Chargement impossible (hors ligne ?)')); } });
      document.head.append(s);
    }));
  }
  return scripts.get(src);
}

// ---------- Appareil déjà connecté : afficher le code ----------
export async function afficherCodeJumelage() {
  const cfg = sync.config();
  if (!cfg?.token) return toast('Connectez d’abord cet appareil à la synchronisation.');
  try { await chargerScript('js/vendor/qrcode.min.js'); } catch (e) { return toast(e.message); }
  const lien = lienJumelage(cfg, location.href);
  const qr = globalThis.qrcode(0, 'M');
  qr.addData(lien); qr.make();
  ouvrirDialogue(`
    <div class="dlg-head"><h2>Connecter un autre appareil</h2><button class="btn icon ghost" data-close aria-label="Fermer">${ICONES.fermer}</button></div>
    <div class="dlg-body" style="align-items:center;text-align:center">
      <div style="background:#fff;padding:14px;border-radius:12px;line-height:0;max-width:300px;width:100%">${qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true })}</div>
      <ol class="steps small" style="text-align:left;align-self:stretch">
        <li>Sur l’iPhone, ouvrez <b>AgenceManager depuis son icône</b> sur l’écran d’accueil (installez-la d’abord si besoin : Safari → Partager → Sur l’écran d’accueil).</li>
        <li>Réglages → Synchronisation → <b>Scanner le code du Mac</b>, puis visez ce QR code.</li>
      </ol>
      <p class="tiny" style="margin:0;color:var(--danger)">Ce code donne accès à vos données : ne le montrez à personne et fermez cette fenêtre ensuite.</p>
    </div>
    <div class="dlg-foot"><span class="spacer"></span><button class="btn primary" data-close>Terminé</button></div>`);
}

// ---------- Nouvel appareil : scanner ----------
export async function scannerJumelage() {
  let flux = null, arret = false;
  const stopper = () => { arret = true; flux?.getTracks().forEach(t => t.stop()); };
  ouvrirDialogue(`
    <div class="dlg-head"><h2>Scanner le code du Mac</h2><button class="btn icon ghost" data-close aria-label="Fermer">${ICONES.fermer}</button></div>
    <div class="dlg-body">
      <p class="small muted" style="margin:0">Sur le Mac : Réglages → Synchronisation → <b>Connecter un autre appareil</b>. Visez le QR code qui s’affiche.</p>
      <div style="position:relative;border-radius:12px;overflow:hidden;background:#000;aspect-ratio:1/1;max-width:420px;width:100%;align-self:center">
        <video playsinline muted autoplay style="width:100%;height:100%;object-fit:cover"></video>
        <div style="position:absolute;inset:18%;border:3px solid rgba(255,255,255,.85);border-radius:16px"></div>
      </div>
      <p class="small" data-etat style="margin:0;text-align:center">Ouverture de l’appareil photo…</p>
      <details><summary class="small" style="cursor:pointer">Pas d’appareil photo ? Coller le lien de jumelage</summary>
        <div class="row" style="margin-top:8px;flex-wrap:nowrap"><input type="text" data-lien placeholder="https://…#/jumeler?c=…" autocapitalize="off" spellcheck="false"><button class="btn" data-valider>Valider</button></div>
      </details>
    </div>`, {
    onClose: stopper,
    onMount: async (dlg, fermer) => {
      const etat = t => { const el = dlg.querySelector('[data-etat]'); if (el) el.textContent = t; };
      const reussi = cfg => { stopper(); fermer(); appliquerJumelage(cfg); };
      dlg.querySelector('[data-valider]').onclick = () => {
        const cfg = lireJumelage(dlg.querySelector('[data-lien]').value);
        cfg ? reussi(cfg) : toast('Ce lien n’est pas un code de jumelage AgenceManager.');
      };
      try {
        await chargerScript('js/vendor/jsQR.js');
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error(), { name: 'NotSupported' });
        flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (arret) return stopper();
        const video = dlg.querySelector('video');
        video.srcObject = flux;
        await video.play().catch(() => {});
        etat('Visez le QR code affiché sur le Mac.');
        const canvas = document.createElement('canvas');
        const c2d = canvas.getContext('2d', { willReadFrequently: true });
        let dernier = '';
        const lire = () => {
          if (arret) return;
          if (video.readyState >= 2 && video.videoWidth) {
            const k = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
            canvas.width = Math.round(video.videoWidth * k); canvas.height = Math.round(video.videoHeight * k);
            c2d.drawImage(video, 0, 0, canvas.width, canvas.height);
            const img = c2d.getImageData(0, 0, canvas.width, canvas.height);
            const code = globalThis.jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
            if (code?.data && code.data !== dernier) {
              dernier = code.data;
              const cfg = lireJumelage(code.data);
              if (cfg) return reussi(cfg);
              etat('Ce QR code n’est pas un code de jumelage AgenceManager.');
            }
          }
          requestAnimationFrame(lire);
        };
        requestAnimationFrame(lire);
      } catch (e) {
        etat(e.name === 'NotAllowedError' ? 'Accès à l’appareil photo refusé : autorisez-le (Réglages → Safari → Appareil photo), ou collez le lien ci-dessous.'
          : e.name === 'NotFoundError' || e.name === 'NotSupported' ? 'Aucun appareil photo disponible : collez le lien de jumelage ci-dessous.'
          : (e.message || 'Appareil photo indisponible.'));
        const d = dlg.querySelector('details'); if (d) d.open = true;
      }
    },
  });
}

// ---------- Connexion avec la configuration reçue ----------
const aDesDonnees = () => store.list('equipe').length + store.list('taches').length + store.list('absences').length > 0;

export async function appliquerJumelage(cfg) {
  const { GitHubSync } = await import('../sync/github.js');
  toast('Connexion…');
  try {
    await new GitHubSync(cfg).verifier();
  } catch (e) {
    return toast(e.message || 'Connexion impossible.', { duree: 7000 });
  }
  const dejaLa = sync.config();
  if (dejaLa?.token === cfg.token && dejaLa.repo === cfg.repo && dejaLa.owner === cfg.owner) {
    toast('Cet appareil est déjà connecté.');
    return sync.lancer();
  }
  // Un appareil neuf repart des données synchronisées. S'il contient déjà des données, on demande.
  if (!aDesDonnees()) store.replace(emptyData(0));
  else if (await confirmer('Cet appareil contient déjà des données (par exemple l’exemple de démonstration). Les remplacer par vos données synchronisées ?', { ok: 'Remplacer (recommandé)' })) {
    store.replace(emptyData(0));
  }
  sync.configurer(cfg);
  await sync.lancer();
  toast(sync.etat === 'ok' ? 'Appareil connecté : vos données sont là.' : `Connecté, mais : ${sync.message}`, { duree: 6000 });
}

// Adresse ouverte depuis l'appareil photo (…#/jumeler?c=…) : on retire aussitôt le code de l'adresse.
export function traiterLienJumelage() {
  if (!location.hash.startsWith('#/jumeler')) return false;
  const cfg = lireJumelage(location.hash);
  history.replaceState(null, '', `${location.pathname}${location.search}#/reglages`);
  if (cfg) appliquerJumelage(cfg);
  else toast('Code de jumelage illisible.');
  return true;
}

export const htmlBoutonsJumelage = connecte => (connecte
  ? '<button class="btn" type="button" data-act="jumeler-afficher">Connecter un autre appareil (QR code)</button>'
  : '<button class="btn primary" type="button" data-act="jumeler-scanner">Scanner le code du Mac</button>');
