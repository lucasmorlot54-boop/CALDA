// ── Module 0 : Hypothèses générales du projet ─────────────────────────────
//
// Données communes à toutes les SST, saisies une seule fois.
// Réutilisées automatiquement dans le Module 2.
//
// window.hypotheses — objet global, persisté dans localStorage + JSON export
// ─────────────────────────────────────────────────────────────────────────

window.hypotheses = {
  // Réseau de chaleur
  rchDepHiver: null, rchRetHiver: null,
  rchDepEte:   null, rchRetEte:   null,
  // DJU
  stationMeteo: '', djuRef: null,
  djuN1: null, djuN2: null, djuN3: null, djuN4: null, djuN5: null,
  // Hypothèses chauffage
  tExtBase: -7, tCoupure: 18,
  pincementCh: 2,
  // Hypothèses ECS
  tDepEcs: 60, tRetEcs: 38,
  tRetBouclageEcs: 53,
  tPuisageEcs: 40,
  pincementEcs: 10,
  tempEauFroideEcs: 10,
  ecsTauxBouclage: 20,
  // Hypothèses par type de bâtiment (overrides par type)
  hypBatiments: {},
  // Hypothèses par type d'émetteur (overrides locaux)
  emetteurs: {},
  // Combustibles — utilisés dans M1 CH mode gaz / fioul
  pcsGaz:   11.2, // kWh/m³ — PCS gaz naturel (valeur contractuelle typique)
  pciFioul: 10,   // kWh/L  — PCI fioul domestique standard
};

// ── Référentiel des types de bâtiment avec valeurs par défaut ─────────────
// dBesoin : besoin unitaire ECS en L/sem/unité (source normative Th-BCE)
// dNadeq  : nombre d'adultes-équivalents par unité (2,45 pour logements, 1 sinon)
// Formule : P [kW] = (dBesoin × dNadeq × 4,186 × ΔT) / (7 × dHPointe × 3600)
// dSource : référence normative courte affichée dans le tableau M0
// dInfo   : texte d'explication affiché dans l'accordéon badge ℹ

// Explication Nadeq commune aux 4 typologies logement — Th-BCE 2012 §11.6.3.2.2.1
const NADEQ_LOGT_INFO =
  'Th-BCE 2012 §11.6.3.2.2.1 — Nadeq (adultes-équivalents/logement) dépend de S_moy = S_habitable / N_logements :<br>' +
  '• S_moy &lt; 10 m² : Nadeq = 1<br>' +
  '• 10 ≤ S_moy ≤ 50 m² : Nadeq = 1,75 − 0,01875 × (50 − S_moy)<br>' +
  '• S_moy ≥ 50 m² : Nadeq = 0,035 × S_moy<br><br>' +
  'Pour un T3 standard (~70 m²) : Nadeq ≈ 2,45. À titre indicatif :<br>' +
  '• T1-T2 (~40 m²) : Nadeq ≈ 1,4 → P_unit ECS ≈ 1,2 kW/logt<br>' +
  '• T3 (~70 m²) : Nadeq ≈ 2,45 → P_unit ECS ≈ 2 kW/logt<br>' +
  '• T4-T5+ (~90 m²) : Nadeq ≈ 3,15 → P_unit ECS ≈ 2,6 kW/logt<br><br>' +
  'Valeur de Besoin a modifiable si projet atypique (résidence senior, étudiant, etc.).';

const BUREAUX_INFO =
  'Th-BCE 2012 §17.3 — Bureaux. Besoin conventionnel 1,25 L à 40°C par m² de surface utile et par semaine.<br>' +
  'Couvre principalement les lavabos sanitaires et tisanerie.<br>' +
  'Valeur modifiable si projet atypique (ex : bureaux avec restaurant interne intégré — ' +
  'utiliser dans ce cas les typologies Restauration scolaire ou Restauration commerciale en complément).';

const ENSEIGNEMENT_INFO =
  'Th-BCE 2012 §17.6 (primaire), §17.7 (secondaire jour) et §17.9 (université) — Enseignement.<br>' +
  'Besoin conventionnel 0,2 L à 40°C par m² de surface utile et par semaine.<br>' +
  'Ne couvre que les sanitaires diurnes (lavabos).<br>' +
  '<strong>Attention :</strong> pour un établissement avec hébergement (internat, résidence étudiante), ' +
  'utiliser la typologie "Foyer / cité universitaire" pour l\'aile hébergement ' +
  '(330 L/sem/lit — Th-BCE 2012 §17.8 et §17.13).';

const CRECHE_INFO =
  'Th-BCE 2012 §17.5 — Petite enfance (crèche, halte-garderie). Besoin conventionnel 52,5 L à 40°C par lit ' +
  '(berceau d\'agrément) et par semaine. Couvre les sanitaires de l\'établissement.<br>' +
  '<strong>Attention :</strong> pour les crèches atypiques avec équipements intégrés ' +
  '(pouponnière, bain bébé, biberonnerie lourde, lingerie), la valeur Th-BCE peut être insuffisante. ' +
  'Surcharger manuellement Besoin a si le projet inclut ces équipements spécifiques.';

const FOYER_INFO =
  'Th-BCE 2012 §17.13 (Foyer de jeunes travailleurs) et §17.14 (Cité universitaire) — ' +
  'valeur identique 330 L à 40°C par lit et par semaine.<br>' +
  'Couvre l\'hébergement collectif avec usage ECS type douche + lavabo individuel.<br>' +
  'Cas typiques : résidence étudiante, résidence sociale, foyer jeunes actifs.<br>' +
  'Pour un EHPAD ou hôpital, utiliser les typologies dédiées si disponibles.';

