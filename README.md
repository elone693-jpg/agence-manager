# AgenceManager

Outil personnel de pilotage pour un manager d'agence : planning de la semaine, tâches, absences et présence de l'équipe, échéancier des obligations managériales, dictée depuis l'Apple Watch. Application web installable (iPhone et Mac), sans serveur et sans compte supplémentaire.

**Adresse : https://elone693-jpg.github.io/agence-manager/**

Ce dépôt public ne contient que le code. Les données sont dans un dépôt privé distinct.

## Fonctions

- **Aujourd'hui** : agenda du jour et de demain, éléments à traiter (retards, dictées à valider, obligations, jours en sous-effectif), absents, objectifs du mois par catégorie, mémos.
- **Planning** : semaine en grille horaire (vue jour sur iPhone), jours fériés, absents en tête de colonne, tâches répétées (hebdo, 2 semaines, mensuelle), conflits signalés en rouge (chevauchement ou collaborateur absent). Clic dans la grille pour créer.
- **Tâches** : à venir, en retard, sans date, terminées ; filtres par catégorie et recherche.
- **Équipe** : grille de présence sur 3 semaines (demi-journées, télétravail compté présent, seuil minimum), fiches collaborateurs, absences (demandées, validées), compteur de formation DDA.
- **Obligations** : échéancier par collaborateur (entretien de parcours professionnel, entretien annuel, double écoute…) et pour l'agence (reporting, visas, conformité). Le bouton *Planifier* propose le premier créneau libre hors absences. Règles modifiables.
- **Saisie en langage naturel** (champ du haut ou bouton + sur iPhone), avec aperçu avant validation : « Double écoute avec Marc mardi 14 h », « Carla en congés du 2 au 6 novembre », « Rappelle-moi de valider les visas », « Mémo : … ».
- **Export Calendrier** (.ics) pour l'app Calendrier de l'iPhone, du Mac et de la montre.

## Analyse des dictées

Entièrement locale (`js/core/voix.js`) : aucun texte n'est envoyé à un service d'IA. Ce qui n'est pas certain n'est jamais deviné et part dans **À valider** : prénom porté par deux personnes, personne hors équipe, date récemment passée. Un clic sur le bon collaborateur suffit ensuite.

Reconnu : aujourd'hui, demain, après-demain, jours de la semaine (« mardi » = le prochain mardi), « mardi de la semaine prochaine », « le 26 », « le 3 novembre », « 05/11 », « dans 3 jours », « dans 2 heures », « fin de semaine », matin / après-midi / midi / soir, « 14 h 30 », « de 10 h à 12 h », « pendant 30 minutes ». « À 2 h » au bureau = 14 h. Mots-clés des catégories modifiables dans Réglages.

## Synchronisation Mac ↔ iPhone ↔ Apple Watch

Les données sont gardées sur chaque appareil et fusionnées dans un fichier `donnees.json` d'un dépôt GitHub **privé** (élément par élément, la modification la plus récente gagne, les suppressions se propagent). La synchro a lieu à l'ouverture, au retour sur l'app, chaque minute tant qu'elle est affichée et 2 s après une modification.

Mise en place (Réglages → Synchronisation) :
1. Créer un dépôt privé, par exemple `agence-manager-donnees`.
2. Créer une clé « fine-grained » limitée à ce dépôt, avec **Contents** et **Issues** en *Read and write*.
3. Saisir compte, dépôt et clé sur chaque appareil.

**Dictée depuis la montre** : un Raccourci Apple (*Dicter le texte* puis *Obtenir le contenu de l'URL* en POST sur `https://api.github.com/repos/<compte>/<dépôt>/issues`, corps `{"title": "Dictée", "body": <texte>}`) dépose la phrase dans le dépôt. L'app la récupère à la synchro suivante, l'analyse puis ferme l'issue. Les étapes détaillées sont affichées dans Réglages.

## Limites connues

- La dictée de la montre est traitée à la prochaine ouverture de l'app (Mac ou iPhone), pas instantanément.
- Pas de notifications push (cela demanderait un serveur) : pour les rappels, exporter le calendrier .ics.
- L'export .ics est une copie ponctuelle : le refaire après des changements importants.

## Données personnelles

Outil hébergé hors du système d'information de l'employeur : vérifier avec le DPO ou la DSI avant d'y saisir des données réelles de collaborateurs. Ne jamais saisir de motif médical (le type « Maladie » suffit). L'export calendrier affiche les noms en initiales et n'indique jamais le type d'absence.

## Développement

```bash
npm test
```

```bash
npm start
```

Aucune dépendance : HTML, CSS et modules JavaScript natifs. `npm start` lance un petit serveur local (`scripts/serve.mjs`, port 8642). Le service worker (hors ligne) n'est actif qu'en HTTPS.

Publier une nouvelle version : changer `VERSION` dans `sw.js` et dans `js/app.js`, lancer les tests, puis pousser sur la branche servie par GitHub Pages.

| Dossier | Contenu |
|---|---|
| `js/core/` | Logique sans interface, testée : dates et jours fériés, récurrences et conflits, absences et présence, obligations, analyse des dictées, export .ics, stockage et fusion |
| `js/sync/` | Synchronisation GitHub (fichier de données et dictées) |
| `js/ui/` | Interface : état partagé, formulaires, vues |
| `tests/` | Tests Node (`node --test`) |
