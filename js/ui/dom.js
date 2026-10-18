// Petits utilitaires d'affichage, sans dépendance.

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const attr = obj => Object.entries(obj).filter(([, v]) => v != null && v !== false).map(([k, v]) => (v === true ? k : `${k}="${esc(v)}"`)).join(' ');

let toastTimer;
export function toast(message, { action, onAction, duree = 4000 } = {}) {
  document.querySelector('.toast')?.remove();
  clearTimeout(toastTimer);
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button type="button">${esc(action)}</button>` : ''}`;
  if (action) el.querySelector('button').onclick = () => { el.remove(); onAction?.(); };
  document.body.append(el);
  toastTimer = setTimeout(() => el.remove(), duree);
}

// Ouvre la boîte de dialogue unique (#dlg). Les éléments [data-close] la ferment.
export function ouvrirDialogue(html, { onMount, onClose } = {}) {
  const dlg = document.getElementById('dlg');
  dlg.innerHTML = `<div class="dlg">${html}</div>`;
  const fermer = () => { if (dlg.open) dlg.close(); };
  // L'évènement « close » arrive de façon asynchrone : si une autre boîte a été ouverte
  // entre-temps (dlg.open de nouveau vrai), il concerne l'ancienne et doit être ignoré.
  dlg.onclose = () => { if (dlg.open) return; onClose?.(); dlg.innerHTML = ''; };
  dlg.onclick = e => {
    if (e.target === dlg) fermer();
    if (e.target.closest('[data-close]')) { e.preventDefault(); fermer(); }
  };
  if (!dlg.open) dlg.showModal();
  onMount?.(dlg, fermer);
  dlg.querySelector('[autofocus]')?.focus();
  return { dlg, fermer };
}

export function confirmer(message, { ok = 'Confirmer', danger = false } = {}) {
  return new Promise(resolve => {
    let reponse = false;
    ouvrirDialogue(`
      <div class="dlg-head"><h2>Confirmer</h2></div>
      <div class="dlg-body"><p style="margin:0">${esc(message)}</p></div>
      <div class="dlg-foot"><span class="spacer"></span>
        <button class="btn" data-close>Annuler</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-ok autofocus>${esc(ok)}</button>
      </div>`, {
      onMount: (dlg, fermer) => { dlg.querySelector('[data-ok]').onclick = () => { reponse = true; fermer(); }; },
      onClose: () => resolve(reponse),
    });
  });
}

export function telecharger(nom, contenu, type) {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nom });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const p = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const ICONES = {
  aujourdhui: p('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  planning: p('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>'),
  taches: p('<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>'),
  equipe: p('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2a5 5 0 0 1 5.5 5"/>'),
  obligations: p('<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/><path d="M9 12l2 2 4-4"/>'),
  avalider: p('<path d="M4 4h16v12H8l-4 4z"/><path d="M9 9h6"/>'),
  reglages: p('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  plus: p('<path d="M12 5v14M5 12h14"/>'),
  gauche: p('<path d="M15 18l-6-6 6-6"/>'),
  droite: p('<path d="M9 18l6-6-6-6"/>'),
  fermer: p('<path d="M18 6L6 18M6 6l12 12"/>'),
  plusMenu: p('<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>'),
  repete: p('<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>'),
  calendrier: p('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M12 13v5M9.5 15.5h5"/>'),
};
