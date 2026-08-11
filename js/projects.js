// ── projects.js — Gestion multi-projets (page de garde) ───────────────────

// ── Projet courant ────────────────────────────────────────────────────────
window.currentProjectId = null;

// ── Vue courante : 'v1' (liste) ou 'v2' (cartes) ─────────────────────────
let projViewMode = localStorage.getItem('flux_view_mode') || 'v2';

// ── API localStorage multi-projets ───────────────────────────────────────

function getProjects() {
  try { return JSON.parse(localStorage.getItem('flux_projects') || '[]'); }
  catch { return []; }
}

function saveProjects(list) {
  localStorage.setItem('flux_projects', JSON.stringify(list));
}

function getCurrentProjectId() {
  return localStorage.getItem('flux_current_project') || null;
}

function setCurrentProjectId(id) {
  if (id) localStorage.setItem('flux_current_project', id);
  else localStorage.removeItem('flux_current_project');
}

function getProjectData(id) {
  try {
    const raw = localStorage.getItem('flux_project_' + id);
    if (!raw) return { sousStations: [], donneesP2: {}, hypotheses: {}, carteReseau: {} };
    return JSON.parse(raw);
  } catch { return { sousStations: [], donneesP2: {}, hypotheses: {}, carteReseau: {} }; }
}

function saveCurrentProjectData() {
  const id = window.currentProjectId;
  if (!id) return;
  try {
    localStorage.setItem('flux_project_' + id, JSON.stringify({
      sousStations: window.sousStations || [],
      donneesP2:    window.donneesP2   || {},
      hypotheses:   window.hypotheses  || {},
      carteReseau:  window.carteReseau || {},
    }));
  } catch {}
}

function deleteProjectData(id) {
  localStorage.removeItem('flux_project_' + id);
}

