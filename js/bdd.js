// ── Module 1 : Référentiel sous-stations ──────────────────────────────────
//
// Responsabilités :
//   - CRUD sur la liste des SST (sousStations[])
//   - Rendu du tableau #sst-tbody
//   - Gestion du formulaire structuré en 5 sections
//
// Données partagées :
//   window.sousStations — tableau des objets SST, lu/écrit par export.js
//
// Structure d'une SST :
//   Identification : ref, type, typeSst, moa, nature, statut, batiments
//   Localisation   : adresse, cp, ville
//   Caractéristiques: nbLogements, sref, typeBatiment, overrides{ratio,interm,duree,hPointe,puEcs}
//   Contact        : contact, telephone, email
//   Divers         : remarques
// ─────────────────────────────────────────────────────────────────────────

window.sousStations   = [];
window.etatAffichage  = 'existant'; // 'existant' | 'projete' — pilote tableau M1 et M2
window.tableauTri     = null;      // null | { colonne: string, sens: 'asc'|'desc' }
window.tableauFiltres = {};        // { colonne: filtre } — non persisté

// Libellés EXACTS comme dans le <thead> — utilisés par _majEntetesTableau
const COLONNES_TABLEAU = [
  { key: 'ref',          libelle: 'Référence',     filtre: 'texte' },
  { key: 'typeSST',      libelle: 'Type de SST',   filtre: 'enum' },
  { key: 'typeService',  libelle: 'Type',           filtre: 'enum' },
  { key: 'typeBatiment', libelle: 'Type bâtiment',  filtre: 'enum' },
  { key: 'sref',         libelle: 'Sref (m²)',      filtre: 'numerique' },
  { key: 'nbLogements',  libelle: 'Logements',      filtre: 'numerique' },
  { key: 'nature',       libelle: 'Nature',         filtre: 'enum' },
  { key: 'pCh',         libelle: 'P Ut. CH (kW)',    filtre: 'numerique' },
  { key: 'pEcs',        libelle: 'P Ut. ECS (kW)',   filtre: 'numerique' },
  { key: 'pTotal',       libelle: 'P Ut. totale (kW)', filtre: 'numerique' },
];

// ── Nature calculée automatiquement ──────────────────────────────────────────
// Règle : Existant seul → 'Existant' ; Projeté seul → 'Neuf' ;
//         les deux : Gaz/Fioul existant → 'Raccordement', sinon → 'Rénovation'.
function calculerNature(sst) {
  const hasE = !!sst.hasExistant;
  const hasP = !!sst.hasProjete;
  if (hasE && !hasP) return 'Existant';
  if (!hasE && hasP) return 'Neuf';
  if (hasE && hasP) {
    const e = sst.existant?.energieActuelle;
    if (e === 'Gaz' || e === 'Fioul') return 'Raccordement';
    return 'Rénovation';
  }
  return 'Existant'; // cas dégénéré
}
window.calculerNature = calculerNature;

let editIndex  = -1;
let _moduleAvantEdition = null;
let _formDirty  = false;
let _m1Snapshot = null;

function _resetDirty() {
  _formDirty = false;
  const btn = document.getElementById('btn-valider-sst');
  if (btn) btn.classList.remove('dirty');
}

// ── Snapshot diff M1 ─────────────────────────────────────────────────────

function _m1BuildFormObject() {
  const gNum = id => { const v = parseFloat(document.getElementById(id)?.value); return isNaN(v) ? null : v; };
  const gInt = id => { const v = parseInt(document.getElementById(id)?.value);   return isNaN(v) ? null : v; };
  const ref = document.getElementById('sst-ref')?.value.trim() || '';
  const cp  = document.getElementById('sst-cp')?.value.trim()  || '';

  const hasExistant = document.getElementById('sst-etat-fields-existant')?.style.display !== 'none';
  const hasProjete  = document.getElementById('sst-etat-fields-projete')?.style.display  !== 'none';

  let existant = null;
  if (hasExistant) {
    existant = {
      typeService:     document.getElementById('sst-type--existant')?.value             || '',
      typeSST:         document.getElementById('sst-type-sst--existant')?.value         || '',
      energieActuelle: document.getElementById('sst-energie-actuelle--existant')?.value || '',
      typeBatiment:    document.getElementById('sst-type-batiment--existant')?.value    || '',
      nbLogements:     gInt('sst-nb-logements--existant'),
      sref:            gNum('sst-sref--existant'),
      overrides: {
        ratio:   gNum('sst-ovr-ratio--existant'),
        interm:  gNum('sst-ovr-interm--existant'),
        duree:   gNum('sst-ovr-duree--existant'),
        hPointe: gNum('sst-ovr-hPointe--existant'),
        puEcs:   gNum('sst-ovr-puEcs--existant'),
      },
    };
  }

  let projete = null;
  if (hasProjete) {
    projete = {
      typeService:  document.getElementById('sst-type--projete')?.value      || '',
      typeSST:      document.getElementById('sst-type-sst--projete')?.value  || '',
      typeBatiment: document.getElementById('sst-type-batiment--projete')?.value || '',
      nbLogements:  gInt('sst-nb-logements--projete'),
      sref:         gNum('sst-sref--projete'),
      overrides: {
        ratio:   gNum('sst-ovr-ratio--projete'),
        interm:  gNum('sst-ovr-interm--projete'),
        duree:   gNum('sst-ovr-duree--projete'),
        hPointe: gNum('sst-ovr-hPointe--projete'),
        puEcs:   gNum('sst-ovr-puEcs--projete'),
      },
    };
  }

  return {
    ref,
    moa:       document.getElementById('sst-moa')?.value.trim()       || '',
    nature:    calculerNature({ hasExistant, hasProjete, existant }),
    batiments: document.getElementById('sst-batiments')?.value.trim() || '',
    adresse:   document.getElementById('sst-adresse')?.value.trim()   || '',
    cp,
    ville:     document.getElementById('sst-ville')?.value.trim()     || '',
    latitude:  parseFloat(document.getElementById('sst-latitude')?.value)  || null,
    longitude: parseFloat(document.getElementById('sst-longitude')?.value) || null,
    contact:   document.getElementById('sst-contact')?.value.trim()   || '',
    telephone: document.getElementById('sst-telephone')?.value.trim() || '',
    email:     document.getElementById('sst-email')?.value.trim()     || '',
    remarques: document.getElementById('sst-remarques')?.value.trim() || '',
    hasExistant,
    hasProjete,
    existant,
    projete,
  };
}

function _m1TakeSnapshot() {
  _m1Snapshot = _m1BuildFormObject();
}

function markDirty() {
  const formCard = document.getElementById('form-sst-card');
  if (!formCard || formCard.style.display === 'none') return;
  if (!_m1Snapshot) {
    _formDirty = true;
    const btn = document.getElementById('btn-valider-sst');
    if (btn) btn.classList.add('dirty');
    return;
  }
  const current = _m1BuildFormObject();
  const isClean = JSON.stringify(current) === JSON.stringify(_m1Snapshot);
  _formDirty = !isClean;
  const btn = document.getElementById('btn-valider-sst');
  if (btn) btn.classList.toggle('dirty', !isClean);
}

