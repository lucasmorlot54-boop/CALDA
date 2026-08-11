# CALDA — Outil MOE Sous-Stations RCU

Outil d'études pour la maîtrise d'œuvre de sous-stations de réseaux 
de chaleur urbains. Couvre l'estimation des puissances bâtiment, le 
dimensionnement hydraulique de la sous-station, et les livrables 
associés.

Développé par Lucas.

---

## Règle de protocole non négociable

Lorsque Claude Code reçoit un prompt qui contient une mention
"STOP avant test", "STOP avant validation" ou équivalent, il
DOIT s'arrêter après avoir produit son livrable (diff,
compte-rendu) et ATTENDRE un retour explicite de l'utilisateur
avant de poursuivre.

Concrètement :
- Le livrable est produit (modifications de fichiers +
  compte-rendu)
- Aucun `git add`, `git commit` ou `git push` n'est exécuté
- Claude Code annonce qu'il attend la validation des tests
- Reprise UNIQUEMENT après un "go" explicite de l'utilisateur
  dans le chat

Cette règle s'applique même si :
- Le test semble trivial
- Le diff semble sans risque
- La session est longue et l'utilisateur semble enchaîner
- Aucun bug n'a été détecté pendant l'implémentation

Un commit prématuré est considéré comme une dérive du
protocole, même si techniquement le code fonctionne.

---

## Régime de travail : cosmétique vs sensible

Deux régimes selon la nature du travail :

**Régime rapide — travail purement cosmétique** (CSS, couleurs, espacements, 
libellés d'affichage, mise en page, reskin visuel sans changement de structure 
ni d'id) : enchaîner par blocs larges sans s'arrêter à chaque sous-étape. 
Vérifier l'équilibre des accolades et commentaires CSS, produire le livrable, 
signaler à l'utilisateur quoi tester à la fin. Pas d'arrêt intermédiaire.

**Régime rigoureux — travail sensible** (toute formule, valeur de calcul, 
méthode de dimensionnement, clé localStorage, structure de données, comportement 
utilisateur, id réutilisé par le JS) : conserver toute la rigueur définie dans 
ce fichier — audit lecture seule d'abord, source normative obligatoire, 
validation avant implémentation, aucune invention. La vitesse ne s'applique 
JAMAIS ici.

En cas de doute sur le régime, considérer que c'est du sensible.

---

## Règles strictes pour les commits Git

Ces règles s'appliquent à TOUS les commits sur le repo CALDA,
sans exception.

### Format des messages de commit

- Message sur une seule ligne au format :
  `type(scope): description`
- Types autorisés : feat, fix, refactor, docs, chore
- Exemples valides :
  - `feat(F10 phase 1): validation visuelle inline formulaire SST`
  - `fix(CAS 5): warning explicite dans calcECS_M1`
  - `feat(existant-projete sous-phase 1.2): modèle SST avec blocs existant/projete`
- Pas de body multi-ligne sauf demande explicite de l'utilisateur
- Pas de heredoc bash complexe pour les messages

### Attribution interdite

- INTERDIT : ajouter "Co-Authored-By: Claude" ou toute variante
- INTERDIT : mentionner Claude, Claude Code, Anthropic, IA,
  assistance IA, ou tout équivalent dans les messages de commit
- INTERDIT : signer les commits au nom de Claude ou d'un modèle d'IA
- Tous les commits doivent apparaître comme étant rédigés
  uniquement par l'utilisateur humain

### Workflow standard

1. `git add` (sauf `.claude/settings.local.json`)
2. `git commit -m "type(scope): description"`
3. `git push`
4. `git log -1 --oneline && git log origin/main -1 --oneline`
5. Vérifier que les deux SHA sont identiques et différents du SHA précédent

### Confidentialité du projet

Le projet CALDA est confidentiel et développé sur le temps
personnel et le matériel personnel de l'auteur. Le projet
n'utilise aucune donnée, aucun document ni aucun outil
fourni par l'employeur de l'auteur.

Aucun commit, aucun fichier versionné, aucune trace publique
du repo ne doit révéler :
- Le nom de l'employeur de l'auteur
- Le contexte commercial du projet (positionnement, cibles,
  modèle économique)
- Le fait que l'auteur utilise une assistance IA (Claude,
  Claude Code, Anthropic, IA, etc.)
- Les détails de l'environnement de travail professionnel
  de l'auteur