function generateProjectId() {
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── Navigation ────────────────────────────────────────────────────────────
// CALDA n'a pour l'instant qu'une seule zone applicative (#main-content),
// pas de nav-tabs/page-referentiels séparés comme dans FLUX — à réintroduire
// quand les modules M0/M1/Référentiels seront portés.

function showLandingPage() {
  if (typeof _confirmLeaveDirty === 'function' && !_confirmLeaveDirty()) return;
  if (typeof fermerFormulaire === 'function') {
    const formCard = document.getElementById('form-sst-card');
    if (formCard && formCard.style.display !== 'none') fermerFormulaire();
  }
  setCurrentProjectId(null);
  window.currentProjectId = null;

  document.getElementById('page-projets').style.display = '';
  document.getElementById('main-content').style.display = 'none';

  renderProjectList();
  _majBoutonReprendre();
}

// ── Reprendre le dernier projet ouvert ─────────────────────────────────────
// flux_last_project n'est jamais effacé par showLandingPage() (contrairement
// à flux_current_project) : il survit au retour sur la page de garde.
function _majBoutonReprendre() {
  const btn = document.getElementById('btn-reprendre-projet');
  if (!btn) return;
  const lastId = localStorage.getItem('flux_last_project');
  const proj = lastId && getProjects().find(p => p.id === lastId);
  if (proj) {
    btn.textContent = `Reprendre « ${proj.nom} »`;
    btn.dataset.id = proj.id;
    btn.style.display = '';
  } else {
    btn.style.display = 'none';
  }
}

function openProject(id, { restoreModule = false } = {}) {
  const projects = getProjects();
  const proj = projects.find(p => p.id === id);
  if (!proj) return;

  setCurrentProjectId(id);
  window.currentProjectId = id;
  localStorage.setItem('flux_last_project', id);

  const data = getProjectData(id);
  window.sousStations = Array.isArray(data.sousStations) ? data.sousStations : [];
  window.donneesP2    = data.donneesP2   || {};
  window.hypotheses   = data.hypotheses  || {};
  window.carteReseau  = data.carteReseau || {};
  // La carte M4 est scopée par projet — on force sa réinitialisation pour
  // qu'elle recharge window.carteReseau au prochain affichage de l'onglet
  // (sans ça, l'instance Leaflet déjà créée garderait les données du projet précédent).
  if (typeof resetModule4 === 'function') resetModule4();

  _migrateProjectData();

  document.getElementById('page-projets').style.display = 'none';
  document.getElementById('main-content').style.display = '';

  document.getElementById('topbar-project-name').textContent = proj.nom;

  // Activer l'onglet Module 1 par défaut
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.module-section').forEach(s => s.classList.remove('active'));
  const bddBtn = document.querySelector('.tab-btn[data-tab="bdd"]');
  if (bddBtn) bddBtn.classList.add('active');
  const bddSect = document.getElementById('tab-bdd');
  if (bddSect) bddSect.classList.add('active');

  if (typeof _chargerEtatAffichage === 'function') _chargerEtatAffichage();
  if (typeof _chargerTri === 'function') _chargerTri();
  window.tableauFiltres = {};
  // M2 pas encore porté dans CALDA — no-op tant que ces fonctions n'existent pas.
  if (typeof rendreTableau === 'function') rendreTableau();
  if (typeof chargerHypothesesForm === 'function') chargerHypothesesForm();
  if (typeof refreshSSTSelect === 'function') refreshSSTSelect();

  // Restaurer la SST sélectionnée en M2 (clé scopée par projet)
  const savedSstRef = localStorage.getItem('flux_p2SstRef_' + id);
  if (savedSstRef && (window.sousStations || []).find(s => s.ref === savedSstRef)) {
    const sel = document.getElementById('p2-sst-select');
    if (sel) sel.value = savedSstRef;
    if (typeof onSSTChange === 'function') onSSTChange();
  }

  // Restaurer le module actif persisté uniquement sur rafraîchissement/rechargement
  if (restoreModule) {
    const savedModule = localStorage.getItem('flux_moduleActif_' + id);
    if (savedModule && document.querySelector(`.tab-btn[data-tab="${savedModule}"]`)) {
      allerOnglet(savedModule);
    }
  }
  if (typeof _majToggleM2 === 'function') _majToggleM2();

  afficherToast('Projet "' + proj.nom + '" ouvert — ' + window.sousStations.length + ' SST.');
}

function _migrateProjectData() {
  let migrated = false;

  // ── Migrations typeBatiment (existantes) ─────────────────────────────────
  (window.sousStations || []).forEach(sst => {
    if (sst.typeBatiment === 'Tertiaire — Sportif scolaire') {
      sst.typeBatiment = 'Tertiaire — Sportif'; migrated = true;
    } else if (sst.typeBatiment === 'Tertiaire — Enseignement avec internat') {
      sst.typeBatiment = 'Logement collectif'; migrated = true;
    }
  });
  if (((window.hypotheses || {}).hypBatiments || {})['tert-enseign-int'] !== undefined) {
    delete window.hypotheses.hypBatiments['tert-enseign-int']; migrated = true;
  }

  // ── Migration 2.4bis : nbLogements/shab/typeBatiment racine → blocs ──────
  (window.sousStations || []).forEach(sst => {
    const hasRacine = sst.nbLogements !== undefined
                   || sst.shab        !== undefined
                   || sst.typeBatiment !== undefined;
    if (!hasRacine) return;
    ['existant', 'projete'].forEach(etat => {
      const key = 'has' + etat[0].toUpperCase() + etat.slice(1); // 'hasExistant' / 'hasProjete'
      if (sst[key] && sst[etat]) {
        const bloc = sst[etat];
        if (bloc.typeBatiment === undefined) bloc.typeBatiment = sst.typeBatiment;
        if (bloc.nbLogements  === undefined) bloc.nbLogements  = sst.nbLogements;
        if (bloc.sref         === undefined) bloc.sref         = sst.shab;
      }
    });
    delete sst.nbLogements;
    delete sst.shab;
    delete sst.typeBatiment;
    migrated = true;
  });

  // ── Migration shab → sref (Surface de référence RE2020) ──────────────────
  (window.sousStations || []).forEach(sst => {
    ['existant', 'projete'].forEach(etat => {
      const bloc = sst[etat];
      if (bloc && bloc.shab !== undefined && bloc.sref === undefined) {
        bloc.sref = bloc.shab;
        delete bloc.shab;
        migrated = true;
      }
    });
  });

  // ── Migration clés hypotheses — ecsTauxRecyclage → ecsTauxBouclage ────────
  const hyp = window.hypotheses || {};
  if (hyp.ecsTauxRecyclage !== undefined && hyp.ecsTauxBouclage === undefined) {
    hyp.ecsTauxBouclage = hyp.ecsTauxRecyclage;
    delete hyp.ecsTauxRecyclage;
    migrated = true;
  }
  if (hyp.tRetRecyclageEcs !== undefined && hyp.tRetBouclageEcs === undefined) {
    hyp.tRetBouclageEcs = hyp.tRetRecyclageEcs;
    delete hyp.tRetRecyclageEcs;
    migrated = true;
  }

  // ── Migration clés donneesP2 — margeCh/margeEcs → majorationCh/majorationEcs
  Object.values(window.donneesP2 || {}).forEach(d => {
    if (!d) return;
    if (d.margeCh !== undefined && d.majorationCh === undefined) {
      d.majorationCh = d.margeCh;
      delete d.margeCh;
      migrated = true;
    }
    if (d.margeEcs !== undefined && d.majorationEcs === undefined) {
      d.majorationEcs = d.margeEcs;
      delete d.margeEcs;
      migrated = true;
    }
    if (d.marge_echangeur_ecs_semi_instantane !== undefined &&
        d.majoration_echangeur_ecs_semi_instantane === undefined) {
      d.majoration_echangeur_ecs_semi_instantane = d.marge_echangeur_ecs_semi_instantane;
      delete d.marge_echangeur_ecs_semi_instantane;
      migrated = true;
    }
  });

  // ── Migration F6 — pincementEch → pincementCh (projets antérieurs) ───────
  if (hyp.pincementEch !== undefined && hyp.pincementCh === undefined) {
    hyp.pincementCh = hyp.pincementEch;
    delete hyp.pincementEch;
    migrated = true;
  }

  // ── Migration F3 — suppression des clés mortes pChaudioreEcs / modeleChaudiereEcs
  Object.values(window.donneesP2 || {}).forEach(d => {
    if (!d) return;
    if (d.pChaudioreEcs !== undefined) { delete d.pChaudioreEcs; migrated = true; }
    if (d.modeleChaudiereEcs !== undefined) { delete d.modeleChaudiereEcs; migrated = true; }
  });

  // ── Migration F5 — suppression de la clé redondante puissance_retenue_ecs_semi_instantane
  Object.values(window.donneesP2 || {}).forEach(d => {
    if (!d) return;
    if (d.puissance_retenue_ecs_semi_instantane !== undefined) {
      if (d.ecsRetenu === undefined) d.ecsRetenu = d.puissance_retenue_ecs_semi_instantane;
      delete d.puissance_retenue_ecs_semi_instantane;
      migrated = true;
    }
  });

  // ── Migration M2 — ecsN1..ecsN5 → ecsM2ConsoN1..N5 ──────────────────────
  Object.values(window.donneesP2 || {}).forEach(d => {
    if (!d) return;
    for (let i = 1; i <= 5; i++) {
      const oldKey = `ecsN${i}`;
      const newKey = `ecsM2ConsoN${i}`;
      if (d[oldKey] !== undefined && d[newKey] === undefined) {
        d[newKey] = d[oldKey];
        migrated = true;
      }
      delete d[oldKey];
    }
  });

  // ── Migration F7 — suppression des références SST orphelines dans donneesP2
  // Le préfixe avant "__" est extrait avant comparaison pour accepter les futures
  // clés composites du schéma Existant/Projeté ("SST-01__existant", "SST-01__projete").
  // Les clés sans "__" (ancien format) se comportent comme avant : split("__")[0] === clé entière.
  const validRefs = new Set((window.sousStations || []).map(s => s.ref));
  let orphelinsCount = 0;
  Object.keys(window.donneesP2 || {}).forEach(key => {
    const baseRef = key.split('__')[0];
    if (!validRefs.has(baseRef)) {
      delete window.donneesP2[key];
      orphelinsCount++;
    }
  });
  if (orphelinsCount) {
    console.log(`[Migration] ${orphelinsCount} référence(s) SST orpheline(s) supprimée(s) de donneesP2.`);
    migrated = true;
  }

  // ── Migration stub gaz → energie ──────────────────────────────────────────
  // Les projets créés avant l'implémentation complète du mode combustible
  // avaient modeConsos='gaz' mais sans typeChaudiere (stub UI sans calcul).
  // Leurs chN1..chN5 étaient interprétés comme MWh thermique → cohérents avec 'energie'.
  Object.values(window.donneesP2 || {}).forEach(d => {
    if (!d) return;
    if (d.modeConsos === 'gaz' && d.typeChaudiere == null) {
      d.modeConsos = 'energie';
      migrated = true;
    }
  });

  // ── Migration CAS 1 — tPointe, pctBallon, volBallon → _noninstant ──────────
  // Les champs config-spécifiques ECS sont stockés avec suffixe _noninstant pour les
  // configs non-Instantané. Pour les configs Instantané, les anciennes clés sont supprimées.
  Object.values(window.donneesP2 || {}).forEach(d => {
    if (!d) return;
    const isNonInst = d.configEcs && d.configEcs !== 'Instantané';
    ['tPointe', 'pctBallon', 'volBallon'].forEach(k => {
      if (d[k] !== undefined) {
        if (isNonInst && d[`${k}_noninstant`] === undefined) d[`${k}_noninstant`] = d[k];
        delete d[k];
        migrated = true;
      }
    });
  });

  // ── Migration CAS 3 — champs Existant-only → _exist, deperditions → _neuf ──
  // Option 1 : les champs de p2-ch-m1-section (chN1..chN5, modeConsos, combustibleUnite…)
  // sont communs (protégés par masquage UI) — seuls les champs des sections indépendamment
  // masquées sont suffixés.
  Object.entries(window.donneesP2 || {}).forEach(([key, d]) => {
    if (!d) return;
    const baseRef = key.split('__')[0];
    const isNeuf = ((window.sousStations || []).find(s => s.ref === baseRef) || {}).nature === 'Neuf';
    if (isNeuf) {
      if (d.deperditions !== undefined && d.deperditions_neuf === undefined) {
        d.deperditions_neuf = d.deperditions; migrated = true;
      }
      if (d.deperditions !== undefined) { delete d.deperditions; migrated = true; }
    } else {
      const existKeys = [
        'pChaudiere', 'modeleChaudiere', 'pEchangeurCh', 'modeleEchangeurCh',
        'pContratCh', 'gestionnaireContratCh', 'dateContratCh',
        'pEchangeurEcs', 'modeleEchangeurEcs',
        'pContratEcs', 'gestionnaireContratEcs', 'dateContratEcs',
      ];
      existKeys.forEach(k => {
        if (d[k] !== undefined && d[`${k}_exist`] === undefined) {
          d[`${k}_exist`] = d[k]; migrated = true;
        }
        if (d[k] !== undefined) { delete d[k]; migrated = true; }
      });
      // deperditions sans nature Neuf → clé morte (p2-ch-deperd-section masquée en Existant)
      if (d.deperditions !== undefined) { delete d.deperditions; migrated = true; }
    }
  });

  // ── Migration sous-phase 1.2 — structure SST existant/projete ───────────────
  // Les anciennes SST stockaient type/typeSst/overrides à la racine uniquement.
  // On ajoute le bloc 'existant' sans supprimer les clés racine (transition) :
  // puissance.js lit encore type/typeSst/overrides à la racine (sous-phase 1.3+).
  (window.sousStations || []).forEach(s => {
    if (!s.existant && !s.projete) {
      const _bloc  = {
        typeService: s.type    || '',
        typeSST:     s.typeSst || '',
        overrides:   s.overrides || {},
      };
      const _isNeuf = s.nature === 'Neuf';
      // nature "Neuf" → projete ; "Existant" ou vide/indéterminé → existant (usage historique)
      s.existant    = _isNeuf ? null  : _bloc;
      s.projete     = _isNeuf ? _bloc : null;
      s.hasExistant = !_isNeuf;
      s.hasProjete  = _isNeuf;
      migrated = true;
    }
  });

  // ── Migration sous-phase 1.5 — suppression clés racine type/typeSst/overrides ──
  // Les blocs existant/projete portent désormais ces données (sous-phase 1.2 stable).
  // Cette migration s'exécute après la 1.2, garantissant que les blocs existent avant
  // la suppression des anciennes clés.
  (window.sousStations || []).forEach(s => {
    if (s.type      !== undefined) { delete s.type;      migrated = true; }
    if (s.typeSst   !== undefined) { delete s.typeSst;   migrated = true; }
    if (s.overrides !== undefined) { delete s.overrides; migrated = true; }
  });

  // ── Migration sous-phase 1.6.0 — clés composites donneesP2 ──────────────────
  // Renomme les clés simples "SST-01" en "SST-01__existant" ou "SST-01__projete"
  // selon l'état actif de chaque SST (hasExistant / hasProjete définis par la 1.2).
  // Idempotente : ignore les clés déjà composites (contenant "__").
  const _newDonneesP2 = {};
  let _migrated16 = false;
  Object.keys(window.donneesP2 || {}).forEach(key => {
    if (key.includes('__')) {
      _newDonneesP2[key] = window.donneesP2[key];
      return;
    }
    const sst = (window.sousStations || []).find(s => s.ref === key);
    if (!sst) {
      _newDonneesP2[key] = window.donneesP2[key];
      return;
    }
    const etat   = sst.hasProjete ? 'projete' : 'existant';
    _newDonneesP2[key + '__' + etat] = window.donneesP2[key];
    _migrated16 = true;
  });
  if (_migrated16) {
    window.donneesP2 = _newDonneesP2;
    migrated = true;
  }

  // ── Nettoyage des clés Module 3 (prototype supprimé) ──────────────────────
  let m3Count = 0;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && key.startsWith('m3_')) {
      localStorage.removeItem(key);
      m3Count++;
    }
  }
  if (m3Count) console.log(`[Migration] ${m3Count} clé(s) Module 3 supprimée(s).`);

  // ── Migration 2.10 — rétrocompatibilité energieActuelle ─────────────────
  (window.sousStations || []).forEach(sst => {
    if (sst.hasExistant && sst.existant && sst.existant.energieActuelle === undefined) {
      sst.existant.energieActuelle = 'RCU';
      migrated = true;
    }
  });

  // ── Recalcul automatique de sst.nature (sous-phase 2.4) ──────────────────
  if (typeof window.calculerNature === 'function') {
    (window.sousStations || []).forEach(sst => {
      const naturePrecedente = sst.nature;
      sst.nature = window.calculerNature(sst);
      if (sst.nature !== naturePrecedente) migrated = true;
    });
  }

  if (migrated) saveCurrentProjectData();
}

