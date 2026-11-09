# ♟️ Échecs Coach

Une appli d'échecs perso pour progresser, de 700 à 1000+ elo : parties contre l'ordinateur avec un coach, bilan de partie, exercices tactiques, leçons interactives et entraînement aux ouvertures (**Système de Londres** avec les Blancs, **Défense Française** avec les Noirs).

Elle fonctionne entièrement dans le navigateur, sans serveur ni compte. Le moteur Stockfish tourne sur ton appareil, et l'appli marche aussi hors connexion une fois chargée.

## Fonctionnalités

| Section | Contenu |
|---|---|
| **Jouer** | 8 adversaires de ≈400 à ≈2800. Le **coach en direct** te prévient quand tu fais une erreur et te propose de reprendre le coup. Indice, reprise de coup. La partie est sauvegardée si tu fermes l'appli. |
| **Bilan** | Précision des deux joueurs, courbe d'évaluation, chaque coup classé (Meilleur, Bon, Imprécision, Erreur, Gaffe, Coup manqué…) avec une explication en français. Tu peux **réessayer** tes erreurs. Elles deviennent ensuite des exercices dans « Mes erreurs ». |
| **Exercices** | Exercices tirés de vraies positions et vérifiés par Stockfish. Un classement qui évolue, des thèmes (fourchette, clouage, mat en 1/2/3…), un mode Survie et un mode « Mes erreurs ». |
| **Leçons** | Bases (valeur des pièces, routine anti-gaffe, principes d'ouverture, coup du berger), tactiques, finales (mat roi+dame, roi+tour, roi+pion contre le moteur), plans du Londres et de la Française. |
| **Ouvertures** | Lignes commentées coup par coup. Mode *Apprendre* (avec flèches), mode *S'entraîner* (de mémoire), et révision aléatoire. |
| **Analyse** | Échiquier libre avec Stockfish (3 meilleures lignes), import FEN/PGN. |

## Utiliser l'appli sur ton téléphone

Ouvre le lien GitHub Pages, puis :
- **iPhone (Safari)** : bouton Partager → « Sur l'écran d'accueil ».
- **Android (Chrome)** : menu ⋮ → « Installer l'application » / « Ajouter à l'écran d'accueil ».

Tes progrès sont enregistrés sur l'appareil. Pour les transférer d'un appareil à l'autre, utilise *Exporter / Importer mes données* en bas de l'accueil.

## Publier avec GitHub Pages

Settings → Pages → *Deploy from a branch* → branche `main`, dossier `/ (root)`. L'appli sera disponible sur `https://<pseudo>.github.io/<nom-du-depot>/`.

## Ajouter du contenu

- **Leçons** : `js/data/lessons.js`. Chaque étape a un texte, une position (`fen` ou `pgn`), et éventuellement une tâche (`task.moves` en notation anglaise SAN, tes coups aux indices pairs).
- **Ouvertures** : `js/data/openings.js`. Une ligne = une liste `[coup, commentaire]` depuis la position de départ.
- **Exercices** : générés automatiquement (voir ci-dessous).

### Outils de développement (optionnel)

```bash
npm install                 # chess.js + stockfish pour les scripts
npm run validate            # vérifie leçons et ouvertures avec Stockfish
npm run puzzles:gen         # génère de nouveaux exercices (puzzles-raw.jsonl)
npm run puzzles:build       # les classe, les note et écrit js/data/puzzles.js
npm run serve               # http://localhost:8123
```

Après une mise à jour, change la version `CACHE` dans `sw.js` pour que les téléphones téléchargent la nouvelle version.

## Crédits

- Moteur : [Stockfish](https://stockfishchess.org/) 19 via [stockfish.js](https://github.com/nmrugg/stockfish.js) (GPL v3, voir `engine/STOCKFISH-LICENSE.txt`)
- Règles du jeu : [chess.js](https://github.com/jhlywa/chess.js) (BSD-2)
- Pièces : jeu « cburnett » de Colin M.L. Burnett (CC BY-SA 3.0)