Dans le code, les commentaires, les commits et la
documentation : ne JAMAIS nommer l'employeur ni mentionner
le contexte professionnel de l'auteur.

---

## Concept général

- Application web entièrement locale, exécutée dans le navigateur.
- Aucun serveur, aucune base de données distante.
- Persistance des données via `localStorage` du navigateur.
- Export / import JSON pour sauvegarder ou partager un projet entre 
  machines.
- Versionnée sur GitHub pour le code source uniquement (pas les données 
  projet).

---

## Vision produit

CALDA a démarré comme un outil personnel et est en cours de
pivot vers un produit commercialisable destiné aux bureaux
d'études RCU, exploitants et constructeurs du secteur des
réseaux de chaleur urbains.

### Positionnement cible

Outil d'étude RCU couvrant la phase amont d'un projet :
- Estimation des puissances bâtiment
- Dimensionnement de la sous-station
- À terme : module carte pour pré-dimensionnement réseau
  grosse maille sur les petits et moyens projets de
  raccordement de quartier

Cibles commerciales prioritaires : bureaux d'études qui font
de la maîtrise d'œuvre et des études de raccordement RCU.
Cibles secondaires : exploitants pour leurs études de
raccordement de nouveaux abonnés.

Hors scope : CALDA ne vise pas à concurrencer les outils de
simulation hydraulique dynamique. L'outil reste sur le régime
permanent et la phase d'étude amont.

### Implication pour les arbitrages techniques

Chaque décision technique doit servir la vision commerciale.
Face à un choix entre "rapide mais qui ne tient pas la route
en commercialisation" et "plus long mais propre et
généralisable", préférer systématiquement la seconde option.

Les fonctionnalités spécifiques à un usage interne (par
exemple auto-remplissage de livrables propres à un bureau
d'études donné) ne sont PAS à conserver. CALDA doit rester
neutre et utilisable par tout bureau d'études du secteur.

---

## Règles produit non négociables

Ces règles s'appliquent à TOUTE modification du code, des labels, des 
commentaires, et de la documentation interne.

### 1. Neutralité commerciale stricte

CALDA ne propose, ne prescrit, ne cite AUCUNE marque commerciale 
(constructeurs, exploitants, gammes spécifiques). Les équipements 
sont décrits uniquement par leurs caractéristiques techniques 
(Kvs, DN, puissance, autorité, ΔT, etc.).

Concrètement :
- Pas de marque dans les labels, options, placeholders ou commentaires
- Pas de référence produit dans les exemples
- Pas de nom d'exploitant ou de constructeur dans l'UI

### 2. Vocabulaire métier standard

CALDA utilise le vocabulaire reconnu de la profession (guides AMORCE, 
CEREMA, ADEME, normes EN), et non le jargon interne d'un bureau 
d'études spécifique.

**Terminologie validée (à utiliser) :**
- "Montage série" / "Montage parallèle" pour le couplage ECS-chauffage
- "ECS deux étages" pour les échangeurs ECS à étages 
  (charge + bouclage)
- "Bouclage ECS" pour la recirculation ECS (et non "recyclage")
- "Majoration (%)" pour les coefficients de sécurité (et non "marge")
- "Pincement échangeur" pour le ΔT minimal d'approche
- "Puissance unitaire ECS" pour les ratios kW/unité du Module 0
- "Sous-station" (NF E 39-001 §2.2.9) pour l'ouvrage abritant 
  poste de livraison ou de transfert
- "Point de livraison" (NF E 39-001 §2.2.2) pour le lieu où 
  l'énergie est livrée
- "Vecteur énergétique" (NF E 39-001 §2.2.10) pour le fluide 
  caloporteur
- "Puissance souscrite" (NF E 39-001 §3.1.2) pour la référence 
  contractuelle

**Termes BANNIS (jargon interne, à ne jamais utiliser) :**
- "Épuisement" / "Tout-épuisement" → utiliser "Montage série"
- "Géodune" → utiliser "ECS deux étages"
- Tout vocabulaire propriétaire de bureau d'études

### 3. Traçabilité des formules

Chaque calcul s'appuie sur une source publique identifiée (norme, 
guide professionnel, manuel de référence). Pas de formule "boîte 
noire" sans source documentée.

Dans les commentaires de code, citer la source publique :
- Bon : `// Méthode M1 ECS — Ks = 0,8/√(N-1) — NF DTU 60.11 P1-1 §3.2.2`
- À éviter : `// formule selon méthode interne BE`