// ── Rendu liste projets ───────────────────────────────────────────────────

function renderProjectList() {
  const projects = getProjects();
  const container = document.getElementById('projet-list-container');
  if (!container) return;

  const btn = document.getElementById('btn-toggle-view');
  if (btn) btn.textContent = projViewMode === 'v1' ? 'Vue cartes' : 'Vue liste';

  if (projViewMode === 'v1') {
    _renderV1(projects, container);
  } else {
    _renderV2(projects, container);
  }
}

function _renderV1(projects, container) {
  if (!projects.length) {
    container.innerHTML = `<div class="proj-empty">Aucun projet. Cliquez sur <strong>+ Nouveau projet</strong> pour commencer.</div>`;
    return;
  }
  const rows = projects.map(p => {
    const data = getProjectData(p.id);
    const nSST = Array.isArray(data.sousStations) ? data.sousStations.length : 0;
    return `<div class="proj-table-row">
      <span class="proj-table-nom">${_esc(p.nom)}</span>
      <span>${_esc(p.numeroAffaire || '—')}</span>
      <span>${_esc(p.moa || '—')}</span>
      <span class="proj-table-desc">${_esc(p.description || '—')}</span>
      <span>${p.dateCreation ? p.dateCreation.slice(0, 10) : '—'}</span>
      <span class="proj-table-nsst">${nSST}</span>
      <span class="proj-table-actions">
        <button class="btn sm brand-outline" onclick="openProject('${p.id}')">Ouvrir</button>
        <button class="btn sm ghost" onclick="showEditProjectForm('${p.id}')">Modifier</button>
        <button class="btn sm ghost" onclick="duplicateProject('${p.id}')">Dupliquer</button>
        <button class="btn sm danger" onclick="deleteProject('${p.id}')">Supprimer</button>
      </span>
    </div>`;
  }).join('');
  container.innerHTML = `
    <div class="proj-table">
      <div class="proj-table-head">
        <span>Nom du projet</span><span>N° affaire</span><span>MOA</span><span>Description</span>
        <span>Créé le</span><span>SST</span><span>Actions</span>
      </div>
      ${rows}
    </div>`;
}

