// Interactive lessons.
// step: {t: html, fen | pgn (moves from start), orient, arrows:[[from,to,color]], marks:{sq:'red'|'goodsq'}, task|play}
// task.moves: SAN sequence, even index = your move, odd index = automatic reply.
// task.accept: other first moves that are also correct (lesson continues with "bien joué").
// play: {goal:'mate'|'promote', max: number of your moves} -> you finish the job against the engine.
export const G = 'rgba(21,120,27,.8)', R = 'rgba(200,40,40,.8)', B = 'rgba(0,100,200,.75)', Y = 'rgba(255,170,0,.85)';

const LONDON_SETUP = 'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O Bd3';

export const MODULES = [
{
  id: 'bases', title: 'Les bases qui font gagner', icon: '🧱',
  desc: 'À 700 elo, la plupart des parties se perdent sur une pièce laissée en prise. On commence par là.',
  lessons: [
  {
    id: 'valeur', title: 'La valeur des pièces', mins: 3,
    steps: [
      { t: `<p>Chaque pièce vaut un certain nombre de <b>points</b> :</p>
<p>♙ Pion = <b>1</b> · ♘ Cavalier = <b>3</b> · ♗ Fou = <b>3</b> · ♖ Tour = <b>5</b> · ♕ Dame = <b>9</b>.<br>Le roi, lui, n'a pas de prix : le perdre, c'est perdre la partie.</p>
<div class="key">Un échange est bon si tu reçois <b>au moins autant</b> de points que tu en donnes.</div>`,
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' },
      { t: `<p>Une pièce qui n'est défendue par rien est <b>en prise</b> : on peut la prendre gratuitement.</p><p>La tour noire en e5 n'est pas défendue. <b>Prends-la avec ton cavalier.</b></p>`,
        fen: '6k1/5ppp/8/4r3/2N5/8/5PPP/6K1 w - - 0 1', task: { moves: ['Nxe5'], hint: 'Le cavalier en c4 saute en e5.' } },
      { t: `<p>Attention aux pièces <b>défendues</b> ! Ici tu peux prendre le pion d5 avec ta dame… mais le pion e6 le protège : tu perdrais ta dame (9) pour un pion (1).</p><p>Trouve plutôt la pièce noire <b>gratuite</b>.</p>`,
        fen: '4k3/ppp2ppp/4p3/3p4/6n1/8/PPP2PPP/3QK3 w - - 0 1', arrows: [['e6', 'd5', R]], task: { moves: ['Qxg4'], hint: 'Le cavalier g4 n\'est défendu par personne.' } },
    ]
  },
  {
    id: 'antigaffe', title: 'La routine anti-gaffe', mins: 5,
    steps: [
      { t: `<p>Voici la routine des joueurs qui progressent vite. <b>Avant chaque coup</b>, pose-toi 3 questions :</p>
<p>1️⃣ <b>Qu'est-ce que mon adversaire menace</b> avec son dernier coup ?<br>2️⃣ Après mon coup, <b>mes pièces sont-elles toutes défendues</b> ?<br>3️⃣ Est-ce que j'ai un <b>échec, une capture ou une menace</b> intéressante ?</p>
<div class="key">Ça prend 10 secondes, et ça t'évitera la moitié de tes défaites.</div>`, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' },
      { t: `<p>Question 1 : qu'est-ce qui est menacé ? Les Noirs viennent de jouer <b>…h6</b> et attaquent ton fou g5.</p><p><b>Mets ton fou à l'abri</b> (sans le laisser en prise ailleurs).</p>`,
        pgn: 'd4 d5 Bg5 h6', arrows: [['h6', 'g5', R]], task: { moves: ['Bh4'], accept: ['Bf4', 'Be3', 'Bd2', 'Bc1'], hint: 'Le fou peut reculer en h4 ou en f4.' } },
      { t: `<p>Les Noirs menacent <b>…Te1 mat</b> : ton roi est coincé derrière ses pions. C'est le fameux <b>mat du couloir</b>.</p><p><b>Empêche ce mat.</b></p>`,
        fen: '4r1k1/5ppp/8/8/2R5/8/5PPP/6K1 w - - 0 1', arrows: [['e8', 'e1', R]],
        task: { moves: ['h3'], accept: ['h4', 'g3', 'f3', 'f4', 'Rc1', 'Kf1'], hint: 'Donne une case de fuite à ton roi, par exemple en avançant un pion devant lui.' } },
      { t: `<p>Bravo. Une petite case de fuite pour le roi (h3 ou g3) s'appelle un <b>« luft »</b>. Pense à la créer quand les dames et les tours sont encore sur l'échiquier.</p>`,
        fen: '4r1k1/5ppp/8/8/2R5/7P/5PP1/6K1 b - - 0 1', arrows: [['g1', 'h2', G]] },
    ]
  },
  {
    id: 'principes', title: "Les 5 principes de l'ouverture", mins: 4,
    steps: [
      { t: `<p><b>1. Occupe le centre</b> avec tes pions (e4, d4, e5, d5). Les pièces au centre contrôlent plus de cases.</p><p>Joue un coup central.</p>`,
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', marks: { d4: 'goodsq', e4: 'goodsq', d5: 'goodsq', e5: 'goodsq' }, task: { moves: ['e4'], accept: ['d4'] } },
      { t: `<p><b>2. Développe tes pièces</b> : cavaliers et fous sortent vers le centre.<br><b>3. Ne joue pas deux fois la même pièce</b> sans raison.<br><b>4. Ne sors pas ta dame trop tôt</b> : elle se fera chasser.</p>`,
        pgn: 'e4 e5 Nf3 Nc6 Bc4 Bc5', arrows: [['g1', 'f3', G], ['f1', 'c4', G], ['b8', 'c6', G], ['f8', 'c5', G]] },
      { t: `<p><b>5. Roque tôt</b> : ton roi est en sécurité et ta tour rejoint le jeu.</p><p>Ici, le coup le plus simple est de <b>roquer</b>.</p>`,
        pgn: 'e4 e5 Nf3 Nc6 Bc4 Bc5', task: { moves: ['O-O'], accept: ['c3', 'd3', 'Nc3'], hint: 'Le roi va en g1 et la tour en f1.' } },
      { t: `<p>Les erreurs classiques à 700 elo : jouer les pions du bord (a4, h4), sortir la dame au 2e coup, oublier de roquer, et prendre des pions en laissant le développement de côté.</p>`,
        pgn: 'e4 e5 Nf3 Nc6 Bc4 Bc5 O-O Nf6', arrows: [['e1', 'g1', G]] },
    ]
  },
  {
    id: 'berger', title: 'Le coup du berger (et comment le contrer)', mins: 4,
    steps: [
      { t: `<p>Le piège le plus fréquent à ton niveau : la dame et le fou visent <b>f7</b>, la case la plus faible des Noirs (seul le roi la défend). La menace est <b>Dxf7 mat</b>.</p>`,
        pgn: 'e4 e5 Bc4 Nc6 Qh5', orient: 'b', arrows: [['h5', 'f7', R], ['c4', 'f7', R]] },
      { t: `<p>Tu as les Noirs. <b>Pare la menace de mat</b>, puis continue normalement.</p>`, pgn: 'e4 e5 Bc4 Nc6 Qh5', orient: 'b',
        task: { moves: ['g6', 'Qf3', 'Nf6'], accept: ['Qe7', 'Qf6'], hint: 'Un pion peut chasser la dame et couper sa route vers f7.' } },
      { t: `<p>Parfait ! Après <b>…g6</b> et <b>…Cf6</b>, f7 est défendu, tes pièces sortent et la dame blanche a perdu du temps. Plus tard, …Cd4 viendra encore la harceler.</p>
<div class="key">Attention : contre Dh5, ne joue jamais <b>…Cf6??</b> tout de suite → Dxf7 mat.</div>`, pgn: 'e4 e5 Bc4 Nc6 Qh5 g6 Qf3 Nf6', orient: 'b', arrows: [['c6', 'd4', G]] },
    ]
  },
  ]
},
{
  id: 'tactique', title: 'Les tactiques essentielles', icon: '⚔️',
  desc: 'Fourchette, clouage, enfilade, découverte : les motifs qui gagnent du matériel.',
  lessons: [
  {
    id: 'fourchette', title: 'La fourchette', mins: 4, theme: 'fork',
    steps: [
      { t: `<p>Une <b>fourchette</b>, c'est une pièce qui attaque <b>deux cibles en même temps</b>. L'adversaire ne peut en sauver qu'une.</p><p>Le cavalier est le roi des fourchettes. <b>Trouve l'échec qui attaque aussi la tour a8.</b></p>`,
        fen: 'r3k3/pp3ppp/8/3N4/8/8/PPP2PPP/6K1 w - - 0 1', task: { moves: ['Nc7+', 'Kd7', 'Nxa8'], hint: 'Quelle case permet au cavalier de toucher à la fois e8 et a8 ?' } },
      { t: `<p>Les pions aussi font des fourchettes ! <b>Attaque le fou et le cavalier noirs en même temps.</b></p>`,
        fen: '4k3/pp4pp/3b1n2/8/3PP3/8/PP3PPP/4K3 w - - 0 1', task: { moves: ['e5'], hint: 'Un pion attaque en diagonale vers l\'avant…' } },
    ]
  },
  {
    id: 'clouage', title: 'Le clouage', mins: 4, theme: 'pin',
    steps: [
      { t: `<p>Un <b>clouage</b> : une pièce ne peut pas bouger parce qu'elle protège une pièce plus importante derrière elle.</p><p>Ici, si tu mets ton fou en b4, la dame noire est clouée à son roi. <b>Joue-le !</b> (le pion a3 protège b4)</p>`,
        fen: '5k2/4qppp/8/8/8/P7/3B1PPP/6K1 w - - 0 1', task: { moves: ['Bb4', 'Qxb4', 'axb4'], hint: 'Fb4 : le fou, la dame et le roi seront alignés.' } },
      { t: `<p>Tu as gagné la dame contre un fou (+6 points). Retiens : <b>une pièce alignée avec son roi ou sa dame est une cible.</b></p>`, fen: '5k2/5ppp/8/8/1P6/8/5PPP/6K1 b - - 0 2' },
    ]
  },
  {
    id: 'enfilade', title: "L'enfilade", mins: 3, theme: 'skewer',
    steps: [
      { t: `<p>L'<b>enfilade</b>, c'est un clouage à l'envers : tu attaques la pièce la plus importante (souvent le roi). Elle doit bouger, et tu prends la pièce derrière.</p><p><b>Fais échec au roi pour gagner la dame.</b></p>`,
        fen: '4q3/8/8/4k3/8/8/8/R5K1 w - - 0 1', task: { moves: ['Re1+', 'Kd5', 'Rxe8'], hint: 'Le roi et la dame sont sur la même colonne.' } },
    ]
  },
  {
    id: 'decouverte', title: "L'attaque à la découverte", mins: 4, theme: 'discovered',
    steps: [
      { t: `<p>Une <b>attaque à la découverte</b> : tu déplaces une pièce, et ça <b>libère la ligne</b> d'une autre pièce derrière elle.</p><p>Ta dame d1 vise la dame noire, mais ton fou d4 est sur le chemin. <b>Bouge le fou en faisant échec !</b></p>`,
        fen: '1k1q4/pp6/8/8/3B4/8/5PPP/3Q2K1 w - - 0 1', arrows: [['d1', 'd8', Y]], task: { moves: ['Be5+', 'Ka8', 'Qxd8+'], accept: ['Bxa7+'], hint: 'Le fou en e5 attaque le roi b8.' } },
    ]
  },
  {
    id: 'mats', title: 'Les mats à connaître', mins: 5, theme: 'mate',
    steps: [
      { t: `<p><b>Le mat du couloir</b> : le roi est enfermé par ses propres pions. Une tour ou une dame sur la dernière rangée suffit. <b>Mate en 1.</b></p>`, fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', task: { moves: ['Rd8#'] } },
      { t: `<p><b>Le baiser de la mort</b> : la dame vient au contact du roi, protégée par une autre pièce. <b>Mate en 1.</b></p>`, fen: '6k1/5p1p/5PpQ/8/8/8/5PPP/6K1 w - - 0 1', task: { moves: ['Qg7#'], hint: 'La dame en g7 est protégée par le pion f6.' } },
      { t: `<p><b>Le mat à l'étouffée</b> : le roi est entouré de ses propres pièces, un cavalier suffit. <b>Mate en 1.</b></p>`, fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', task: { moves: ['Nf7#'] } },
    ]
  },
  ]
},
{
  id: 'finales', title: 'Les finales de base', icon: '👑',
  desc: 'Savoir mater avec une dame ou une tour, et pousser un pion jusqu\'à la promotion.',
  lessons: [
  {
    id: 'kq', title: 'Mater avec la dame', mins: 6,
    steps: [
      { t: `<p>Méthode : la dame se place à <b>un saut de cavalier</b> du roi adverse pour le repousser vers le bord, <b>sans faire échec</b>. Puis ton roi vient aider et la dame donne le mat sur le bord.</p>
<div class="key">Danger : le <b>pat</b> ! Si le roi adverse n'a plus de coup légal sans être en échec, c'est nulle. Laisse-lui toujours une case.</div>`, fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1', arrows: [['d1', 'd3', G]] },
      { t: `<p>À toi ! <b>Mate le roi noir en moins de 20 coups.</b> Le moteur défend.</p>`, fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1', play: { goal: 'mate', max: 20 } },
    ]
  },
  {
    id: 'kr', title: 'Mater avec la tour', mins: 8,
    steps: [
      { t: `<p>Avec une tour, on enferme le roi dans une « boîte » qui rétrécit. Ton roi vient <b>en opposition</b> (face au roi adverse, une case entre eux), puis la tour fait échec et repousse le roi d'une rangée.</p>`, fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1', arrows: [['a1', 'a4', G]] },
      { t: `<p>À toi ! <b>Mate en moins de 35 coups.</b></p>`, fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1', play: { goal: 'mate', max: 35 } },
    ]
  },
  {
    id: 'kp', title: 'Roi et pion contre roi', mins: 6,
    steps: [
      { t: `<p>Dans une finale roi + pion, <b>le roi passe devant le pion</b>. Quand ton roi est sur la 6e rangée devant ton pion, tu gagnes à coup sûr.</p><p>L'<b>opposition</b> : les deux rois face à face avec une case entre eux. Celui qui <i>n'a pas</i> le trait « a l'opposition ».</p>`, fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', arrows: [['e6', 'd6', G]] },
      { t: `<p>À toi : <b>emmène ton pion jusqu'à la dame.</b> Astuce : contourne le roi noir avec ton roi.</p>`, fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', play: { goal: 'promote', max: 12 } },
    ]
  },
  ]
},
{
  id: 'plans', title: 'Les plans de tes ouvertures', icon: '🗺️',
  desc: 'Que faire après l\'ouverture avec le Système de Londres et la Défense Française.',
  lessons: [
  {
    id: 'londres-plans', title: 'Système de Londres : les plans', mins: 5,
    steps: [
      { t: `<p>Voici la <b>structure idéale du Londres</b> : pions c3-d4-e3 (une « pyramide » solide), fou en f4 (ici g3) <b>sorti avant e3</b>, cavaliers f3 et d2, fou d3.</p><p>Tu joueras presque toujours cette position, quoi que fassent les Noirs.</p>`, pgn: LONDON_SETUP,
        marks: { c3: 'goodsq', d4: 'goodsq', e3: 'goodsq' } },
      { t: `<p><b>Plan n°1, l'attaque sur le roi</b> : Ce5, puis f4 pour soutenir le cavalier, puis Df3 ou Tf3-h3. Tes pièces se dirigent vers le roque noir.</p>`, pgn: LONDON_SETUP + ' b6 Ne5 Bb7 f4',
        arrows: [['e5', 'f7', Y], ['d3', 'h7', Y], ['d1', 'f3', G]] },
      { t: `<p><b>Le sacrifice grec</b> : quand le fou d3 vise h7, que ton cavalier peut venir en g5 et ta dame en h5, <b>Fxh7+</b> peut gagner. Retiens l'idée, ça marche souvent à ton niveau.</p>`, pgn: LONDON_SETUP + ' b6 Ne5 Bb7 f4', arrows: [['d3', 'h7', R], ['f3', 'g5', Y], ['d1', 'h5', Y]] },
      { t: `<p><b>Si les Noirs échangent ton fou</b> par …Fxg3, reprends avec <b>hxg3</b> : la colonne h s'ouvre pour ta tour h1. C'est un bonus pour ton attaque.</p>`, pgn: LONDON_SETUP + ' Bxg3 hxg3', arrows: [['h1', 'h7', G]] },
    ]
  },
  {
    id: 'francaise-plans', title: 'Défense Française : les plans', mins: 5,
    steps: [
      { t: `<p>Dans la Française, les Blancs ont plus d'espace avec leur pion e5. Ton plan : <b>attaquer leur chaîne de pions</b> à la base (d4) avec <b>…c5</b>, puis parfois avec <b>…f6</b>.</p>`, pgn: 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6', orient: 'b', arrows: [['c5', 'd4', G], ['c6', 'd4', G], ['b6', 'd4', G]] },
      { t: `<p>Ton problème : le <b>« mauvais fou » c8</b>, bloqué par tes pions e6 et d5. Solutions : l'échanger avec …b6 et …Fa6, ou le sortir par …Fd7-e8-h5.</p>`, pgn: 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6', orient: 'b', marks: { c8: 'red' } },
      { t: `<p>Les Blancs attaquent souvent ton roque avec Fd3, Dg4, Dh5. <b>Ne roque pas trop vite côté roi</b> si toutes leurs pièces visent h7 : garde ton cavalier en f6 ou f5 pour défendre.</p>`, pgn: 'e4 e6 d4 d5 Nc3 Nf6 e5 Nfd7 f4 c5 Nf3 Nc6 Be3', orient: 'b', arrows: [['c5', 'd4', G], ['c6', 'd4', G]] },
    ]
  },
  ]
},
];