---

## Bibliothèque normative de référence

CALDA s'appuie sur les sources publiques suivantes pour ses calculs, 
valeurs par défaut et vocabulaire. Toute formule ajoutée ou modifiée 
doit pouvoir être tracée à l'une de ces sources.

### Sources principales

| Référence | Date | Usage dans CALDA |
|---|---|---|
| **NF DTU 60.11 P1-1** | Août 2013 | Calcul ECS : simultanéité (Ks), débits unitaires |
| **NF EN 12831-1** | Juillet 2017 | Charge thermique nominale bâtiment (CH) |
| **NF EN 12831-3** | Juillet 2017 | Charge thermique ECS (ϑ_draw, ϑ_c) |
| **NF P52-612/CN** | Décembre 2010 | Complément national : T_ext_base, facteur de relance |
| **NF E 39-001** | Décembre 1998 | Terminologie RCU (sous-station, puissance souscrite, etc.) |
| **Th-BCE 2012** | Arrêté avril 2013 | Méthode RT2012, besoins ECS tertiaires (§17) |
| **Th-BCE 2020** | Arrêté août 2021 | Méthode RE2020, besoin logement (392 L/adulte_éq/sem) |
| **AICVF Tome 3** | 1991 | Configurations ECS, dimensionnement échangeur + ballon |

### Sources complémentaires

- **Guides AMORCE** (RCP31 Schéma Directeur, Création Réseau Chaleur) : 
  vocabulaire phase amont RCU
- **Arrêté du 30 novembre 2005** modifiant arrêté du 23 juin 1978 : 
  T ≥ 50 °C en tout point boucle ECS (prévention légionellose)

### Règles de citation dans le code et les tooltips

- Citer la **référence courte** (ex: "NF DTU 60.11 P1-1 §3.2.2"), 
  pas le titre complet