function _renderV2(projects, container) {
  if (!projects.length) {
    container.innerHTML = `<div class="proj-empty">Aucun projet. Cliquez sur <strong>+ Nouveau projet</strong> pour commencer.</div>`;
    return;
  }
  const cards = projects.map(p => {
    const data = getProjectData(p.id);
    const nSST = Array.isArray(data.sousStations) ? data.sousStations.length : 0;
    return `<div class="card proj-card" onclick="openProject('${p.id}')">
      <div class="proj-card-image">
        ${p.image ? `<img src="${p.image}" alt="" />` : `<div class="proj-card-image-placeholder">Aucune image</div>`}
      </div>
      <div class="proj-card-top">
        <div class="proj-card-nom">${_esc(p.nom)}</div>
        <span class="pill gray proj-card-nsst">${nSST} SST</span>
      </div>
      ${p.numeroAffaire ? `<div class="proj-card-affaire">Affaire ${_esc(p.numeroAffaire)}</div>` : ''}
      ${p.moa ? `<div class="proj-card-moa">${_esc(p.moa)}</div>` : ''}
      <div class="proj-card-desc${p.description ? '' : ' proj-card-desc--empty'}">${_esc(p.description || '—')}</div>
      <div class="proj-card-meta">${p.dateCreation ? p.dateCreation.slice(0, 10) : '—'}</div>
      <div class="proj-card-actions" onclick="event.stopPropagation()">
        <button class="btn sm brand-outline" onclick="openProject('${p.id}')">Ouvrir</button>
        <button class="btn sm ghost" onclick="showEditProjectForm('${p.id}')">Modifier</button>
        <button class="btn sm ghost" onclick="duplicateProject('${p.id}')">Dupliquer</button>
        <button class="btn sm danger" onclick="deleteProject('${p.id}')">Supprimer</button>
      </div>
    </div>`;
  }).join('');
  container.innerHTML = `<div class="proj-cards-grid">${cards}</div>`;
}

