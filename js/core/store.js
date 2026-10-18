// Données : { col: { id: { ...champs, _t: horodatage, _del?: true } } }
// Chaque élément porte sa date de modification (_t) : à la fusion, la plus récente gagne,
// et les suppressions (_del) se propagent aux autres appareils.

import { DEFAUT_CATEGORIES, DEFAUT_OBLIGATIONS, DEFAUT_REGLAGES } from './defaults.js';

export const COLLECTIONS = ['equipe', 'taches', 'absences', 'obligations', 'inbox', 'memos', 'reglages'];
const PURGE_SUPPRESSIONS_JOURS = 90;

export const uid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);

export function emptyData(now = Date.now()) {
  const data = Object.fromEntries(COLLECTIONS.map(c => [c, {}]));
  data.reglages.general = { ...DEFAUT_REGLAGES, categories: DEFAUT_CATEGORIES, _t: now };
  for (const o of DEFAUT_OBLIGATIONS) data.obligations[o.id] = { ...o, _t: now };
  return data;
}

export class Store {
  constructor(data, clock = () => Date.now()) {
    this.clock = clock;
    this.data = data ?? emptyData(clock());
    for (const c of COLLECTIONS) this.data[c] ??= {};
    this.listeners = new Set();
  }

  get(col, id) { const v = this.data[col][id]; return v && !v._del ? { id, ...v } : null; }
  list(col) { return Object.entries(this.data[col]).filter(([, v]) => !v._del).map(([id, v]) => ({ id, ...v })); }

  put(col, obj) {
    const id = obj.id ?? uid();
    const { id: _ignore, ...rest } = obj;
    // _t strictement croissant : deux écritures dans la même milliseconde restent ordonnées.
    const prev = this.data[col][id]?._t ?? 0;
    this.data[col][id] = { ...rest, _t: Math.max(this.clock(), prev + 1) };
    this.emit();
    return id;
  }

  patch(col, id, fields) {
    const cur = this.get(col, id);
    if (!cur) return null;
    return this.put(col, { ...cur, ...fields, id });
  }

  remove(col, id) {
    const prev = this.data[col][id]?._t ?? 0;
    this.data[col][id] = { _del: true, _t: Math.max(this.clock(), prev + 1) };
    this.emit();
  }

  reglages() { return this.get('reglages', 'general') ?? emptyData().reglages.general; }
  categories() { return this.reglages().categories ?? DEFAUT_CATEGORIES; }
  categorie(id) { return this.categories().find(c => c.id === id) ?? { id, nom: id, couleur: '#8a8f98', duree: 60 }; }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(); }

  replace(data) { this.data = data; for (const c of COLLECTIONS) this.data[c] ??= {}; this.emit(); }
}

// Fusion élément par élément : la version la plus récente gagne.
export function merge(a, b, now = Date.now()) {
  const out = {};
  for (const c of new Set([...COLLECTIONS, ...Object.keys(a ?? {}), ...Object.keys(b ?? {})])) {
    const A = a?.[c] ?? {}, B = b?.[c] ?? {};
    out[c] = {};
    for (const id of new Set([...Object.keys(A), ...Object.keys(B)])) {
      const x = A[id], y = B[id];
      const win = !x ? y : !y ? x : (y._t > x._t ? y : x);
      if (win._del && now - win._t > PURGE_SUPPRESSIONS_JOURS * 86400000) continue;
      out[c][id] = win;
    }
  }
  return out;
}

// Égalité indépendante de l'ordre des clés (évite les allers-retours inutiles entre appareils).
export function sameData(a, b) { return stable(a) === stable(b); }
function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