const HOTEL_INFO =
  'Th-BCE 2012 §17.17 à §17.22 — Hôtel partie nuit. Le besoin ECS varie significativement ' +
  'avec la classification (catégorie d\'étoiles) du fait des équipements de chambre ' +
  '(douche/baignoire, accessoires) et du niveau de service.<br><br>' +
  'Valeurs Th-BCE 2012 de référence par catégorie :<br>' +
  '• Hôtel 0-1* (économique) : 420,6 L/sem/chambre (§17.18)<br>' +
  '• Hôtel 2* : 586,2 L/sem/chambre (§17.19)<br>' +
  '• Hôtel 3* : 655,2 L/sem/chambre (§17.21)<br>' +
  '• Hôtel 4-5* (haut standing) : 902,7 L/sem/chambre (§17.22)<br><br>' +
  'Sélectionner la ligne correspondant à la catégorie du projet. ' +
  'La partie jour (restauration, espace bien-être) est traitée séparément ' +
  'via les typologies Restauration scolaire ou Restauration commerciale et autres si applicable.';

const RESTAU_SCOLAIRE_INFO =
  'Th-BCE 2012 §17.29 — Restauration scolaire (3 repas/jour, 5j/7).<br>' +
  'Besoin conventionnel 95 L à 40°C par repas servi et par semaine.<br>' +
  'Cas typiques : cantine scolaire (primaire, secondaire, supérieur), restaurant d\'entreprise public.<br>' +
  'La saisie M1 demande le nombre de repas servis par jour.<br>' +
  'Pour les restaurations commerciales ouvertes 7j/7, utiliser la typologie "Restauration commerciale".';

const RESTAU_COMMERCE_INFO =
  'Th-BCE 2012 §17.28 — Restauration commerciale (2 repas/jour, 7j/7).<br>' +
  'Besoin conventionnel 357 L à 40°C par repas servi et par semaine.<br>' +
  'Cas typiques : restaurant indépendant, brasserie, fast-food, restauration d\'hôtel ouverte au public.<br>' +
  'La saisie M1 demande le nombre de repas servis par jour.<br>' +
  'Pour une cantine scolaire (5j/7), utiliser la typologie "Restauration scolaire".';

const SPORTIF_INFO =
  'Méthode de dimensionnement CALDA : 6 kW à 40°C par douche, basée sur NF DTU 60.11 P1-1 §3.2.2 NOTE 1.<br>' +
  'Pour les douches collectives sportives (gymnase, complexe sportif, vestiaires de stade), ' +
  'le DTU impose Ks = 1 (toutes les douches peuvent fonctionner simultanément), ' +
  'ce qui conduit à un dimensionnement instantané plus élevé que le besoin moyen hebdomadaire.<br>' +
  'Th-BCE 2012 §17.12 donne 1200 L/sem/douche ≈ 4 kW/douche en pointe moyenne — ' +
  'CALDA retient la valeur DTU comme plus représentative de la pointe instantanée réelle.<br>' +
  'Pour les installations équipées de robinets temporisés, surcharger manuellement Besoin a.';

const EHPAD_INFO =
  'Th-BCE 2012 §17.10 — Établissement sanitaire avec hébergement (EHPAD, maison de retraite, ' +
  'foyer médicalisé pour personnes âgées). Besoin conventionnel 600 L à 40°C par lit et par semaine.<br>' +
  'Couvre l\'hébergement collectif gériatrique avec usage ECS de type chambre individuelle ' +
  '(douche + lavabo) et services collectifs (cuisine centrale, lingerie).<br>' +
  'Occupation continue 24h/24, pas d\'abaissement nocturne.<br>' +
  'Pour un hôpital actif (clientèle plus jeune, davantage de soins lourds), utiliser la typologie "Hôpital actif".';

const HOPITAL_INFO =
  'Th-BCE 2012 §17.16 — Hôpital partie nuit. Besoin conventionnel 820 L à 40°C par lit et par semaine.<br>' +
  'Couvre l\'hébergement médical avec besoins ECS plus élevés qu\'un EHPAD : soins fréquents, lavages, ' +
  'équipements médicaux, stérilisation. Occupation continue 24h/24.<br>' +
  'Pour la partie jour (consultations, administration), Th-BCE §17.15 prévoit 0,24 L/sem/m² — ' +
  'peu significatif et noyé dans la pointe nuit, non distingué ici.<br>' +
  'Pour un EHPAD (gériatrie, besoins plus lissés), utiliser la typologie "EHPAD / Maison de retraite".';

const AUTRE_INFO =
  'Typologie générique pour les bâtiments dont l\'usage n\'est pas couvert par les typologies standard CALDA. '
  + 'Cas typiques : data center, clinique privée, salle de spectacle, process industriel spécifique, parking chauffé, etc.<br><br>'
  + '<strong>ATTENTION</strong> : tous les paramètres CH (ratio W/m², intermittence, durée) et ECS (besoin, P_unit) '
  + 'sont vides par défaut. L\'utilisateur doit renseigner manuellement les valeurs adaptées à son projet '
  + 'dans ce tableau avant utilisation en Module 2.<br><br>'
  + 'Recommandations de sourçage selon le cas :<br>'
  + '• Process industriel : voir spécifications du procédé (constructeur, fluides industriels).<br>'
  + '• Bâtiment tertiaire atypique : AICVF Tome 3 (guide consommations) ou retours d\'expérience BE.<br>'
  + '• Usage proche d\'une typologie standard : préférer la typologie correspondante avec surcharge plutôt que "Autre".';