function _esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Image par projet ────────────────────────────────────────────────────
// Redimensionnée (600px max) et recompressée en JPEG avant stockage base64
// dans flux_projects — le localStorage du navigateur n'offre que ~5 Mo.
// L'image choisie est mise en attente (_formImageDataUrl) et n'est écrite
// dans flux_projects qu'à l'enregistrement du formulaire (Créer/Enregistrer).
const IMAGE_MAX_DIMENSION = 600;
const IMAGE_LIMITE_OCTETS = 250 * 1024; // marge large : un JPEG 600px à qualité 0.7 fait typiquement 40-120 Ko
const IMAGE_PALIERS_QUALITE = [0.7, 0.5, 0.3];

// undefined = pas de changement (édition : on garde l'image existante) ;
// string = nouvelle image en attente ; null = suppression explicite.
let _formImageDataUrl = undefined;

function declencherChoixImageForm() {
  document.getElementById('proj-image-input')?.click();
}

function retirerImageForm() {
  _formImageDataUrl = null;
  _majApercuImageForm(null);
}

function _majApercuImageForm(url) {
  const img         = document.getElementById('proj-form-image-preview');
  const placeholder = document.getElementById('proj-form-image-placeholder');
  const btnRetirer  = document.getElementById('btn-image-retirer');
  if (!img || !placeholder) return;
  if (url) {
    img.src = url;
    img.style.display = '';
    placeholder.style.display = 'none';
    if (btnRetirer) btnRetirer.style.display = '';
  } else {
    img.removeAttribute('src');
    img.style.display = 'none';
    placeholder.style.display = '';
    if (btnRetirer) btnRetirer.style.display = 'none';
  }
}