- **Ne JAMAIS reproduire** de paragraphes entiers des normes 
  (droit d'auteur AFNOR/CEN)
- Citer la **section quand pertinent** (§D.6, §3.4)
- Doser la fréquence : une citation par fonction ou bloc, pas à 
  chaque ligne

---

## Architecture des modules

L'application est organisée en modules fonctionnels accessibles via 
des onglets. Chaque module a son fichier JS dédié et persiste ses 
données dans `localStorage`.

### Module 0 — Hypothèses (`js/hypotheses.js`)

Paramètres globaux du projet utilisés par les autres modules :
- Réseau primaire : températures départ/retour été et hiver
- Météo : station de référence, DJU de référence, historique 5 ans
- Températures de calcul : T_ext_base, T_coupure (base 18°C)
- Pincements échangeurs (CH et ECS)
- Températures ECS : départ, bouclage, eau froide sanitaire
- Hypothèses par type de bâtiment (W/m²)
- Lois d'eau et émetteurs (radiateurs, plancher, etc.)

Stockage : clé `flux_project_{id}` → champ `hypotheses` (objet unique 
global).

### Module 1 — BDD bâtiments / SST (`js/bdd.js`)

Saisie des données bâtiment et création des sous-stations :
- Informations bâtiment : nom, adresse, type, surface, année, etc.
- Création / édition des SST avec leur référence
- Type de SST : CH seul, ECS seul, CH + ECS

Stockage : `window.sousStations` (array) → clé 
`flux_project_{id}` → champ `sousStations`.

### Module 2 — Puissance (`js/puissance.js`)

Estimation des puissances chauffage et ECS par SST :

**Méthodes chauffage (5) :**
- M1 : consommations historiques corrigées DJU
- M2a : à partir d'une chaudière existante
- M2b : à partir d'un échangeur CH existant ou bilan thermique 
  sur les départs
- M3 : ratio W/m² × Surface
- M4 : à partir de la puissance souscrite au contrat

**Méthodes ECS (4 actuelles + M5 prévue) :**
- M1 : DTU 60.11 (foisonnement par simultanéité)
- M2 : consommations eau froide d'appoint ECS au compteur chaufferie
- M3 : à partir d'un échangeur ECS existant
- M4 : à partir de la puissance souscrite au contrat
- **M5 : ratios par typologie (prospectif, en chantier — pour les 
  projets neufs sans historique)**

**Configurations ECS gérées :**
- Instantané (parallèle ou en série)
- Semi-instantané (parallèle ou en série)
- Accumulation (parallèle ou en série)
- ECS deux étages (en série par construction)

**Synthèse :** débit primaire, T° retour primaire pondérée, 
dimensionnement échangeur (P, ΔTLM, débit, surface).

Stockage : `window.donneesP2` (objet indexé par `sst.ref`) → clé 
`flux_project_{id}` → champ `donneesP2`.

### Module Référentiels (`js/referentiels.js`)

Tables de référence personnalisables :
- Table DN : débits hydrauliques en fonction du diamètre selon plusieurs 
  pertes de charge linéaires (J = 10, 15, 20 mm/m)

Stockage : clé `flux_referentiel_dn`.

### Gestion des projets (`js/projects.js`)

Module transverse de gestion multi-projets :
- Création, ouverture, suppression de projets
- Sauvegarde automatique en localStorage
- Migration des données legacy via `_migrateProjectData()`

### Import / Export (`js/export.js`)

Export / import JSON d'un projet complet pour partage et sauvegarde.
Applique la migration automatique sur les imports legacy.

---

## Stack technique

- **HTML / CSS / JS vanilla** (aucun framework)
- **Aucune build chain** : code servi directement
- **Hébergement** : GitHub Pages (statique)
- **Persistance** : `localStorage` (côté navigateur)
- **Pas de backend, pas d'API externe**

### Dépendances CDN éventuelles

Vérifier `index.html` pour la liste effective des bibliothèques 
chargées. Toute nouvelle dépendance doit être justifiée par un besoin 
concret et préférer les solutions natives quand c'est possible.

---

## Persistance localStorage — architecture des données

**Section critique pour toute modification du code.**

### Clés localStorage utilisées

| Clé | Portée | Contenu |
|---|---|---|
| `flux_theme` | globale | `'dark'` ou `'light'` |
| `flux_view_mode` | globale | `'v1'` (liste) ou `'v2'` (cartes) |
| `flux_projects` | globale | Array JSON : métadonnées de tous les projets |
| `flux_current_project` | globale | ID string du projet ouvert |
| `flux_project_{id}` | par projet | Objet JSON contenant toutes les données projet |
| `flux_referentiel_dn` | globale | Array JSON : table DN personnalisée |
| `flux_moduleActif_{id}` | par projet | ID du dernier onglet actif (M0/M1/M2/Référentiels) |
| `flux_etatAffichage_{id}` | par projet | État d'affichage M2 (existant/projete) |
| `flux_tableauTri_{id}` | par projet | État tri du tableau M1 |
| `flux_p2SstRef_{id}` | par projet | Référence SST sélectionnée en M2 |

### Structures globales partagées entre modules

Trois objets globaux sur `window` portent l'état projet en mémoire :

- **`window.sousStations`** (array) — géré par `bdd.js`
  - Liste des SST du projet courant
  - Chaque SST contient au minimum : `ref`, `nom`, `typeSST` 
    (CH/ECS/CH+ECS), surface, et autres champs bâtiment

- **`window.donneesP2`** (objet) — géré par `puissance.js`
  - Indexé par `sst.ref` (référence SST)
  - Pour chaque SST : `cfgEcs`, méthodes CH/ECS choisies, données 
    saisies, résultats calculés, majorations

- **`window.hypotheses`** (objet) — géré par `hypotheses.js`
  - Objet unique global pour tout le projet
  - Contient les paramètres réseau, météo, températures, pincements, 
    bouclage, etc.

### Structure du projet sauvegardé (`flux_project_{id}`)

```json
{
  "sousStations": [...],
  "donneesP2": { "<sst.ref>": {...}, ... },
  "hypotheses": {...}
}
```

### Valeurs clés à connaître

**`donneesP2[ref].cfgEcs`** — chaîne de configuration ECS, valeurs 
possibles :
- `"Instantané"`, `"Instantané en série"`
- `"Semi-instantané"`, `"Semi-instantané en série"`
- `"Accumulation"`, `"Accumulation en série"`
- `"ECS deux étages"`, `"ECS deux étages en série"`

**`hypotheses`** — clés ECS principales :
- `ecsTauxBouclage` (taux de bouclage ECS — majoration pour pertes 
  thermiques de la boucle, M2 ECS)
- `tRetBouclageEcs` (T° retour bouclage)
- `tempEauFroideEcs` (T° eau froide entrée, utilisée dans calcECS_M1 
  et calcECS_M2)
- `tRetEcs` (champ Module 0, attention : voir ROADMAP_CHANTIERS.md 
  ECS-10 — incohérence avec tempEauFroideEcs à clarifier)

**`donneesP2[ref]`** — clés majoration :
- `majorationCh`
- `majorationEcs`
- `majoration_echangeur_ecs_semi_instantane`

**`donneesP2[ref]`** — surcharges optionnelles par SST :
- `ecsTauxBouclage` : si défini, surcharge `hypotheses.ecsTauxBouclage` 
  pour cette SST uniquement. Si absent, la valeur M0 s'applique. 
  Résolution via `getEcsTauxBouclageEffectif(ref)` dans 
  `js/puissance.js`. Visible et éditable uniquement pour la config 
  "ECS deux étages en série".
- `pctBouclage_` : part de bouclage du dimensionnement deux étages 
  (différent du `ecsTauxBouclage` ci-dessus — répartition 
  charge/finition, pas majoration de puissance).

### Règle critique : migration des données

Toute modification du nom d'une clé dans `donneesP2`, `hypotheses` ou 
d'une valeur `cfgEcs` doit obligatoirement passer par 
`_migrateProjectData()` dans `js/projects.js`.

Procédure :
1. Ajouter la migration (copie ancienne → nouvelle clé/valeur)
2. Mettre à jour tous les usages dans le code
3. Conserver l'ancienne clé en parallèle pendant une période de 
   transition
4. Programmer la suppression de l'ancienne clé dans une phase 
   ultérieure une fois la stabilité confirmée

`charger()` dans `js/export.js` doit aussi appeler 
`_migrateProjectData()` pour les imports JSON legacy.

### Cohérence inter-modules

Les modules communiquent **uniquement via** `window.sousStations`, 
`window.donneesP2` et `window.hypotheses`. Toute donnée transverse doit 
passer par ces structures et être persistée selon le schéma 
ci-dessus. Pas de variable globale "sauvage".

---

## Conventions de code

### Nommage des variables JS

- camelCase pour variables et fonctions : `puissanceChauffage`, 
  `calculDebitPrimaire`
- Préfixes communs :
  - `with*` pour les booléens de configuration (`withSerie`, 
    `withDeuxEtages`)
  - `render*` pour les fonctions d'affichage
  - `build*` pour les fonctions de construction (SVG, structures)
  - `calc*` pour les fonctions de calcul

### Nommage des IDs HTML

- Module 0 (Hypothèses) : `hyp-{concept}` (ex. `hyp-ecs-taux-bouclage`)
- Module 2 (Puissance) : `p2-{domaine}-{concept}` (ex. 
  `p2-ecs-pct-bouclage`)

### Nommage des classes CSS

- BEM-like : `.bloc__element--modifier` 
  (ex. `.p2-ballon-box--deux-etages`)
- Préfixe de module pour la portée (`p2-` pour Module 2 ; le préfixe `m3-` est réservé pour le futur Module 3)

### Langue

- Identifiants et noms de fonctions : français quand le terme métier 
  est plus clair en français (`debitPrimaire`, `puissanceUnitaireEcs`), 
  anglais sinon
- Commentaires : français
- Labels UI : français

---

## Patterns UX validés

Ces patterns sont les conventions de CALDA pour les éléments d'interface 
récurrents. À respecter pour toute nouvelle fonctionnalité ou évolution.

### Panneaux explicatifs des méthodes de calcul (PANELS-01)

Pour chaque méthode de calcul du Module 2 (CH M1-M4, ECS M1-M4 et 
future M5), une icône `ℹ` est positionnée à côté du titre de la 
méthode. Au **clic** (pas au survol), un **accordéon s'ouvre en 
dessous du bloc** affichant :

- Origine de la méthode (source normative)
- Origine de chaque grandeur (Ks, T_puisage, T_EF, constantes 
  physiques)
- Hypothèses implicites
- Limites d'application
- Avertissements éventuels (ex: Ks = 1 pour équipements sportifs)

**Format cible :** 5 à 8 lignes, structuré en puces. Référence aux 
normes en référence courte (NF DTU 60.11 P1-1 §3.2.2 par exemple). 
Pas de pop-up, pas de modale, pas de survol — accordéon inline visible 
directement, qui complète le détail de calcul existant.

### Tooltips champs de saisie Module 0

Pour les champs de paramètres globaux du Module 0 (T_ext_base, 
T° départ ECS, Taux de bouclage, PCS gaz, etc.), une icône `(?)` à 
côté du libellé affiche au survol un tooltip court (2-3 phrases max) 
expliquant :

- À quoi sert le paramètre
- D'où vient la valeur par défaut (norme ou pratique BE)
- Plage de valeurs courantes

Pour les champs avec valeur calculée (ΔT ECS par exemple), le tooltip 
peut être omis ou minimal.

### Field-hint existant

CALDA dispose déjà d'un pattern `field-hint` pour les explications 
courtes sous certains champs. À conserver pour les paramètres 
secondaires et harmoniser progressivement avec le pattern tooltip 
ci-dessus.

---

## Règles de développement

1. **Vanilla uniquement** : pas d'introduction de framework JS sans 
   justification forte.
2. **Responsive** : l'app doit rester utilisable sur écran portable 
   (1280px et plus).
3. **Une seule page** : SPA basée sur des onglets, pas de routage 
   multi-pages.
4. **Sauvegarder en continu** : toute modification utilisateur doit 
   être persistée dans `localStorage` automatiquement (pas de bouton 
   "Sauvegarder" obligatoire). **Exception : le formulaire d'édition 
   SST du Module 1** utilise une logique transactionnelle (bouton 
   Enregistrer) avec dirty state et confirmation à la sortie — voir 
   commit `de07caa`.
5. **Formules transparentes** : chaque calcul affiché doit pouvoir 
   être justifié par une source publique (norme, guide). Voir 
   bibliothèque normative ci-dessus.
6. **Tester systématiquement** : après toute modification, vérifier 
   qu'un projet réel se charge sans erreur console et que les 
   modules dépendants continuent de fonctionner.
7. **Ne jamais casser un module existant** : toute refonte doit 
   prévoir une migration backward-compat des données déjà persistées.

---

## Contexte métier — paramètres de référence

Cette section sert d'aide-mémoire pour les valeurs typiques en MOE 
RCU. À utiliser comme valeurs par défaut ou comme garde-fous de 
plausibilité.

### Température et puissance chauffage

- T° extérieure de base : -7°C (zone H1 nord-est de la France), 
  -5°C (zone H2), -3°C (zone H3) — à confirmer par DPE, étude 
  thermique ou NF P52-612/CN Tableaux D.1a (par département) et 
  D.1b (correction altitude)
- T° de coupure chauffage : 15 à 18°C (souvent 16°C)
- DJU base 18°C : ordre de grandeur 2200 à 2800 selon zone climatique
- Lois d'eau secondaire courantes :
  - Radiateurs haute température : 80/60°C ou 70/50°C
  - Radiateurs basse température : 60/40°C
  - Plancher chauffant : 40/30°C ou 35/30°C

### Régimes primaires courants

- Réseaux haute température : 110/65°C, 95/55°C
- Réseaux moyenne température : 85/55°C
- Réseaux basse température : 70/45°C, 65/40°C

### ECS

- T° départ ECS bâtiment : 55°C (souvent), 60°C si traitement 
  legionella obligatoire
- T° retour bouclage : 50 à 53°C selon longueur réseau (minimum 
  réglementaire 50°C, arrêté du 30 novembre 2005)
- T° eau froide : 10°C (par défaut, cohérent avec ϑ_c de la 
  NF EN 12831-3 §B)
- T° puisage : 40°C (eau mélangée au point d'usage, cohérent avec 
  ϑ_draw de la NF EN 12831-3 §B et Th-BCE 2020 §2.1.1)
- Foisonnement ECS : selon NF DTU 60.11 P1-1 §3.2.2 (formule 
  Ks = 0,8/√(N-1)). **Exception** : pour équipements sportifs, 
  casernes, internats, écoles avec douches collectives, prendre 
  Ks = 1 (DTU NOTE 1).

### Pincements échangeurs

- Pincement échangeur CH : 3 à 5°C
- Pincement échangeur ECS : 3 à 7°C (souvent 5°C)

### Marge de dimensionnement CH

- Majoration de 15 % par défaut (relance + sécurité) — voir 
  NF P52-612/CN §D.6 : la surpuissance de relance doit s'afficher 
  séparément du calcul de déperditions de base. Tableaux D.10a 
  (non résidentiel, ralenti 12h) et D.10b (résidentiel, ralenti 8h) 
  donnent les facteurs de relance par inertie.

### Points de vigilance MOE

- Vérifier la cohérence régime primaire / régime secondaire : un 
  retour secondaire trop chaud pénalise le ΔT primaire et augmente 
  le débit primaire à souscrire.
- Anticiper la puissance de maintien de boucle ECS (pertes 
  thermiques) dans le bilan ECS.
- Vérifier le taux de simultanéité ECS si bâtiment avec usages 
  multiples (logements + commerces + bureaux).
- Pour le montage série : le retour ECS doit être 
  thermodynamiquement compatible avec le primaire chauffage 
  (température et débit).

---

## Modules planifiés (roadmap)

Modules envisagés à terme, **non encore implémentés** :

- **Module 3 — Estimation budgétaire grosse maille** : listes types 
  d'équipements par configuration SST (CH, CH+ECS instantané, CH+ECS 
  deux étages, etc.), chiffrage par défaut modifiable, possibilité 
  d'import de catalogues de prix utilisateur. Vise l'estimation type 
  étude de faisabilité.