const HYP_BAT_GROUPS = [
  { label: 'Logements',
    keys: ['log-coll', 'log-rt2012', 'log-re2020', 'mixte'] },
  { label: 'Tertiaire — occupation jour',
    keys: ['tert-bureaux', 'tert-enseign', 'tert-creche'] },
  { label: 'Tertiaire — hébergement',
    keys: ['tert-foyer', 'tert-hotel-01', 'tert-hotel-2', 'tert-hotel-3', 'tert-hotel-45'] },
  { label: 'Tertiaire — usage spécifique',
    keys: ['tert-resto-scolaire', 'tert-resto-commerce', 'tert-sport'] },
  { label: 'Tertiaire — sanitaire et médico-social',
    keys: ['tert-ehpad', 'tert-hopital'] },
  { label: 'Autres typologies',
    keys: ['autre'] },
];

const HYP_BAT_TYPES = [
  // Résidentiel — dNadeq = 2,45 adultes-éq/logement (Th-BCE 2012 §11.6.3.2.2.1, T3 ~70 m²)
  { key: 'log-coll',   label: 'Logement collectif',        dRatio: 80,   dInterm: 0.80, dDuree: 2000, dHPointe: 3.0, dBesoin: 500, dNadeq: 2.45, dPuEcs: 2.0, dUnitEcs: 'kW/logt', dSource: 'Th-BCE 2012 §17.2',      dInfo: NADEQ_LOGT_INFO, m1Label: 'Nombre de logements', m1IsLogement: true,  m1IsSref: false },
  { key: 'log-rt2012', label: 'Logement RT2012',           dRatio: 40,   dInterm: 0.75, dDuree: 2000, dHPointe: 3.0, dBesoin: 500, dNadeq: 2.45, dPuEcs: 1.8, dUnitEcs: 'kW/logt', dSource: 'Th-BCE 2012 §17.2',      dInfo: NADEQ_LOGT_INFO, m1Label: 'Nombre de logements', m1IsLogement: true,  m1IsSref: false },
  { key: 'log-re2020', label: 'Logement RE2020',           dRatio: 30,   dInterm: 0.70, dDuree: 2000, dHPointe: 3.0, dBesoin: 392, dNadeq: 2.45, dPuEcs: 1.5, dUnitEcs: 'kW/logt', dSource: 'Th-BCE 2020 §11.6.3.2',  dInfo: NADEQ_LOGT_INFO, m1Label: 'Nombre de logements', m1IsLogement: true,  m1IsSref: false },
  { key: 'mixte',      label: 'Mixte logt + tertiaire',    dRatio: 60,   dInterm: 0.85, dDuree: 2000, dHPointe: 2.5, dBesoin: 500, dNadeq: 2.45, dPuEcs: 1.5, dUnitEcs: 'kW/logt', dSource: 'Th-BCE 2012 §17.2',      dInfo: NADEQ_LOGT_INFO, m1Label: 'Nombre de logements', m1IsLogement: true,  m1IsSref: false },
  // Tertiaire — dNadeq = 1 (unité = unité fonctionnelle directe)
  { key: 'tert-bureaux', label: 'Tertiaire — Bureaux',      dRatio: 40, dInterm: 0.65, dDuree: 1300, dHPointe: 1.0, dBesoin: 1.25, dNadeq: 1, dPuEcs: 0.05, dUnitEcs: 'kW/m²', dSource: 'Th-BCE 2012 §17.3',     dInfo: BUREAUX_INFO,      m1Label: 'Surface utile (m²)', m1IsLogement: false, m1IsSref: true  },
  { key: 'tert-enseign', label: 'Tertiaire — Enseignement', dRatio: 40, dInterm: 0.65, dDuree: 1000, dHPointe: 1.0, dBesoin: 0.2,  dNadeq: 1, dPuEcs: 0.03, dUnitEcs: 'kW/m²', dSource: 'Th-BCE 2012 §17.6-7-9', dInfo: ENSEIGNEMENT_INFO, m1Label: 'Surface utile (m²)', m1IsLogement: false, m1IsSref: true  },
  { key: 'tert-creche',  label: 'Tertiaire — Crèche',       dRatio: 55, dInterm: 0.75, dDuree: 1300, dHPointe: 2.0, dBesoin: 52.5, dNadeq: 1, dPuEcs: 0.5,  dUnitEcs: 'kW/lit', dSource: 'Th-BCE 2012 §17.5',     dInfo: CRECHE_INFO,       m1Label: 'Nombre de lits',     m1IsLogement: false, m1IsSref: false },
  { key: 'tert-foyer',     label: 'Tertiaire — Foyer / cité universitaire', dRatio: 50, dInterm: 0.75, dDuree: 1700, dHPointe: 2.0, dBesoin: 330,   dNadeq: 1, dPuEcs: 0.8,  dUnitEcs: 'kW/lit',     dSource: 'Th-BCE 2012 §17.13-14', dInfo: FOYER_INFO,  m1Label: 'Nombre de lits',     m1IsLogement: false, m1IsSref: false },
  { key: 'tert-hotel-01', label: 'Tertiaire — Hôtel 0-1*',           dRatio: 52, dInterm: 0.80, dDuree: 1700, dHPointe: 2.0, dBesoin: 420.6, dNadeq: 1, dPuEcs: 1.05, dUnitEcs: 'kW/chambre', dSource: 'Th-BCE 2012 §17.18',    dInfo: HOTEL_INFO, m1Label: 'Nombre de chambres', m1IsLogement: false, m1IsSref: false },
  { key: 'tert-hotel-2',  label: 'Tertiaire — Hôtel 2*',             dRatio: 52, dInterm: 0.80, dDuree: 1700, dHPointe: 2.0, dBesoin: 586.2, dNadeq: 1, dPuEcs: 1.46, dUnitEcs: 'kW/chambre', dSource: 'Th-BCE 2012 §17.19',    dInfo: HOTEL_INFO, m1Label: 'Nombre de chambres', m1IsLogement: false, m1IsSref: false },
  { key: 'tert-hotel-3',  label: 'Tertiaire — Hôtel 3*',             dRatio: 52, dInterm: 0.80, dDuree: 1700, dHPointe: 2.0, dBesoin: 655.2, dNadeq: 1, dPuEcs: 1.63, dUnitEcs: 'kW/chambre', dSource: 'Th-BCE 2012 §17.21',    dInfo: HOTEL_INFO, m1Label: 'Nombre de chambres', m1IsLogement: false, m1IsSref: false },
  { key: 'tert-hotel-45', label: 'Tertiaire — Hôtel 4-5*',           dRatio: 52, dInterm: 0.80, dDuree: 1700, dHPointe: 2.0, dBesoin: 902.7, dNadeq: 1, dPuEcs: 2.25, dUnitEcs: 'kW/chambre', dSource: 'Th-BCE 2012 §17.22',    dInfo: HOTEL_INFO, m1Label: 'Nombre de chambres', m1IsLogement: false, m1IsSref: false },
  { key: 'tert-resto-scolaire',  label: 'Tertiaire — Restauration scolaire',     dRatio: 40, dInterm: 0.65, dDuree: 1200, dHPointe: 2.0, dBesoin: 95,     dNadeq: 1, dPuEcs: 0.23, dUnitEcs: 'kW/repas/j', dSource: 'Th-BCE 2012 §17.29',            dInfo: RESTAU_SCOLAIRE_INFO,  m1Label: 'Nombre de repas/jour', m1IsLogement: false, m1IsSref: false },
  { key: 'tert-resto-commerce', label: 'Tertiaire — Restauration commerciale',  dRatio: 40, dInterm: 0.65, dDuree: 1200, dHPointe: 2.0, dBesoin: 357,    dNadeq: 1, dPuEcs: 0.87, dUnitEcs: 'kW/repas/j', dSource: 'Th-BCE 2012 §17.28',            dInfo: RESTAU_COMMERCE_INFO,  m1Label: 'Nombre de repas/jour', m1IsLogement: false, m1IsSref: false },
  { key: 'tert-sport',          label: 'Tertiaire — Sportif',                   dRatio: 37, dInterm: 0.60, dDuree: 1000, dHPointe: 1.5, dBesoin: 1806.0, dNadeq: 1, dPuEcs: 6,    dUnitEcs: 'kW/douche',   dSource: 'NF DTU 60.11 P1-1 §3.2.2 NOTE 1', dInfo: SPORTIF_INFO,          m1Label: 'Nombre de douches',    m1IsLogement: false, m1IsSref: false },
  { key: 'tert-ehpad',         label: 'Tertiaire — EHPAD / Maison de retraite', dRatio: 60, dInterm: 0.90, dDuree: 2000, dHPointe: 2.0, dBesoin: 600,   dNadeq: 1, dPuEcs: 1.49, dUnitEcs: 'kW/lit',    dSource: 'Th-BCE 2012 §17.10',               dInfo: EHPAD_INFO,            m1Label: 'Nombre de lits',       m1IsLogement: false, m1IsSref: false },
  { key: 'tert-hopital',       label: 'Tertiaire — Hôpital actif',              dRatio: 75, dInterm: 0.90, dDuree: 2000, dHPointe: 2.0, dBesoin: 820,   dNadeq: 1, dPuEcs: 2.04, dUnitEcs: 'kW/lit',    dSource: 'Th-BCE 2012 §17.16',               dInfo: HOPITAL_INFO,          m1Label: 'Nombre de lits',       m1IsLogement: false, m1IsSref: false },
  // Cas général — canevas vide, tous paramètres à null, surcharge manuelle obligatoire
  { key: 'autre',             label: 'Autre',                                  dRatio: null, dInterm: null, dDuree: null, dHPointe: null, dBesoin: null,  dNadeq: null, dPuEcs: null, dUnitEcs: 'kW/unité',   dSource: null, dInfo: AUTRE_INFO, m1Label: 'Quantité — à définir', m1IsLogement: false, m1IsSref: false },
];