function _traiterFichierImageForm(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    afficherToast('Ce fichier n\'est pas reconnu comme une image.');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > IMAGE_MAX_DIMENSION || h > IMAGE_MAX_DIMENSION) {
        if (w >= h) { h = Math.round(h * IMAGE_MAX_DIMENSION / w); w = IMAGE_MAX_DIMENSION; }
        else        { w = Math.round(w * IMAGE_MAX_DIMENSION / h); h = IMAGE_MAX_DIMENSION; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);

      let dataUrl = null;
      for (const qualite of IMAGE_PALIERS_QUALITE) {
        const essai = canvas.toDataURL('image/jpeg', qualite);
        if (essai.length * 0.75 <= IMAGE_LIMITE_OCTETS) { dataUrl = essai; break; }
        dataUrl = essai; // garde le dernier palier essayé (le plus compressé) en dernier recours
      }
      if (!dataUrl || dataUrl.length * 0.75 > IMAGE_LIMITE_OCTETS) {
        afficherToast('Image trop volumineuse, réessayez avec une image plus simple.');
        return;
      }

      _formImageDataUrl = dataUrl;
      _majApercuImageForm(dataUrl);
    };
    img.onerror = () => afficherToast('Impossible de lire cette image.');
    img.src = reader.result;
  };
  reader.onerror = () => afficherToast('Impossible de lire ce fichier.');
  reader.readAsDataURL(file);
}

// ── Formulaire création / édition de projet ────────────────────────────────
// Un seul formulaire pour les deux usages : _editingProjectId distingue
// création (null) et édition (id du projet modifié).
let _editingProjectId = null;