function _confirmLeaveDirty() {
  if (!_formDirty) return true;
  const formCard = document.getElementById('form-sst-card');
  if (!formCard || formCard.style.display === 'none') return true;
  const confirmed = window.confirm('Vous avez des modifications non enregistrées. Quitter quand même ?');
  if (confirmed) {
    _moduleAvantEdition = null; // court-circuiter le retour automatique dans fermerFormulaire
    fermerFormulaire();
  }
  return confirmed;
}

// IDs des champs communs du formulaire (champs état gérés par reinitialiserEtatTabs)
const CHAMPS = [
  'sst-ref', 'sst-moa', 'sst-batiments',
  'sst-adresse', 'sst-cp', 'sst-ville', 'sst-latitude', 'sst-longitude',
  'sst-contact', 'sst-telephone', 'sst-email',
  'sst-remarques',
];

// ── Initialisation ───────────────────────────────────────────────────────
function initBDD() {
  document.getElementById('btn-nouvelle-sst').addEventListener('click', ouvrirFormulaireNouveau);
  ['existant', 'projete'].forEach(etat => {
    document.getElementById('sst-type-batiment--' + etat)
      ?.addEventListener('change', () => majOverridePlaceholders(etat));
  });
  document.querySelectorAll('.tableau-toggle .p2-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => setEtatAffichage(btn.dataset.etat));
  });
  document.getElementById('btn-reset-filtres')?.addEventListener('click', () => resetFiltres());

  // Délégation : click sur en-tête → tri / ouverture dropdown filtre
  const thead = document.querySelector('table.sst-table thead');
  if (thead) thead.addEventListener('click', e => {
    const btn = e.target.closest('.th-filtre-btn');
    if (btn) {
      e.stopPropagation();
      _ouvrirDropdown(btn.dataset.colKey, btn.dataset.filtreType, btn);
      return;
    }
    const th = e.target.closest('th[data-col-key]');
    if (!th) return;
    const key = th.dataset.colKey;
    const tri = window.tableauTri;
    if (!tri || tri.colonne !== key) setTableauTri(key, 'asc');
    else if (tri.sens === 'asc')     setTableauTri(key, 'desc');
    else                              setTableauTri(null, null);
  });

  // Singleton dropdown (injecté une seule fois dans body)
  if (!document.getElementById('filtre-dropdown')) {
    const dd = document.createElement('div');
    dd.id = 'filtre-dropdown';
    dd.style.display = 'none';
    document.body.appendChild(dd);
  }

  document.getElementById('btn-valider-sst').addEventListener('click', validerFormulaire);
  document.getElementById('btn-annuler-sst').addEventListener('click', fermerFormulaire);

  const formCard = document.getElementById('form-sst-card');
  if (formCard) {
    formCard.addEventListener('change', markDirty);
    formCard.addEventListener('input',  markDirty);

    window.addEventListener('beforeunload', e => {
      if (_formDirty && formCard.style.display !== 'none') {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  initSstEtatTabs();
  rendreTableau();
}

// ── Toggle Existant / Projeté ─────────────────────────────────────────────

function _chargerEtatAffichage() {
  const id = window.currentProjectId;
  const saved = id ? localStorage.getItem('flux_etatAffichage_' + id) : null;
  window.etatAffichage = (saved === 'existant' || saved === 'projete') ? saved : 'existant';
  _majToggleUI();
}

function _majToggleUI() {
  const etat = window.etatAffichage || 'projete';
  document.querySelectorAll('.tableau-toggle .p2-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.etat === etat);
  });
}

function setEtatAffichage(etat) {
  window.etatAffichage = etat;
  const id = window.currentProjectId;
  if (id) localStorage.setItem('flux_etatAffichage_' + id, etat);
  fermerDropdown();
  _majToggleUI();
  rendreTableau();
  if (typeof _syncM2ApresBascule === 'function') _syncM2ApresBascule();
}

// ── Tri (persisté par projet) + filtres (non persistés) ──────────────────

function _chargerTri() {
  if (!window.currentProjectId) return;
  try {
    const raw = localStorage.getItem('flux_tableauTri_' + window.currentProjectId);
    window.tableauTri = raw ? JSON.parse(raw) : null;
  } catch { window.tableauTri = null; }
}

function _sauverTri() {
  if (!window.currentProjectId) return;
  const key = 'flux_tableauTri_' + window.currentProjectId;
  if (window.tableauTri) localStorage.setItem(key, JSON.stringify(window.tableauTri));
  else localStorage.removeItem(key);
}

function setTableauTri(colonne, sens) {
  window.tableauTri = (colonne && sens) ? { colonne, sens } : null;
  _sauverTri();
  rendreTableau();
}

function resetFiltres() {
  window.tableauFiltres = {};
  window.tableauTri = null;
  _sauverTri();
  rendreTableau();
}

window._chargerTri   = _chargerTri;
window.setTableauTri = setTableauTri;
window.resetFiltres  = resetFiltres;

// ── Formulaire ───────────────────────────────────────────────────────────
function ouvrirFormulaireNouveau() {
  editIndex = -1;
  document.getElementById('form-sst-title').textContent = 'Nouvelle sous-station';
  viderFormulaire();
  _m1TakeSnapshot();
  _resetDirty();
  document.getElementById('form-sst-card').style.display = 'block';
  document.getElementById('sst-ref').focus();
}

function ouvrirFormulaireEdition(index) {
  editIndex = index;
  const s = sousStations[index];
  document.getElementById('form-sst-title').textContent = 'Modifier ' + s.ref;

  // ── Champs communs identité ───────────────────────────────────────────
  const setC = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
  setC('sst-ref',           s.ref);
  setC('sst-moa',           s.moa);
  setC('sst-batiments',     s.batiments);
  setC('sst-adresse',       s.adresse);
  setC('sst-cp',            s.cp);
  setC('sst-ville',         s.ville);
  setC('sst-latitude',      s.latitude);
  setC('sst-longitude',     s.longitude);
  setC('sst-contact',       s.contact);
  setC('sst-telephone',     s.telephone);
  setC('sst-email',         s.email);
  setC('sst-remarques',     s.remarques);
  majOverridePlaceholders('existant');
  majOverridePlaceholders('projete');

  // ── Réinitialiser les onglets avant de charger les états ─────────────
  reinitialiserEtatTabs();

  // ── État Existant ─────────────────────────────────────────────────────
  if (s.hasExistant && s.existant) {
    _montrerEtat('existant');
    const ex  = s.existant;
    const ovr = ex.overrides || {};
    setC('sst-type--existant',             ex.typeService);
    setC('sst-type-sst--existant',         ex.typeSST);
    setC('sst-energie-actuelle--existant', ex.energieActuelle);
    setC('sst-type-batiment--existant',    ex.typeBatiment);
    setC('sst-nb-logements--existant',     ex.nbLogements);
    setC('sst-sref--existant',             ex.sref);
    setC('sst-ovr-ratio--existant',        ovr.ratio);
    setC('sst-ovr-interm--existant',       ovr.interm);
    setC('sst-ovr-duree--existant',        ovr.duree);
    setC('sst-ovr-hPointe--existant',      ovr.hPointe);
    setC('sst-ovr-puEcs--existant',        ovr.puEcs);
    updateNbLogementsVisibility('existant');
  } else {
    _cacherEtat('existant');
  }

  // ── État Projeté ──────────────────────────────────────────────────────
  if (s.hasProjete && s.projete) {
    _montrerEtat('projete');
    const pr  = s.projete;
    const ovr = pr.overrides || {};
    setC('sst-type--projete',          pr.typeService);
    setC('sst-type-sst--projete',      pr.typeSST);
    setC('sst-type-batiment--projete', pr.typeBatiment);
    setC('sst-nb-logements--projete',  pr.nbLogements);
    setC('sst-sref--projete',          pr.sref);
    setC('sst-ovr-ratio--projete',     ovr.ratio);
    setC('sst-ovr-interm--projete',    ovr.interm);
    setC('sst-ovr-duree--projete',     ovr.duree);
    setC('sst-ovr-hPointe--projete',   ovr.hPointe);
    setC('sst-ovr-puEcs--projete',     ovr.puEcs);
    updateNbLogementsVisibility('projete');
  }
  // Si !hasProjete : Projeté reste désactivé depuis reinitialiserEtatTabs

  // ── Onglet actif : suit window.etatAffichage avec fallback sur l'état disponible ──
  const _etatCible   = window.etatAffichage || 'projete';
  const _etatExiste  = _etatCible === 'existant' ? s.hasExistant : s.hasProjete;
  const _etatEffectif = _etatExiste ? _etatCible : (s.hasExistant ? 'existant' : 'projete');
  setEtatActif(_etatEffectif);

  // ── Boutons Supprimer : visibles indépendamment pour chaque état actif ───
  const suppE = document.getElementById('sst-supprimer-existant');
  const suppP = document.getElementById('sst-supprimer-projete');
  if (suppE) suppE.style.display = s.hasExistant ? '' : 'none';
  if (suppP) suppP.style.display = s.hasProjete  ? '' : 'none';

  _m1TakeSnapshot();
  _resetDirty();
  document.getElementById('form-sst-card').style.display = 'block';
  document.getElementById('sst-ref').focus();
}

function fermerFormulaire() {
  _resetDirty();
  _m1Snapshot = null;
  document.getElementById('form-sst-card').style.display = 'none';
  clearAllErrors(document.getElementById('form-sst-card'));
  viderFormulaire();
  editIndex = -1;
  const _retourAnnul = _moduleAvantEdition;
  _moduleAvantEdition = null;
  if (_retourAnnul && _retourAnnul !== 'bdd' && typeof allerOnglet === 'function') {
    allerOnglet(_retourAnnul);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function viderFormulaire() {
  CHAMPS.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  reinitialiserEtatTabs();
}

function _majIndicateurOnglets() {
  for (const etat of ['existant', 'projete']) {
    const fields = document.getElementById('sst-etat-fields-' + etat);
    const tab    = document.getElementById('sst-etat-tab-'    + etat);
    if (tab) tab.classList.toggle('tab-en-erreur', !!fields?.querySelector('.field-error'));
  }
}

function validerFormulaire() {
  const formCard = document.getElementById('form-sst-card');
  clearAllErrors(formCard);
  _majIndicateurOnglets();

  // ── Champs communs ────────────────────────────────────────────────────
  const ref = document.getElementById('sst-ref').value.trim();
  if (!ref) setFieldError('sst-ref', 'La référence SST est obligatoire.');
  if (ref) {
    const doublon = sousStations.findIndex((s, i) => s.ref === ref && i !== editIndex);
    if (doublon !== -1) setFieldError('sst-ref', 'Cette référence SST existe déjà.');
  }

  const chk = (id, fn, msg, isInt) => {
    const s = document.getElementById(id)?.value.trim();
    if (!s) return;
    const v = isInt ? parseInt(s, 10) : parseFloat(s);
    if (isNaN(v) || fn(v)) setFieldError(id, msg);
  };
  chk('sst-latitude',    v => v < 41.3 || v > 51.1, 'Latitude hors France métropolitaine (attendu : 41,3 à 51,1).');
  chk('sst-longitude',   v => v < -5.2 || v > 9.6,  'Longitude hors France métropolitaine (attendu : -5,2 à 9,6).');
  // nbLogements et sref validés par état dans chkCarac ci-dessous
  const cp = document.getElementById('sst-cp').value.trim();
  if (cp && !/^\d{5}$/.test(cp)) setFieldError('sst-cp', 'Le code postal doit contenir 5 chiffres.');
  const emailEl = document.getElementById('sst-email');
  if (emailEl.value.trim() && !emailEl.checkValidity()) setFieldError('sst-email', 'L\'adresse email n\'est pas valide.');

  // ── Détection des états activés ───────────────────────────────────────
  const hasExistant = document.getElementById('sst-etat-fields-existant')?.style.display !== 'none';
  const hasProjete  = document.getElementById('sst-etat-fields-projete')?.style.display  !== 'none';

  if (!hasExistant && !hasProjete) {
    _montrerEtat('existant');
    setEtatActif('existant');
    setFieldError('sst-type--existant', 'Au moins un état doit être renseigné.');
  }

  // ── Lecture et validation des blocs état ──────────────────────────────
  const gNum  = id => { const v = parseFloat(document.getElementById(id)?.value); return isNaN(v) ? null : v; };
  const gInt  = id => { const v = parseInt(document.getElementById(id)?.value);   return isNaN(v) ? null : v; };
  const chkCarac = etat => {
    const nb = gInt(`sst-nb-logements--${etat}`);
    if (nb !== null && nb < 1) setFieldError(`sst-nb-logements--${etat}`, 'Nombre de logements : entier ≥ 1.');
    const sref = gNum(`sst-sref--${etat}`);
    if (sref !== null && (sref <= 0 || sref >= 200000)) setFieldError(`sst-sref--${etat}`, 'Surface : doit être comprise entre 0 et 200 000 m².');
  };
  const chkOvr = etat => {
    chk(`sst-ovr-ratio--${etat}`,   v => v <= 0 || v > 300,   'Ratio W/m² : doit être dans ]0 ; 300].');
    chk(`sst-ovr-interm--${etat}`,  v => v < 0  || v > 1,     'Taux d\'intermittence : doit être dans [0 ; 1].');
    chk(`sst-ovr-duree--${etat}`,   v => v < 100 || v > 8760, 'Durée de fonctionnement : doit être dans [100 ; 8 760] h/an.');
    chk(`sst-ovr-hPointe--${etat}`, v => v <= 0 || v > 24,    'Durée de pointe ECS : doit être dans ]0 ; 24] h/j.');
    chk(`sst-ovr-puEcs--${etat}`,   v => v <= 0,              'Puissance unitaire ECS : doit être > 0.');
  };

  let existant = null;
  if (hasExistant) {
    const typeService = document.getElementById('sst-type--existant')?.value || '';
    if (!typeService) setFieldError('sst-type--existant', 'Le type de service est obligatoire.');
    chkCarac('existant');
    chkOvr('existant');
    existant = {
      typeService,
      typeSST:         document.getElementById('sst-type-sst--existant')?.value         || '',
      energieActuelle: document.getElementById('sst-energie-actuelle--existant')?.value || '',
      typeBatiment:    document.getElementById('sst-type-batiment--existant')?.value    || '',
      nbLogements:     gInt('sst-nb-logements--existant'),
      sref:            gNum('sst-sref--existant'),
      overrides: {
        ratio:   gNum('sst-ovr-ratio--existant'),
        interm:  gNum('sst-ovr-interm--existant'),
        duree:   gNum('sst-ovr-duree--existant'),
        hPointe: gNum('sst-ovr-hPointe--existant'),
        puEcs:   gNum('sst-ovr-puEcs--existant'),
      },
    };
  }

  let projete = null;
  if (hasProjete) {
    const typeService = document.getElementById('sst-type--projete')?.value || '';
    if (!typeService) setFieldError('sst-type--projete', 'Le type de service est obligatoire.');
    chkCarac('projete');
    chkOvr('projete');
    projete = {
      typeService,
      typeSST:      document.getElementById('sst-type-sst--projete')?.value     || '',
      typeBatiment: document.getElementById('sst-type-batiment--projete')?.value || '',
      nbLogements:  gInt('sst-nb-logements--projete'),
      sref:         gNum('sst-sref--projete'),
      overrides: {
        ratio:   gNum('sst-ovr-ratio--projete'),
        interm:  gNum('sst-ovr-interm--projete'),
        duree:   gNum('sst-ovr-duree--projete'),
        hPointe: gNum('sst-ovr-hPointe--projete'),
        puEcs:   gNum('sst-ovr-puEcs--projete'),
      },
    };
  }

  // ── Si erreurs : basculer vers le premier onglet en erreur ────────────
  if (formCard.querySelector('.field-error')) {
    for (const etat of ['existant', 'projete']) {
      const fieldsEl = document.getElementById('sst-etat-fields-' + etat);
      if (fieldsEl?.querySelector('.field-error')) { setEtatActif(etat); break; }
    }
    focusFirstError(formCard);
    _majIndicateurOnglets();
    return;
  }

  // ── Construction de la SST finale ─────────────────────────────────────
  const sst = _m1BuildFormObject();

  if (editIndex === -1) {
    sousStations.push(sst);
    afficherToast('Sous-station « ' + sst.ref + ' » ajoutée.');
  } else {
    sousStations[editIndex] = sst;
    afficherToast('Sous-station « ' + sst.ref + ' » mise à jour.');
  }

  _m1TakeSnapshot();
  fermerFormulaire();
  rendreTableau();
  saveCurrentProjectData();
  if (typeof p2SstRef !== 'undefined' && p2SstRef === ref && typeof chargerDonneeSST === 'function') {
    chargerDonneeSST(p2SstRef);
    if (typeof renderBandeIdentite === 'function') renderBandeIdentite();
    if (typeof _majToggleM2 === 'function') _majToggleM2();
  }
}

// ── Filtrage + tri du tableau ─────────────────────────────────────────────

function _calcEtatEffectifPourSST(s) {
  const etatChoisi = window.etatAffichage || 'projete';
  const etatExiste = (etatChoisi === 'existant' && s.hasExistant)
                  || (etatChoisi === 'projete'  && s.hasProjete);
  return etatExiste ? etatChoisi : (s.hasExistant ? 'existant' : 'projete');
}

function _extraireValeur(s, colonne) {
  const etat = _calcEtatEffectifPourSST(s);
  const b    = s[etat] || {};
  const d2   = (window.donneesP2 || {})[s.ref + '__' + etat] || {};
  switch (colonne) {
    case 'ref':          return (s.ref ?? '') + ' ' + (s.batiments ?? '');
    case 'typeSST':      return b.typeSST ?? '';
    case 'typeService':  return b.typeService ?? '';
    case 'typeBatiment': return b.typeBatiment ?? '';
    case 'sref':         return b.sref;
    case 'nbLogements':  return b.nbLogements;
    case 'nature':       return s.nature ?? '';
    case 'pCh': {
      const chR = parseFloat(d2.chRetenu);
      const mCh = parseFloat(d2.majorationCh ?? 0);
      return (isNaN(chR) || chR <= 0) ? null : chR * (1 + (isNaN(mCh) ? 0 : mCh) / 100);
    }
    case 'pEcs': {
      const ecsR = parseFloat(d2.ecsRetenu);
      const mEcs = parseFloat(d2.majorationEcs ?? 0);
      return (isNaN(ecsR) || ecsR <= 0) ? null : ecsR * (1 + (isNaN(mEcs) ? 0 : mEcs) / 100);
    }
    case 'pTotal': {
      const chR  = parseFloat(d2.chRetenu);
      const mCh  = parseFloat(d2.majorationCh ?? 0);
      const pCh  = (isNaN(chR)  || chR  <= 0) ? null : chR  * (1 + (isNaN(mCh)  ? 0 : mCh)  / 100);
      const ecsR = parseFloat(d2.ecsRetenu);
      const mEcs = parseFloat(d2.majorationEcs ?? 0);
      const pEcs = (isNaN(ecsR) || ecsR <= 0) ? null : ecsR * (1 + (isNaN(mEcs) ? 0 : mEcs) / 100);
      const chPart  = b.typeService === 'ECS' ? null : pCh;
      const ecsPart = b.typeService === 'CH'  ? null : pEcs;
      return (chPart == null && ecsPart == null) ? null : (chPart ?? 0) + (ecsPart ?? 0);
    }
    default: return null;
  }
}

function filtrerSousStations(liste) {
  const filtres = window.tableauFiltres || {};
  const entries = Object.entries(filtres);
  if (entries.length === 0) return liste.slice();
  return liste.filter(s => {
    for (const [col, filtre] of entries) {
      if (filtre == null) continue;
      const val = _extraireValeur(s, col);
      if (typeof filtre === 'string') {
        if (filtre.trim() === '') continue;
        if (!String(val ?? '').toLowerCase().includes(filtre.toLowerCase().trim())) return false;
      } else if (Array.isArray(filtre)) {
        if (filtre.length === 0) continue;
        if (!filtre.includes(val)) return false;
      } else if (typeof filtre === 'object') {
        const num = typeof val === 'number' ? val : parseFloat(val);
        if (isNaN(num)) { if (filtre.min != null || filtre.max != null) return false; continue; }
        if (filtre.min != null && num < filtre.min) return false;
        if (filtre.max != null && num > filtre.max) return false;
      }
    }
    return true;
  });
}

function trierSousStations(liste) {
  const tri = window.tableauTri;
  if (!tri || !tri.colonne || !tri.sens) return liste.slice();
  const facteur = tri.sens === 'desc' ? -1 : 1;
  return liste.slice().sort((a, b) => {
    const va = _extraireValeur(a, tri.colonne);
    const vb = _extraireValeur(b, tri.colonne);
    if (va == null || va === '') return 1;
    if (vb == null || vb === '') return -1;
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * facteur;
    return String(va).localeCompare(String(vb), 'fr', { sensitivity: 'base', numeric: true }) * facteur;
  });
}

function _majCompteur(nbAffichees, nbTotal) {
  const elReset = document.getElementById('btn-reset-filtres');
  const badge   = document.getElementById('badge-count');
  const aFiltre = Object.values(window.tableauFiltres || {}).some(f =>
    (typeof f === 'string' && f.trim() !== '') ||
    (Array.isArray(f) && f.length > 0) ||
    (f && typeof f === 'object' && !Array.isArray(f) && (f.min != null || f.max != null))
  );
  const aTri    = window.tableauTri !== null;
  const actif   = aFiltre || aTri;
  if (badge) badge.textContent = (aFiltre && nbAffichees < nbTotal) ? `${nbAffichees}/${nbTotal}` : nbTotal;
  if (elReset) elReset.style.display = actif ? '' : 'none';
  const elAlerte = document.getElementById('tableau-alerte');
  if (elAlerte) {
    if (aTri && aFiltre)      elAlerte.textContent = '⚠ Tri et filtre actifs';
    else if (aTri)            elAlerte.textContent = '⚠ Tri actif';
    else if (aFiltre)         elAlerte.textContent = '⚠ Filtre actif';
    elAlerte.style.display = actif ? '' : 'none';
  }
}

window.filtrerSousStations = filtrerSousStations;
window.trierSousStations   = trierSousStations;

// ── En-têtes interactifs + dropdown de filtres ───────────────────────────

function _majEntetesTableau() {
  const tri     = window.tableauTri    || {};
  const filtres = window.tableauFiltres || {};
  COLONNES_TABLEAU.forEach(({ key, libelle, filtre }) => {
    const th = document.querySelector(`table.sst-table thead th[data-col-key="${key}"]`);
    if (!th) return;
    let pictoTri, classeTri;
    if (tri.colonne === key) {
      pictoTri = tri.sens === 'asc' ? '▲' : '▼';
      classeTri = 'th-tri';
    } else {
      pictoTri = '⇅';
      classeTri = 'th-tri th-tri-neutre';
    }
    const f = filtres[key];
    let filtreActif = false;
    let filtreLabel = '⏷';
    if (typeof f === 'string' && f.trim() !== '') {
      filtreActif = true;
    } else if (Array.isArray(f) && f.length > 0) {
      filtreActif = true;
      filtreLabel = `⏷ (${f.length})`;
    } else if (f && typeof f === 'object' && !Array.isArray(f) && (f.min != null || f.max != null)) {
      filtreActif = true;
    }
    th.innerHTML =
      `<span class="th-inner">` +
        `<span class="th-libelle">${libelle}</span>` +
        `<span class="${classeTri}">${pictoTri}</span>` +
        `<button type="button" class="th-filtre-btn${filtreActif ? ' active' : ''}" ` +
          `data-col-key="${key}" data-filtre-type="${filtre}">${filtreLabel}</button>` +
      `</span>`;
  });
}

let _dropdownColKey       = null;
let _dropdownClickOutside = null;
let _dropdownKeydown      = null;

function fermerDropdown() {
  const el = document.getElementById('filtre-dropdown');
  if (el) el.style.display = 'none';
  if (_dropdownClickOutside) {
    document.removeEventListener('click', _dropdownClickOutside, true);
    _dropdownClickOutside = null;
  }
  if (_dropdownKeydown) {
    document.removeEventListener('keydown', _dropdownKeydown);
    _dropdownKeydown = null;
  }
  _dropdownColKey = null;
}

function _ouvrirDropdown(key, filtreType, btnEl) {
  if (_dropdownColKey === key) { fermerDropdown(); return; }
  fermerDropdown();
  _dropdownColKey = key;

  const el = document.getElementById('filtre-dropdown');
  const f  = (window.tableauFiltres || {})[key];
  let htmlContenu = '';

  if (filtreType === 'texte') {
    const val = typeof f === 'string' ? f : '';
    htmlContenu = `<input type="search" class="filtre-input" placeholder="Contient…" value="${esc(val)}">`;
  } else if (filtreType === 'enum') {
    const vals = [...new Set(
      (window.sousStations || []).map(s => _extraireValeur(s, key)).filter(v => v != null && v !== '')
    )].sort((a, b) => String(a).localeCompare(String(b), 'fr', { sensitivity: 'base' }));
    const actives  = Array.isArray(f) ? f : [];
    const toutActif = actives.length === 0;
    htmlContenu = `<div class="filtre-checkboxes">` +
      vals.map(v => {
        const checked = (toutActif || actives.includes(v)) ? 'checked' : '';
        return `<label><input type="checkbox" value="${esc(String(v))}" ${checked}> ${esc(String(v))}</label>`;
      }).join('') +
      `</div>`;
  } else if (filtreType === 'numerique') {
    const minV = f?.min ?? '';
    const maxV = f?.max ?? '';
    htmlContenu =
      `<div class="filtre-numerique">` +
        `<label>Min <input type="number" class="filtre-min" value="${minV}" step="any"></label>` +
        `<label>Max <input type="number" class="filtre-max" value="${maxV}" step="any"></label>` +
      `</div>`;
  }

  el.innerHTML = htmlContenu +
    `<div class="filtre-actions">` +
      `<a class="filtre-effacer" href="#">Effacer ce filtre</a>` +
      `<button type="button" class="filtre-appliquer">Appliquer</button>` +
    `</div>`;

  const rect = btnEl.getBoundingClientRect();
  let left = rect.left;
  if (left + 240 > window.innerWidth - 8) left = rect.right - 240;
  el.style.left    = Math.max(4, left) + 'px';
  el.style.top     = (rect.bottom + 4) + 'px';
  el.style.display = 'block';

  if (filtreType === 'texte') setTimeout(() => el.querySelector('.filtre-input')?.focus(), 0);

  el.querySelector('.filtre-appliquer').addEventListener('click', () => {
    let val;
    if (filtreType === 'texte') {
      val = el.querySelector('.filtre-input')?.value ?? '';
    } else if (filtreType === 'enum') {
      val = [...el.querySelectorAll('.filtre-checkboxes input:checked')].map(i => i.value);
    } else {
      const minRaw = el.querySelector('.filtre-min')?.value;
      const maxRaw = el.querySelector('.filtre-max')?.value;
      val = { min: minRaw !== '' ? parseFloat(minRaw) : null, max: maxRaw !== '' ? parseFloat(maxRaw) : null };
    }
    appliquerFiltre(key, val);
  });

  el.querySelector('.filtre-effacer').addEventListener('click', e => {
    e.preventDefault();
    delete window.tableauFiltres[key];
    rendreTableau();
    fermerDropdown();
  });

  _dropdownClickOutside = evt => {
    if (!el.contains(evt.target) && !btnEl.contains(evt.target)) fermerDropdown();
  };
  setTimeout(() => document.addEventListener('click', _dropdownClickOutside, true), 0);

  _dropdownKeydown = evt => { if (evt.key === 'Escape') fermerDropdown(); };
  document.addEventListener('keydown', _dropdownKeydown);
}

function appliquerFiltre(key, valeur) {
  if (valeur == null
    || (typeof valeur === 'string' && valeur.trim() === '')
    || (Array.isArray(valeur) && valeur.length === 0)
    || (valeur && typeof valeur === 'object' && !Array.isArray(valeur)
        && valeur.min == null && valeur.max == null)
  ) {
    delete window.tableauFiltres[key];
  } else {
    window.tableauFiltres[key] = valeur;
  }
  rendreTableau();
  fermerDropdown();
}
window.appliquerFiltre = appliquerFiltre;

// ── Rendu tableau ─────────────────────────────────────────────────────────
function rendreTableau() {
  const tbody = document.getElementById('sst-tbody');
  if (typeof updateHypEcsVisibility === 'function') updateHypEcsVisibility();

  if (sousStations.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12">
      <div class="empty-state">
        Aucune sous-station enregistrée.<br>
        Cliquez sur <strong>+ Nouvelle SST</strong> pour commencer.
      </div></td></tr>`;
    _majCompteur(0, 0);
    _majEntetesTableau();
    return;
  }

  const filtrees = filtrerSousStations(sousStations);
  const triees    = trierSousStations(filtrees);

  if (triees.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12">
      <div class="empty-state">Aucun résultat pour ces filtres.</div>
    </td></tr>`;
    _majCompteur(0, sousStations.length);
    _majEntetesTableau();
    return;
  }

  // SST sans donnée pour l'état affiché : toujours reléguées en bas de tableau,
  // quel que soit le tri actif, séparées des SST valides par une ligne dédiée.
  const etatChoisi = window.etatAffichage || 'projete';
  const valides   = [];
  const invalides = [];
  triees.forEach(s => {
    const ok = (etatChoisi === 'existant' && s.hasExistant) || (etatChoisi === 'projete' && s.hasProjete);
    (ok ? valides : invalides).push(s);
  });

  const buildRow = s => {
    const i          = sousStations.indexOf(s);
    const etatExiste   = (etatChoisi === 'existant' && s.hasExistant) || (etatChoisi === 'projete' && s.hasProjete);
    const etatEffectif = etatExiste ? etatChoisi : (s.hasExistant ? 'existant' : 'projete');
    const b            = s[etatEffectif] || {};
    const cpVille = [s.cp, s.ville].filter(Boolean).join(' ');
    const locLignes = [s.adresse ? esc(s.adresse) : null, cpVille || null].filter(Boolean);
    const d2           = (window.donneesP2 || {})[s.ref + '__' + etatEffectif] || {};
    const chR  = d2.chRetenu  != null ? parseFloat(d2.chRetenu)  : null;
    const ecsR = d2.ecsRetenu != null ? parseFloat(d2.ecsRetenu) : null;
    const mCh  = d2.majorationCh  != null ? parseFloat(d2.majorationCh)  : 15;
    const mEcs = d2.majorationEcs != null ? parseFloat(d2.majorationEcs) : 15;
    const pCh  = chR  ? Math.round(chR  * (1 + mCh  / 100)) : null;
    const pEcs = ecsR ? Math.round(ecsR * (1 + mEcs / 100)) : null;
    const pChPart  = b.typeService === 'ECS' ? null : pCh;
    const pEcsPart = b.typeService === 'CH'  ? null : pEcs;
    const pTotal   = (pChPart == null && pEcsPart == null) ? null : (pChPart ?? 0) + (pEcsPart ?? 0);
    const html = `
    <tr class="${etatExiste ? 'sst-row' : 'sst-row sst-row-fallback'}" onclick="allerVersM2(${i})" title="Cliquer pour ouvrir dans Module 2">
      <td>
        <strong>${esc(s.ref)}</strong>
        ${s.batiments ? `<br><small style="color:var(--ink-3);font-size:11px">${esc(s.batiments)}</small>` : ''}
      </td>
      <td style="white-space:normal;max-width:220px">${locLignes.length ? locLignes.join('<br>') : muted('—')}</td>
      <td>${b.typeSST      ? badgeTypeSst(b.typeSST)      : muted('—')}</td>
      <td>${b.typeService  ? badgeType(b.typeService)     : muted('—')}</td>
      <td>${b.typeBatiment ? `<span style="font-size:11px">${esc(b.typeBatiment)}</span>` : muted('—')}</td>
      <td>${b.sref != null ? b.sref.toLocaleString('fr-FR') : muted('—')}</td>
      <td>${b.nbLogements ?? muted('—')}</td>
      <td>${s.nature  ? badgeNature(s.nature)   : muted('—')}</td>
      <td style="text-align:center;font-weight:600;color:var(--hot-ink)">${pChPart  != null ? pChPart  : muted('—')}</td>
      <td style="text-align:center;font-weight:600;color:var(--cold-ink)">${pEcsPart != null ? pEcsPart : muted('—')}</td>
      <td style="text-align:center;font-weight:700;color:var(--accent-ink)">${pTotal != null ? pTotal : muted('—')}</td>
      <td style="white-space:nowrap" onclick="event.stopPropagation()">
        <button class="btn btn-outline btn-sm" onclick="ouvrirFormulaireEdition(${i})">Éditer</button>
        <button class="btn btn-danger btn-sm"  onclick="supprimerSST(${i})" style="margin-left:4px">✕</button>
      </td>
    </tr>`;
    return { html, sref: b.sref, nbLogements: b.nbLogements, pCh: pChPart, pEcs: pEcsPart, pTotal };
  };

  const valideRows   = valides.map(buildRow);
  const invalideRows = invalides.map(buildRow);
  const validesHtml   = valideRows.map(r => r.html).join('');
  const invalidesHtml = invalideRows.map(r => r.html).join('');

  // Ligne « somme » entre les SST valides et celles sans donnée — reflète le
  // filtre courant (recalculée à chaque rendu, comme le compteur d'en-tête).
  const sumSref        = valideRows.reduce((acc, r) => acc + (r.sref        ?? 0), 0);
  const sumNbLogements = valideRows.reduce((acc, r) => acc + (r.nbLogements ?? 0), 0);
  const sumPCh    = valideRows.reduce((acc, r) => acc + (r.pCh   ?? 0), 0);
  const sumPEcs   = valideRows.reduce((acc, r) => acc + (r.pEcs  ?? 0), 0);
  const sumPTotal = valideRows.reduce((acc, r) => acc + (r.pTotal ?? 0), 0);
  const sommeHtml = valides.length ? `<tr class="sst-sum-row">
      <td colspan="5">Total — ${valides.length} SST</td>
      <td>${sumSref.toLocaleString('fr-FR')}</td>
      <td>${sumNbLogements.toLocaleString('fr-FR')}</td>
      <td></td>
      <td style="text-align:center;color:var(--hot-ink)">${Math.round(sumPCh)}</td>
      <td style="text-align:center;color:var(--cold-ink)">${Math.round(sumPEcs)}</td>
      <td style="text-align:center;color:var(--accent-ink)">${Math.round(sumPTotal)}</td>
      <td></td>
    </tr>` : '';

  const separateurHtml = (valides.length && invalides.length)
    ? `<tr class="sst-separator"><td colspan="12"><div class="sst-separator-line">SST sans donnée pour l'état « ${etatChoisi === 'existant' ? 'Existant' : 'Projeté'} »</div></td></tr>`
    : '';

  tbody.innerHTML = validesHtml + sommeHtml + separateurHtml + invalidesHtml;
  _majCompteur(triees.length, sousStations.length);
  _majEntetesTableau();
}

// Bascule vers le Module 2 avec la SST sélectionnée (état synchronisé avec etatAffichage)
function allerVersM2(index) {
  const s = sousStations[index];
  if (!s) return;
  allerOnglet('puissance');
  const sel = document.getElementById('p2-sst-select');
  if (sel) sel.value = s.ref;
  if (typeof onSSTChange === 'function') onSSTChange(); // applique etatAffichage via p2SstEtat
}

// ── Suppression ───────────────────────────────────────────────────────────
function supprimerSST(index) {
  const ref = sousStations[index].ref;
  if (!confirm('Supprimer la sous-station « ' + ref + ' » ?')) return;
  if (window.donneesP2) {
    delete window.donneesP2[ref + '__existant'];
    delete window.donneesP2[ref + '__projete'];
  }
  sousStations.splice(index, 1);
  if (typeof p2SstRef !== 'undefined' && p2SstRef === ref && typeof afficherEtatVide === 'function') {
    afficherEtatVide();
  }
  rendreTableau();
  saveCurrentProjectData();
  afficherToast('Sous-station « ' + ref + ' » supprimée.');
}

// ── Helpers badge & texte ─────────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function muted(str) {
  return `<span style="color:var(--ink-3)">${str}</span>`;
}

function badgeType(type) {
  const map = { 'CH': 'tag-ch', 'ECS': 'tag-ecs', 'CH+ECS': 'tag-both' };
  return `<span class="tag ${map[type] || ''}">${esc(type)}</span>`;
}

function badgeTypeSst(typeSst) {
  const map = { 'Primaire': 'tag-primaire', 'Secondaire': 'tag-secondaire' };
  return `<span class="tag ${map[typeSst] || ''}">${esc(typeSst)}</span>`;
}

function badgeNature(nature) {
  const map = {
    'Neuf':          'tag-neuf',
    'Existant':      'tag-existant',
    'Rénovation':    'tag-renovation',
    'Raccordement':  'tag-raccordement',
  };
  return `<span class="tag ${map[nature] || ''}">${esc(nature)}</span>`;
}

function badgeEnergie(energie) {
  const map = { 'RCU': 'tag-energie-rcu', 'Gaz': 'tag-energie-gaz', 'Fioul': 'tag-energie-fioul' };
  return `<span class="tag ${map[energie] || ''}">${esc(energie)}</span>`;
}
function badgePlaceholder(label) {
  return `<span class="badge-placeholder" title="${label} non renseigné">—</span>`;
}

// ── Chaîne de résolution des paramètres SST ─────────────────────────────────
// Ordre : SST.overrides → Module 0 hypBatiments → null (pas de fallback codé en dur)
function getSSTHypParams(sst, etat) {
  const _etat = etat || (sst?.hasExistant ? 'existant' : 'projete');
  const _b  = (sst || {})[_etat] || (sst || {}).existant || (sst || {}).projete;
  const ovr = (_b || sst || {}).overrides || {};
  const typeBat = (_b || {}).typeBatiment || (sst || {}).typeBatiment || '';
  const bat = getHypoBatiment(typeBat) || {};
  const resolve = (oKey, bKey, def) => {
    if (ovr[oKey] !== null && ovr[oKey] !== undefined) return { val: ovr[oKey], src: 'sst' };
    if (bat[bKey] !== null && bat[bKey] !== undefined) return { val: bat[bKey], src: 'mod0' };
    return { val: def, src: 'defaut' };
  };
  const r = resolve('ratio',   'ratio',   null);
  const i = resolve('interm',  'interm',  null);
  const d = resolve('duree',   'duree',   null);
  const h = resolve('hPointe', 'hPointe', null);
  const p = resolve('puEcs',   'puEcs',   null);
  return {
    ratio:   r.val, ratioSrc:   r.src,
    interm:  i.val, intermSrc:  i.src,
    duree:   d.val, dureeSrc:   d.src,
    hPointe: h.val, hPointeSrc: h.src,
    puEcs:   p.val, puEcsSrc:   p.src,
  };
}

// Met à jour les placeholders des champs override pour un bloc donné
function majOverridePlaceholders(etat) {
  const sfx    = '--' + etat;
  const typeBat = document.getElementById('sst-type-batiment' + sfx)?.value || '';
  const bat    = getHypoBatiment(typeBat) || {};

  [
    ['sst-ovr-ratio',   bat.ratio],
    ['sst-ovr-interm',  bat.interm],
    ['sst-ovr-duree',   bat.duree],
    ['sst-ovr-hPointe', bat.hPointe],
    ['sst-ovr-puEcs',   bat.puEcs, v => Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })],
  ].forEach(([base, val, fmt]) => {
    const el = document.getElementById(base + sfx);
    const hint = document.getElementById(base + '-hint' + sfx);
    const display = (val !== null && val !== undefined) ? (fmt ? fmt(val) : val) : null;
    if (el) el.placeholder = display !== null ? `hérité : ${display}` : 'hérité Module 0';
    if (hint) hint.textContent = typeBat ? (display !== null ? `Hérité Module 0 : ${display}` : 'Aucune valeur Module 0 pour ce type') : '';
  });

  // sst-ovr-puecs-unit n'existe que dans le bloc Existant
  if (etat === 'existant') {
    const unitEl = document.getElementById('sst-ovr-puecs-unit');
    if (unitEl) unitEl.textContent = bat.unitEcs || 'kW/logt';
  }

  // Besoin ECS Module 0 — valeur de référence en lecture seule (non surchargeable)
  const besoinEl = document.getElementById('sst-ovr-besoin' + sfx);
  if (besoinEl) {
    besoinEl.value = (typeBat && bat.besoin !== null && bat.besoin !== undefined)
      ? `${bat.besoin} ${bat.unitBesoin}`
      : '';
    besoinEl.placeholder = typeBat ? 'Aucune valeur Module 0 pour ce type' : '—';
  }
}

// ── Onglets Existant / Projeté ─────────────────────────────────────────────

// Masque #sst-nb-logements-group--<etat> si typeBatiment est tertiaire
function updateNbLogementsVisibility(etat) {
  const typeBat = document.getElementById('sst-type-batiment--' + etat)?.value || '';
  const grp = document.getElementById('sst-nb-logements-group--' + etat);
  if (grp) grp.style.display = typeBat.startsWith('Tertiaire') ? 'none' : '';
}

// Affichage passif (chargement programmatique) — sans interaction utilisateur
function _montrerEtat(etat) {
  const cta    = document.getElementById('sst-etat-cta-'    + etat);
  const fields = document.getElementById('sst-etat-fields-' + etat);
  const tab    = document.getElementById('sst-etat-tab-'    + etat);
  if (cta)    cta.style.display    = 'none';
  if (fields) fields.style.display = '';
  if (tab)    tab.classList.remove('disabled');
}
function _cacherEtat(etat) {
  const cta    = document.getElementById('sst-etat-cta-'    + etat);
  const fields = document.getElementById('sst-etat-fields-' + etat);
  const tab    = document.getElementById('sst-etat-tab-'    + etat);
  if (cta)    cta.style.display    = '';
  if (fields) fields.style.display = 'none';
  if (tab)    tab.classList.add('disabled');
}

// Bascule visuelle (onglets + panels) sans toucher aux données ni à .disabled
function setEtatActif(etat) {
  const tabExist   = document.getElementById('sst-etat-tab-existant');
  const tabProj    = document.getElementById('sst-etat-tab-projete');
  const panelExist = document.getElementById('sst-etat-panel-existant');
  const panelProj  = document.getElementById('sst-etat-panel-projete');
  if (!tabExist || !tabProj || !panelExist || !panelProj) return;
  tabExist.classList.toggle('active', etat === 'existant');
  tabProj.classList.toggle('active',  etat === 'projete');
  panelExist.style.display = etat === 'existant' ? '' : 'none';
  panelProj.style.display  = etat === 'projete'  ? '' : 'none';
}

// Active un état inactif : masque CTA, affiche champs, pré-remplit depuis l'autre
function activerEtat(etat) {
  const autre  = etat === 'existant' ? 'projete' : 'existant';
  const cta    = document.getElementById('sst-etat-cta-'    + etat);
  const fields = document.getElementById('sst-etat-fields-' + etat);
  const tab    = document.getElementById('sst-etat-tab-'    + etat);
  if (!cta || !fields || !tab) return;
  cta.style.display    = 'none';
  fields.style.display = '';
  tab.classList.remove('disabled');
  // Pré-remplir typeService, typeSST, typeBatiment, nbLogements, sref depuis l'autre état
  const src     = document.getElementById('sst-type--'          + autre);
  const srcS    = document.getElementById('sst-type-sst--'      + autre);
  const srcB    = document.getElementById('sst-type-batiment--' + autre);
  const srcN    = document.getElementById('sst-nb-logements--'  + autre);
  const srcSref = document.getElementById('sst-sref--'          + autre);
  const dst     = document.getElementById('sst-type--'          + etat);
  const dstS    = document.getElementById('sst-type-sst--'      + etat);
  const dstB    = document.getElementById('sst-type-batiment--' + etat);
  const dstN    = document.getElementById('sst-nb-logements--'  + etat);
  const dstSref = document.getElementById('sst-sref--'          + etat);
  if (src     && dst)     dst.value     = src.value;
  if (srcS    && dstS)    dstS.value    = srcS.value;
  if (srcB    && dstB)    dstB.value    = srcB.value;
  if (srcN    && dstN)    dstN.value    = srcN.value;
  if (srcSref && dstSref) dstSref.value = srcSref.value;
  updateNbLogementsVisibility(etat);
  // Afficher le bouton Supprimer de l'état qu'on vient d'activer
  const supp = document.getElementById('sst-supprimer-' + etat);
  if (supp) supp.style.display = '';
  setEtatActif(etat);
}

// Désactive un état actif : vide les champs, affiche CTA, marque disabled
function desactiverEtat(etat) {
  const autre  = etat === 'existant' ? 'projete' : 'existant';
  const cta    = document.getElementById('sst-etat-cta-'    + etat);
  const fields = document.getElementById('sst-etat-fields-' + etat);
  const tab    = document.getElementById('sst-etat-tab-'    + etat);
  const supp   = document.getElementById('sst-supprimer-'   + etat);
  if (!cta || !fields || !tab) return;
  fields.querySelectorAll('input, select').forEach(el => { el.value = ''; });
  fields.style.display = 'none';
  cta.style.display    = '';
  tab.classList.add('disabled');
  if (supp) supp.style.display = 'none';
  setEtatActif(autre);
}

// Réinitialise onglets + panels à l'état par défaut : aucun état pré-créé,
// l'utilisateur doit explicitement "Ajouter l'état Existant/Projeté".
// Appelé par viderFormulaire() et par ouvrirFormulaireEdition()
function reinitialiserEtatTabs() {
  const g = id => document.getElementById(id);
  if (!g('sst-etat-tab-existant')) return;
  // Onglets — Existant reste l'onglet affiché par défaut, mais aucun des deux n'est créé
  g('sst-etat-tab-existant').classList.add('active');
  g('sst-etat-tab-existant').classList.add('disabled');
  g('sst-etat-tab-projete')?.classList.remove('active');
  g('sst-etat-tab-projete')?.classList.add('disabled');
  // Panels
  const panelExist = g('sst-etat-panel-existant');
  const panelProj  = g('sst-etat-panel-projete');
  if (panelExist) panelExist.style.display = '';
  if (panelProj)  panelProj.style.display  = 'none';
  // CTA / champs Existant — état non créé par défaut
  const ctaExist    = g('sst-etat-cta-existant');
  const fieldsExist = g('sst-etat-fields-existant');
  if (ctaExist)    ctaExist.style.display    = '';
  if (fieldsExist) fieldsExist.style.display = 'none';
  // CTA / champs Projeté — état non créé par défaut
  const ctaProj    = g('sst-etat-cta-projete');
  const fieldsProj = g('sst-etat-fields-projete');
  if (ctaProj)    ctaProj.style.display    = '';
  if (fieldsProj) fieldsProj.style.display = 'none';
  // Boutons Supprimer (masqués — aucun état actif par défaut)
  const suppExist = g('sst-supprimer-existant');
  const suppProj  = g('sst-supprimer-projete');
  if (suppExist) suppExist.style.display = 'none';
  if (suppProj)  suppProj.style.display  = 'none';
  // Vider les valeurs de tous les champs des deux panneaux
  [fieldsExist, fieldsProj].forEach(panel => {
    if (panel) panel.querySelectorAll('input, select').forEach(el => { el.value = ''; });
  });
}

function initSstEtatTabs() {
  const tabExist = document.getElementById('sst-etat-tab-existant');
  const tabProj  = document.getElementById('sst-etat-tab-projete');
  if (!tabExist || !tabProj) return;
  tabExist.addEventListener('click', () => setEtatActif('existant'));
  tabProj.addEventListener('click',  () => setEtatActif('projete'));
  document.getElementById('sst-ajouter-projete')
    ?.addEventListener('click', () => activerEtat('projete'));
  document.getElementById('sst-ajouter-existant')
    ?.addEventListener('click', () => activerEtat('existant'));
  document.getElementById('sst-supprimer-existant')
    ?.addEventListener('click', () => {
      if (!confirm('Supprimer l\'état Existant de cette SST ? Les données saisies pour cet état seront perdues.')) return;
      desactiverEtat('existant');
    });
  document.getElementById('sst-supprimer-projete')
    ?.addEventListener('click', () => {
      if (!confirm('Supprimer l\'état Projeté de cette SST ? Les données saisies pour cet état seront perdues.')) return;
      desactiverEtat('projete');
    });
  document.getElementById('sst-type-batiment--existant')
    ?.addEventListener('change', () => updateNbLogementsVisibility('existant'));
  document.getElementById('sst-type-batiment--projete')
    ?.addEventListener('change',  () => updateNbLogementsVisibility('projete'));
}