// Correspondance typeBatiment (Module 1 value) → key HYP_BAT_TYPES
// Correspondance typeBatiment (Module 1) → clé HYP_BAT_TYPES
const BAT_LABEL_TO_KEY = {
  // Labels v2 (nouveaux types tertiaires détaillés)
  'Logement collectif':                     'log-coll',
  'Logement RT2012':                        'log-rt2012',
  'Logement RE2020':                        'log-re2020',
  'Mixte logt + tertiaire':                 'mixte',
  'Tertiaire — Bureaux':                    'tert-bureaux',
  'Tertiaire — Crèche':                    'tert-creche',
  'Tertiaire — Enseignement':               'tert-enseign',
  'Tertiaire — Foyer / cité universitaire': 'tert-foyer',
  'Tertiaire — Hôtel 0-1*':               'tert-hotel-01',
  'Tertiaire — Hôtel 2*':                 'tert-hotel-2',
  'Tertiaire — Hôtel 3*':                 'tert-hotel-3',
  'Tertiaire — Hôtel 4-5*':               'tert-hotel-45',
  'Tertiaire — Restauration scolaire':       'tert-resto-scolaire',
  'Tertiaire — Restauration commerciale':   'tert-resto-commerce',
  'Tertiaire — Sportif':                     'tert-sport',
  'Tertiaire — EHPAD / Maison de retraite': 'tert-ehpad',
  'Tertiaire — Hôpital actif':              'tert-hopital',
  'Autre':                                  'autre',
  // Rétrocompatibilité — anciens labels v1 encore en localStorage
  'Tertiaire bureaux':            'tert-bureaux',
  'Scolaire':                     'tert-enseign',
  'Mixte logement + tertiaire':   'mixte',
};