function showNewProjectForm() {
  _editingProjectId = null;
  _formImageDataUrl = undefined;
  document.getElementById('form-projet-titre').textContent = 'Nouveau projet';
  document.getElementById('btn-creer-projet').textContent = 'Créer le projet';
  _majApercuImageForm(null);
  document.getElementById('form-nouveau-projet').style.display = '';
  document.getElementById('btn-nouveau-projet').style.display = 'none';
  const dateEl = document.getElementById('proj-date');
  if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().slice(0, 10);
  document.getElementById('proj-nom')?.focus();
}

function showEditProjectForm(id) {
  const proj = getProjects().find(p => p.id === id);
  if (!proj) return;
  _editingProjectId = id;
  _formImageDataUrl = undefined;
  document.getElementById('form-projet-titre').textContent = 'Modifier le projet';
  document.getElementById('btn-creer-projet').textContent = 'Enregistrer';
  const setV = (elId, v) => { const el = document.getElementById(elId); if (el) el.value = v || ''; };
  setV('proj-nom', proj.nom);
  setV('proj-numero-affaire', proj.numeroAffaire);
  setV('proj-moa', proj.moa);
  setV('proj-date', proj.dateCreation);
  setV('proj-description', proj.description);
  _majApercuImageForm(proj.image || null);
  document.getElementById('form-nouveau-projet').style.display = '';
  document.getElementById('btn-nouveau-projet').style.display = 'none';
  document.getElementById('form-nouveau-projet').scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('proj-nom')?.focus();
}

function hideNewProjectForm() {
  const formCard = document.getElementById('form-nouveau-projet');
  formCard.style.display = 'none';
  document.getElementById('btn-nouveau-projet').style.display = '';
  clearAllErrors(formCard);
  ['proj-nom', 'proj-numero-affaire', 'proj-moa', 'proj-description', 'proj-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  _editingProjectId = null;
  _formImageDataUrl = undefined;
  _majApercuImageForm(null);
}

function creerProjet() {
  const formCard = document.getElementById('form-nouveau-projet');
  clearAllErrors(formCard);

  const nom = (document.getElementById('proj-nom')?.value || '').trim();
  if (!nom) setFieldError('proj-nom', 'Le nom du projet est obligatoire.');

  if (formCard.querySelector('.field-error')) {
    focusFirstError(formCard);
    return;
  }

  const numeroAffaire = (document.getElementById('proj-numero-affaire')?.value || '').trim();
  const moa         = (document.getElementById('proj-moa')?.value || '').trim();
  const description = (document.getElementById('proj-description')?.value || '').trim();
  const dateCreation = document.getElementById('proj-date')?.value || new Date().toISOString().slice(0, 10);

  const projects = getProjects();

  // ── Édition d'un projet existant ─────────────────────────────────────
  if (_editingProjectId) {
    const proj = projects.find(p => p.id === _editingProjectId);
    if (!proj) { hideNewProjectForm(); return; }
    proj.nom = nom;
    proj.numeroAffaire = numeroAffaire;
    proj.moa = moa;
    proj.description = description;
    proj.dateCreation = dateCreation;
    if (_formImageDataUrl !== undefined) {
      if (_formImageDataUrl === null) delete proj.image;
      else proj.image = _formImageDataUrl;
    }
    try {
      saveProjects(projects);
    } catch (e) {
      afficherToast('Espace de stockage insuffisant pour enregistrer les modifications.');
      return;
    }
    hideNewProjectForm();
    renderProjectList();
    afficherToast(`Projet "${nom}" modifié.`);
    return;
  }

  // ── Création d'un nouveau projet ─────────────────────────────────────
  const id = generateProjectId();
  const proj = { id, nom, numeroAffaire, moa, description, dateCreation };
  if (_formImageDataUrl) proj.image = _formImageDataUrl;

  projects.push(proj);
  saveProjects(projects);

  localStorage.setItem('flux_project_' + id, JSON.stringify({
    sousStations: [], donneesP2: {}, hypotheses: {}, carteReseau: {},
  }));

  hideNewProjectForm();
  openProject(id);
}

// ── Supprimer un projet ───────────────────────────────────────────────────

function deleteProject(id) {
  const projects = getProjects();
  const proj = projects.find(p => p.id === id);
  if (!proj) return;
  if (!confirm(`Supprimer définitivement le projet "${proj.nom}" ?\nCette action est irréversible.`)) return;

  saveProjects(projects.filter(p => p.id !== id));
  deleteProjectData(id);

  if (window.currentProjectId === id) {
    window.currentProjectId = null;
    setCurrentProjectId(null);
  }
  renderProjectList();
  afficherToast(`Projet "${proj.nom}" supprimé.`);
}

// ── Dupliquer un projet ───────────────────────────────────────────────────

function duplicateProject(id) {
  const projects = getProjects();
  const proj = projects.find(p => p.id === id);
  if (!proj) return;

  const newId = generateProjectId();
  const newProj = {
    ...proj,
    id:           newId,
    nom:          proj.nom + ' (copie)',
    dateCreation: new Date().toISOString().slice(0, 10),
  };

  const data = getProjectData(id);
  localStorage.setItem('flux_project_' + newId, JSON.stringify(JSON.parse(JSON.stringify(data))));

  projects.push(newProj);
  saveProjects(projects);

  renderProjectList();
  afficherToast(`Projet "${proj.nom}" dupliqué.`);
}

// ── Toast global ─────────────────────────────────────────────────────────
// Rapatrié depuis app.js (FLUX) — à déplacer si un app.js CALDA voit le jour.
let toastTimer = null;

function afficherToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ── Initialisation ────────────────────────────────────────────────────────

function initProjects() {
  document.getElementById('btn-nouveau-projet').addEventListener('click', showNewProjectForm);
  document.getElementById('btn-annuler-projet').addEventListener('click', hideNewProjectForm);
  document.getElementById('btn-creer-projet').addEventListener('click', creerProjet);

  // Entrée = créer le projet depuis les champs du formulaire
  ['proj-nom', 'proj-numero-affaire', 'proj-moa', 'proj-description', 'proj-date'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') creerProjet();
    });
  });

  document.getElementById('btn-toggle-view').addEventListener('click', () => {
    projViewMode = projViewMode === 'v1' ? 'v2' : 'v1';
    localStorage.setItem('flux_view_mode', projViewMode);
    renderProjectList();
  });

  document.getElementById('brand').addEventListener('click', showLandingPage);

  document.getElementById('btn-reprendre-projet')?.addEventListener('click', function () {
    const id = this.dataset.id;
    if (id) openProject(id);
  });

  document.getElementById('btn-image-choisir')?.addEventListener('click', declencherChoixImageForm);
  document.getElementById('btn-image-retirer')?.addEventListener('click', retirerImageForm);
  document.getElementById('proj-image-input')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) _traiterFichierImageForm(file);
    e.target.value = '';
  });

  // Restaurer le projet actif si disponible
  const savedId = getCurrentProjectId();
  if (savedId && getProjects().find(p => p.id === savedId)) {
    openProject(savedId, { restoreModule: true });
  } else {
    showLandingPage();
  }
}

