// Jumelage d'un appareil : le Mac déjà connecté affiche un QR code contenant la configuration
// de synchronisation ; l'iPhone le scanne (dans l'app ou avec l'appareil photo) et se connecte.
// Le code est une adresse de l'app : #/jumeler?c=<configuration encodée>. La partie après « # »
// n'est jamais envoyée au serveur qui héberge l'app.

const toB64url = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4))));

export function lienJumelage({ owner, repo, token }, base) {
  const c = toB64url(JSON.stringify({ v: 1, o: owner, r: repo, t: token }));
  return `${base.replace(/#.*$/, '')}#/jumeler?c=${c}`;
}

// Texte scanné ou adresse ouverte → configuration { owner, repo, token }, ou null si ce n'est pas un code valide.
export function lireJumelage(texte) {
  const m = /[#?&]\/?(?:jumeler\?)?c=([A-Za-z0-9_-]+)/.exec(String(texte ?? ''));
  if (!m) return null;
  try {
    const j = JSON.parse(fromB64url(m[1]));
    if (j.v !== 1 || !j.o || !j.r || !j.t) return null;
    return { owner: String(j.o), repo: String(j.r), token: String(j.t) };
  } catch { return null; }
}