// ── Référentiel des types d'émetteurs avec valeurs par défaut ─────────────
// regule: true → disponible pour départs Régulés, false → départs Constants
const HYP_EMETTEUR_TYPES = [
  { key: 'radiateur',   label: 'Radiateur',           dTDep: 70, dDT: 20, regule: true  },
  { key: 'pc',          label: 'Plancher chauffant',  dTDep: 35, dDT: 10, regule: true  },
  { key: 'fcu',         label: 'FCU (ventilo-conv.)', dTDep: 45, dDT: 12, regule: true  },
  { key: 'cta-reg',     label: 'CTA régulée',         dTDep: 60, dDT: 20, regule: true  },
  { key: 'cta-bat',     label: 'CTA / Batterie',      dTDep: 60, dDT: 20, regule: false },
  { key: 'aerotherme',  label: 'Aérotherme',          dTDep: 70, dDT: 25, regule: false },
  { key: 'rideau',      label: "Rideau d'air",        dTDep: 70, dDT: 20, regule: false },
];

// Accesseur : renvoie { tDep, dT } fusionné override M0 + défaut codé en dur
function getHypoEmetteur(key) {
  const def = HYP_EMETTEUR_TYPES.find(t => t.key === key);
  if (!def) return null;
  const stored = ((window.hypotheses || {}).emetteurs || {})[key] || {};
  return {
    label: def.label,
    regule: def.regule,
    tDep: stored.tDep !== undefined && stored.tDep !== null ? stored.tDep : def.dTDep,
    dT:   stored.dT   !== undefined && stored.dT   !== null ? stored.dT   : def.dDT,
  };
}