// ── Navigation entre modules ───────────────────────────────────────────────
// Rapatrié depuis puissance.js (FLUX) — fonction de navigation générique,
// pas de logique de calcul M2. Garde-fou supplémentaire sur _p2ConfirmLeaveDirty
// (inexistant tant que M2 n'est pas porté), même style que les deux autres gardes.
function allerOnglet(tabId) {
  if (tabId !== 'bdd' && typeof _confirmLeaveDirty === 'function' && !_confirmLeaveDirty()) return;
  if (tabId !== 'puissance' && typeof _p2ConfirmLeaveDirty === 'function' && !_p2ConfirmLeaveDirty()) return;
  if (tabId !== 'hypotheses' && typeof window._p0ConfirmLeaveDirty === 'function' && !window._p0ConfirmLeaveDirty()) return;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.module-section').forEach(s => s.classList.remove('active'));
  const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (btn) btn.classList.add('active');
  const sec = document.getElementById('tab-' + tabId);
  if (sec) sec.classList.add('active');
  if (window.currentProjectId) {
    localStorage.setItem('flux_moduleActif_' + window.currentProjectId, tabId);
  }
}

// M3 n'a pas encore de section — son lien reste inerte.
function initModuleNav() {
  document.querySelectorAll('.module-nav a[data-tab]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      allerOnglet(link.dataset.tab);
      if (link.dataset.tab === 'puissance') {
        if (typeof refreshSSTSelect === 'function') refreshSSTSelect();
        if (typeof p2SstRef !== 'undefined' && p2SstRef && typeof chargerDonneeSST === 'function') chargerDonneeSST(p2SstRef);
      }
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initBDD();
  initHypotheses();
  if (typeof initModule4 === 'function') initModule4();
  initModuleNav();
  initProjects();
});