- **Module Export** : génération de livrables (notes de calcul PDF, 
  CCTP, schémas de principe paramétriques) à partir des données 
  saisies dans les modules amont.
- **Module Carte / réseau** : positionnement géographique des SST 
  sur une carte, tracé du réseau primaire, pré-dimensionnement 
  hydraulique grosse maille (DN, pertes de charge, débits par 
  tronçon) pour les petits et moyens projets de raccordement de 
  quartier.

Ces modules feront l'objet de spécifications distinctes avant 
implémentation.

---

## Chantiers en cours — Légitimité normative

Un travail de légitimité normative est en cours pour aligner CALDA 
sur l'état de l'art professionnel et les sources normatives 
publiques. Voir le fichier **`ROADMAP_CHANTIERS.md`** (hors repo Git) 
pour le suivi détaillé.

**Chantiers prioritaires en cours :**

1. **ECS-10** (Critique) — Clarification incohérence T° retour ECS 
   vs T° eau froide (schéma SVG 15°C vs formules 10°C)
2. **ECS-13** (Haute) — Sortir T_puisage (40°C) en paramètre Module 0 
   (actuellement codé en dur)
3. **ECS-05** (Haute) — Sportif : monter le ratio kW/douche et 
   appliquer Ks=1 pour typologies à douches collectives