// ── Table hypothèses par type d'émetteur ─────────────────────────────────
function renderHypEmetteursTable() {
  const container = document.getElementById('hyp-emetteurs-table-container');
  if (!container) return;
  const he = (window.hypotheses || {}).emetteurs || {};

  container.innerHTML = `<table class="hyp-bat-table">
    <thead>
      <tr>
        <th>Type d'émetteur</th>
        <th>T° départ (°C)</th>
        <th>ΔT émetteur (°C)</th>
      </tr>
    </thead>
    <tbody>
      ${HYP_EMETTEUR_TYPES.map(t => {
        const stored = he[t.key] || {};
        const sv = (col, def) => {
          const v = stored[col];
          return (v !== undefined && v !== null) ? v : (def ?? '');
        };
        return `<tr>
          <td class="hyp-bat-type-label">${t.label}</td>
          <td><input type="number" class="hyp-em-input" data-key="${t.key}" data-col="tDep"
               value="${sv('tDep', t.dTDep)}" placeholder="${t.dTDep}" min="0" step="1" /></td>
          <td><input type="number" class="hyp-em-input" data-key="${t.key}" data-col="dT"
               value="${sv('dT', t.dDT)}" placeholder="${t.dDT}" min="0" step="1" /></td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>`;
}

function lireHypEmetteurs() {
  const he = {};
  document.querySelectorAll('.hyp-em-input').forEach(el => {
    const key = el.dataset.key;
    const col = el.dataset.col;
    if (!key || !col) return;
    if (!he[key]) he[key] = {};
    const v = parseFloat(el.value);
    he[key][col] = isNaN(v) ? null : v;
  });
  return he;
}

// ── Initialisation ────────────────────────────────────────────────────────
// ── État transactionnel Module 0 ─────────────────────────────────────────
let _p0FormDirty = false;
let _p0Snapshot  = null;

function _p0TakeSnapshot() {
  _p0Snapshot = _p0BuildDataObject();
}

function _p0ResetDirty() {
  _p0FormDirty = false;
  const btn = document.getElementById('p0-btn-enregistrer');
  if (btn) btn.classList.remove('dirty');
}

function _p0RecomputeDirty() {
  if (!_p0Snapshot) { _p0ResetDirty(); return; }
  const current = _p0BuildDataObject();
  const isClean = JSON.stringify(current) === JSON.stringify(_p0Snapshot);
  _p0FormDirty = !isClean;
  const btn = document.getElementById('p0-btn-enregistrer');
  if (btn) btn.classList.toggle('dirty', !isClean);
}

function _p0ConfirmLeaveDirty() {
  if (!_p0FormDirty) return true;
  return window.confirm('Des modifications M0 non enregistrées seront perdues. Continuer ?');
}
window._p0ConfirmLeaveDirty = _p0ConfirmLeaveDirty;

function initHypotheses() {
  chargerHypothesesForm();
  document.getElementById('hyp-form').addEventListener('input', e => {
    if (e.target.id === 'hyp-t-dep-ecs' || e.target.id === 'hyp-t-ret-ecs') {
      majDeltaTEcs();
    }
    _p0RecomputeDirty();
  });

  document.getElementById('p0-btn-enregistrer')?.addEventListener('click', () => {
    sauvegarderHypotheses();
    // Cascade M0 → M2 : écrasement silencieux des modifs dirty M2 si présentes
    if (typeof p2SstRef !== 'undefined' && p2SstRef) {
      if (typeof renderBandeHypotheses === 'function') renderBandeHypotheses();
      if (typeof calculerResultats === 'function') calculerResultats();
    }
    if (typeof window._p2ResetDirty === 'function') window._p2ResetDirty();
    _p0TakeSnapshot();
    _p0ResetDirty();
    if (typeof afficherToast === 'function') afficherToast('Hypothèses enregistrées.');
  });

  document.getElementById('p0-btn-annuler')?.addEventListener('click', () => {
    if (!_p0FormDirty) return;
    if (!window.confirm('Annuler les modifications M0 ?')) return;
    if (_p0Snapshot && typeof window.hypotheses === 'object') {
      window.hypotheses = JSON.parse(JSON.stringify(_p0Snapshot));
    }
    chargerHypothesesForm();
    if (typeof afficherToast === 'function') afficherToast('Modifications annulées.');
  });

  window.addEventListener('beforeunload', e => {
    if (_p0FormDirty) { e.preventDefault(); e.returnValue = ''; }
  });
}

function majDeltaTEcs() {
  const dep = parseFloat(document.getElementById('hyp-t-dep-ecs')?.value);
  const ret = parseFloat(document.getElementById('hyp-t-ret-ecs')?.value);
  const calc = document.getElementById('hyp-dt-ecs-calc');
  if (!calc) return;
  if (!isNaN(dep) && !isNaN(ret)) {
    calc.value = dep - ret;
  } else {
    calc.value = '';
  }
}

// ── Calcul dérivé de la puissance unitaire ECS depuis le besoin Th-BCE ───────
// P [kW] = (besoin × Nadeq × 4,186 × ΔT) / (7 × hPointe × 3600)
// Source : Th-BCE 2020 §2.1.1 (392 L/adulte_éq/sem) et NF EN 12831-3 §B
function calculerPuEcsDerivee(def, stored, h) {
  const besoin  = (stored.besoin  !== undefined && stored.besoin  !== null) ? stored.besoin  : def.dBesoin;
  if (besoin == null) return def.dPuEcs ?? null;
  const hPointe = (stored.hPointe !== undefined && stored.hPointe !== null) ? stored.hPointe : def.dHPointe;
  const nadeq   = def.dNadeq ?? 1;
  const tPuis   = (h.tPuisageEcs   !== undefined && h.tPuisageEcs   !== null) ? h.tPuisageEcs   : 40;
  const tEF     = (h.tempEauFroideEcs !== undefined && h.tempEauFroideEcs !== null) ? h.tempEauFroideEcs : 10;
  const dT      = tPuis - tEF;
  if (dT <= 0 || hPointe <= 0) return def.dPuEcs ?? null;
  return (besoin * nadeq * 4.186 * dT) / (7 * hPointe * 3600);
}

// ── Table hypothèses par type de bâtiment ─────────────────────────────────
function renderHypBatTable() {
  const container = document.getElementById('hyp-bat-table-container');
  if (!container) return;
  const hb = (window.hypotheses || {}).hypBatiments || {};
  const h  = window.hypotheses || {};

  const UNIT_BESOIN = {
    'kW/logt':    'L/sem/adulte_éq',
    'kW/m²':      'L/sem/m²',
    'kW/lit':     'L/sem/lit',
    'kW/chambre': 'L/sem/chambre',
    'kW/douche':  'L/sem/douche',
    'kW/repas/j': 'L/sem/repas',
    'kW/unité':   'L/sem/unité',
  };

  const fmtPuEcs = (val) => {
    if (val == null) return '—';
    return val < 0.1 ? val.toFixed(3) : val.toFixed(2);
  };

  container.innerHTML = `<table class="hyp-bat-table">
    <thead>
      <tr>
        <th>Type de bâtiment</th>
        <th>Ratio W/m²</th>
        <th>Intermittence</th>
        <th>Durée h/an</th>
        <th>H. pointe ECS (h/j)</th>
        <th>Besoin a</th>
        <th>Unité Th-BCE</th>
        <th>Source</th>
        <th>Puissance unitaire ECS</th>
        <th>Unité ECS</th>
      </tr>
    </thead>
    <tbody>
      ${HYP_BAT_GROUPS.map(group => {
        const rows = group.keys.map(key => {
          const t = HYP_BAT_TYPES.find(bt => bt.key === key);
          if (!t) return '';
          const stored = hb[t.key] || {};
          const sv = (col, def) => {
            const v = stored[col];
            return (v !== undefined && v !== null) ? v : (def ?? '');
          };
          const puCalc = calculerPuEcsDerivee(t, stored, h);
          const unitBesoin = UNIT_BESOIN[t.dUnitEcs] || '—';
          return `<tr>
            <td class="hyp-bat-type-label">${t.label}${t.dInfo ? `<span class="help-badge">ℹ</span><div class="help-content">${t.dInfo}</div>` : ''}</td>
            <td><input type="number" class="hyp-bat-input" data-key="${t.key}" data-col="ratio"
                 value="${sv('ratio', t.dRatio)}" placeholder="${t.dRatio ?? '—'}" min="0" step="1" /></td>
            <td><input type="number" class="hyp-bat-input" data-key="${t.key}" data-col="interm"
                 value="${sv('interm', t.dInterm)}" placeholder="${t.dInterm ?? '—'}" min="0" max="1" step="0.05" /></td>
            <td><input type="number" class="hyp-bat-input" data-key="${t.key}" data-col="duree"
                 value="${sv('duree', t.dDuree)}" placeholder="${t.dDuree ?? '—'}" min="0" step="100" /></td>
            <td><input type="number" class="hyp-bat-input" data-key="${t.key}" data-col="hPointe"
                 value="${sv('hPointe', t.dHPointe)}" placeholder="${t.dHPointe ?? '—'}" min="0" step="0.5" /></td>
            <td><input type="number" class="hyp-bat-input" data-key="${t.key}" data-col="besoin"
                 value="${sv('besoin', t.dBesoin)}" placeholder="${t.dBesoin ?? '—'}" min="0" step="any" /></td>
            <td class="hyp-bat-unit-label">${unitBesoin}</td>
            <td class="hyp-bat-source">${t.dSource || '—'}</td>
            <td class="hyp-bat-calc-cell" data-calc-key="${t.key}">${t.m1IsLogement ? '—' : fmtPuEcs(puCalc)}</td>
            <td class="hyp-bat-unit-label">${t.dUnitEcs}</td>
          </tr>`;
        }).join('');
        return `<tr class="hyp-bat-group-row"><td colspan="10">${group.label}</td></tr>${rows}`;
      }).join('')}
    </tbody>
  </table>`;
}

// Met à jour uniquement les cellules de puissance calculée sans reconstruire la table
function updateHypBatCalcCells() {
  const hb = (window.hypotheses || {}).hypBatiments || {};
  const h  = window.hypotheses || {};
  const fmtPuEcs = (val) => val == null ? '—' : val < 0.1 ? val.toFixed(3) : val.toFixed(2);
  document.querySelectorAll('.hyp-bat-calc-cell[data-calc-key]').forEach(td => {
    const key = td.dataset.calcKey;
    const def = HYP_BAT_TYPES.find(t => t.key === key);
    if (!def) return;
    td.textContent = def.m1IsLogement ? '—' : fmtPuEcs(calculerPuEcsDerivee(def, hb[key] || {}, h));
  });
}

// ── Accesseur public — utilisable par puissance.js et autres modules ────────
function getHypoBatiment(typeBatiment) {
  if (!typeBatiment) return null;
  // Type inconnu (ex. ancienne SST non migrée) → repli sur Logement collectif
  const key = BAT_LABEL_TO_KEY[typeBatiment] || 'log-coll';
  const def = HYP_BAT_TYPES.find(t => t.key === key);
  if (!def) return null;
  const stored = ((window.hypotheses || {}).hypBatiments || {})[key] || {};
  return {
    ratio:   stored.ratio   !== undefined ? stored.ratio   : def.dRatio,
    interm:  stored.interm  !== undefined ? stored.interm  : def.dInterm,
    duree:   stored.duree   !== undefined ? stored.duree   : def.dDuree,
    hPointe: stored.hPointe !== undefined ? stored.hPointe : def.dHPointe,
    puEcs:   calculerPuEcsDerivee(def, stored, window.hypotheses || {}),
    unitEcs: def.dUnitEcs,
  };
}

// ── Remplir le formulaire depuis window.hypotheses ────────────────────────
function chargerHypothesesForm() {
  const h  = window.hypotheses || {};
  const sv = (id, v, def = '') => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = (v !== null && v !== undefined && v !== '') ? v : def;
  };
  sv('hyp-rch-dep-hiver', h.rchDepHiver);
  sv('hyp-rch-dep-ete',   h.rchDepEte);
  sv('hyp-station',       h.stationMeteo);
  sv('hyp-dju-ref',       h.djuRef);
  sv('hyp-dju-n1', h.djuN1); sv('hyp-dju-n2', h.djuN2); sv('hyp-dju-n3', h.djuN3);
  sv('hyp-dju-n4', h.djuN4); sv('hyp-dju-n5', h.djuN5);
  sv('hyp-t-ext-base',    h.tExtBase,     -7);
  sv('hyp-t-coupure',     h.tCoupure,     18);
  sv('hyp-pincement-ch',  h.pincementCh, 2);
  sv('hyp-pincement-ecs', h.pincementEcs !== undefined ? h.pincementEcs : 10, 10);
  sv('hyp-t-ret-bouclage-ecs', h.tRetBouclageEcs !== undefined ? h.tRetBouclageEcs : 53, 53);
  sv('hyp-t-puisage-ecs', h.tPuisageEcs !== undefined ? h.tPuisageEcs : 40, 40);
  sv('hyp-t-eau-froide-ecs', h.tempEauFroideEcs !== undefined ? h.tempEauFroideEcs : 10, 10);
  sv('hyp-ecs-taux-bouclage', h.ecsTauxBouclage !== undefined ? h.ecsTauxBouclage : 20, 20);
  // Backward compat: migrate dtEcs → tDepEcs/tRetEcs
  if (h.tDepEcs == null && h.tRetEcs == null && h.dtEcs != null) {
    sv('hyp-t-dep-ecs', 60);
    sv('hyp-t-ret-ecs', 60 - h.dtEcs);
  } else {
    sv('hyp-t-dep-ecs', h.tDepEcs, 60);
    sv('hyp-t-ret-ecs', h.tRetEcs, 38);
  }
  sv('hyp-pcs-gaz',   h.pcsGaz,   11.2);
  sv('hyp-pci-fioul', h.pciFioul, 10);
  majDeltaTEcs();
  updateHypEcsVisibility();
  renderHypBatTable();
  renderHypEmetteursTable();
  _p0TakeSnapshot();
  _p0ResetDirty();
}

// ── Construire l'objet hypotheses depuis le DOM (sans persistance) ────────
function _p0BuildDataObject() {
  const g = id => {
    const el = document.getElementById(id);
    if (!el || el.value === '') return null;
    const v = parseFloat(el.value);
    return isNaN(v) ? null : v;
  };
  const s = id => document.getElementById(id)?.value.trim() || '';
  // rchRetHiver/rchRetEte : plus de champ de saisie M0 (calculés en M2/M3) —
  // on préserve la valeur déjà stockée plutôt que de l'écraser à chaque enregistrement M0.
  const hPrev = window.hypotheses || {};

  return {
    rchDepHiver:      g('hyp-rch-dep-hiver'), rchRetHiver: hPrev.rchRetHiver ?? null,
    rchDepEte:        g('hyp-rch-dep-ete'),   rchRetEte:   hPrev.rchRetEte   ?? null,
    stationMeteo:     s('hyp-station'),
    djuRef:           g('hyp-dju-ref'),
    djuN1: g('hyp-dju-n1'), djuN2: g('hyp-dju-n2'), djuN3: g('hyp-dju-n3'),
    djuN4: g('hyp-dju-n4'), djuN5: g('hyp-dju-n5'),
    tExtBase:         g('hyp-t-ext-base')    ?? -7,
    tCoupure:         g('hyp-t-coupure')     ?? 18,
    pincementCh:      g('hyp-pincement-ch')  ??  2,
    pincementEcs:     g('hyp-pincement-ecs')       ?? 10,
    tDepEcs:          g('hyp-t-dep-ecs')           ?? 60,
    tRetEcs:          g('hyp-t-ret-ecs')           ?? 38,
    tRetBouclageEcs:  g('hyp-t-ret-bouclage-ecs')  ?? 53,
    tPuisageEcs:      g('hyp-t-puisage-ecs')       ?? 40,
    tempEauFroideEcs: g('hyp-t-eau-froide-ecs')    ?? 10,
    ecsTauxBouclage:  g('hyp-ecs-taux-bouclage')   ?? 20,
    hypBatiments:     lireHypBatiments(),
    emetteurs:        lireHypEmetteurs(),
    pcsGaz:           g('hyp-pcs-gaz')   ?? 11.2,
    pciFioul:         g('hyp-pci-fioul') ?? 10,
  };
}

// ── Lire le formulaire et sauvegarder ─────────────────────────────────────
function sauvegarderHypotheses() {
  window.hypotheses = _p0BuildDataObject();
  saveCurrentProjectData();
  updateHypBatCalcCells();
}

// ── Lire la table hypBatiments depuis le DOM ──────────────────────────────
function lireHypBatiments() {
  const hb = {};
  document.querySelectorAll('.hyp-bat-input').forEach(el => {
    const key = el.dataset.key;
    const col = el.dataset.col;
    if (!key || !col) return;
    if (!hb[key]) hb[key] = {};
    const v = parseFloat(el.value);
    hb[key][col] = isNaN(v) ? null : v;
  });
  return hb;
}

// ── Accesseur rapide (utilisé par puissance.js) ────────────────────────────
function getHypo(key, defaut = null) {
  const val = (window.hypotheses || {})[key];
  return (val !== null && val !== undefined && val !== '') ? val : defaut;
}

// ── Affichage conditionnel section ECS du Module 0 ───────────────────────
// Masque la carte ECS si aucune SST n'a un type ECS ou CH+ECS
function updateHypEcsVisibility() {
  const card = document.getElementById('hyp-ecs-card');
  if (!card) return;
  card.style.display = '';
}

// Accordéon badge aide — délégation globale
// Note CALDA : conteneur de champ ".field" (FLUX utilisait ".form-group")
document.addEventListener('click', function(e) {
  const badge = e.target.closest('.help-badge');
  if (!badge) return;
  const group = badge.closest('.field') || badge.closest('td') || badge.closest('.form-section-title') || badge.parentElement;
  const content = group && group.querySelector('.help-content');
  if (!content) return;
  document.querySelectorAll('.help-content.open').forEach(el => {
    if (el !== content) el.classList.remove('open');
  });
  content.classList.toggle('open');
});
