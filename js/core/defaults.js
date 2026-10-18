// Valeurs de départ, toutes modifiables dans Réglages.

export const DEFAUT_CATEGORIES = [
  { id: 'coaching', nom: 'Double écoute / Coaching', couleur: '#8b7cf6', duree: 60, objectifMois: 12,
    mots: ['double ecoute', 'coaching', 'ecoute', 'accompagnement terrain'] },
  { id: 'entretien', nom: 'Entretiens collaborateurs', couleur: '#2fb38a', duree: 60, objectifMois: 8,
    mots: ['entretien', 'one to one', '1:1', '1 to 1', 'point individuel', 'bilan', 'eae', 'parcours professionnel'] },
  { id: 'admin', nom: 'Admin & conformité', couleur: '#e3a33b', duree: 30, objectifMois: 8,
    mots: ['reporting', 'visa', 'conformite', 'admin', 'controle', 'dossier', 'validation', 'valider', 'tableau de bord'] },
  { id: 'revision', nom: 'Révision technique', couleur: '#e26d8c', duree: 120, objectifMois: 4,
    mots: ['revision', 'technique', 'produit', 'tarif', 'garanties'] },
  { id: 'reunion', nom: 'Réunions', couleur: '#4a9fe8', duree: 60, objectifMois: 0,
    mots: ['reunion', 'debrief', 'brief', 'point equipe', 'comite', 'seminaire'] },
];

export const TYPES_ABSENCE = [
  { id: 'conges', nom: 'Congés payés', couleur: '#4a9fe8', absent: true },
  { id: 'rtt', nom: 'RTT', couleur: '#5bc0de', absent: true },
  { id: 'formation', nom: 'Formation', couleur: '#8b7cf6', absent: true },
  { id: 'maladie', nom: 'Maladie', couleur: '#e26d8c', absent: true },
  { id: 'recup', nom: 'Récupération', couleur: '#e3a33b', absent: true },
  { id: 'autre', nom: 'Autre absence', couleur: '#8a8f98', absent: true },
  { id: 'teletravail', nom: 'Télétravail', couleur: '#2fb38a', absent: false },
];

// Obligations managériales récurrentes. « parCollab » : une échéance par collaborateur concerné.
// periodeMois : intervalle entre deux réalisations ; premiereMois : délai après la date d'entrée.
export const DEFAUT_OBLIGATIONS = [
  { id: 'epp', titre: 'Entretien de parcours professionnel', cat: 'entretien', parCollab: true,
    periodeMois: 48, premiereMois: 12, alerteJours: 60, duree: 90, actif: true,
    note: "Art. L6315-1 C. trav. (loi du 24/10/2025) : dans l'année suivant l'embauche, puis tous les 4 ans au plus ; état des lieux tous les 8 ans." },
  { id: 'eae', titre: "Entretien annuel d'évaluation", cat: 'entretien', parCollab: true,
    periodeMois: 12, premiereMois: 12, alerteJours: 30, duree: 60, actif: true },
  { id: 'coaching', titre: 'Double écoute / coaching', cat: 'coaching', parCollab: true,
    periodeMois: 1, premiereMois: 1, alerteJours: 7, duree: 60, actif: true },
  { id: 'one2one', titre: 'One-to-one', cat: 'entretien', parCollab: true,
    periodeMois: 1, premiereMois: 1, alerteJours: 7, duree: 30, actif: false },
  { id: 'reporting', titre: 'Reporting mensuel agence', cat: 'admin', parCollab: false,
    periodeMois: 1, alerteJours: 5, duree: 120, actif: true },
  { id: 'visa', titre: 'Visa des contrats', cat: 'admin', parCollab: false,
    periodeMois: 3, alerteJours: 15, duree: 120, actif: true },
  { id: 'conformite', titre: 'Revue conformité', cat: 'admin', parCollab: false,
    periodeMois: 3, alerteJours: 15, duree: 60, actif: true },
];

export const DEFAUT_REGLAGES = {
  heureDebut: '08:00',
  heureFin: '19:00',
  seuilPresents: 4,
  ddaHeures: 15,
  rappelMinutes: 10,
  categorieDefaut: 'admin',
  territoire: '',      // '' = déduit du fuseau de l'appareil
  usagesFeries: [],   // jours chômés d'usage cochés par l'agence
};