4. **ECS-01** (Haute) — Tooltip clarifiant que puEcs Bureaux/Enseignement 
   est destiné à la future M5

**Chantiers planifiés (V1) :**
- ECS-02, ECS-06 (EHPAD), PANELS-01 (panneaux explicatifs), ECS-14 
  (Méthode 5 ratios prospectifs), CH-06, CH-07, ECS-09, ECS-11

**Chantiers archivés** (audit a confirmé qu'ils sont déjà résolus) :
CH-01, CH-02, CH-03, ECS-03, ECS-04, ECS-07 ("épuisement" absent du 
code), ECS-12.

---

## Pour Claude Code : règles de session

À chaque session de développement sur ce projet :

1. **Lire ce fichier en intégralité** avant d'agir.
2. **Lire `ROADMAP_CHANTIERS.md`** si la session concerne la 
   légitimité normative.
3. **Respecter les règles produit** : neutralité commerciale, 
   vocabulaire métier (terminologie validée et termes bannis), 
   traçabilité des formules avec citation des sources normatives.
4. **Préserver la cohérence localStorage** : toute modification d'une 
   clé persistée passe par une migration documentée 
   (`_migrateProjectData()`).
5. **Pour les modifications sensibles** (clés localStorage,
   refonte d'un module, changement structurel, modification
   d'un comportement utilisateur) : faire un audit en lecture
   seule d'abord, attendre validation explicite de
   l'utilisateur, puis implémenter.
6. **Distinguer audit (lecture) et implémentation (écriture)** : 
   pour toute refonte d'ampleur, faire d'abord un audit, attendre 
   validation, puis implémenter.
7. **Ne jamais inventer** : si une formule ou un comportement n'est 
   pas clair, demander avant d'agir. Pour les sources normatives, 
   se référer à la bibliothèque normative ci-dessus, ne pas inventer 
   de référence.
8. **JAMAIS de commit autonome sans "go" explicite** :
   lorsqu'un prompt contient "STOP avant test" ou équivalent,
   produire le livrable puis s'arrêter. Aucun `git add`,
   `git commit` ou `git push` avant le retour utilisateur.
   Voir la section "Règle de protocole non négociable" en tête
   de ce fichier.
