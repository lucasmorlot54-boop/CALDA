// ── puissance.js — Maquette Module 2 (navigation/affichage uniquement) ────
//
// Ce fichier ne contient AUCUNE logique de calcul : c'est la glue
// d'affichage de la maquette M2 (bascule d'onglets CH/ECS/Projeté, cases de
// reprise Existant→Projeté, repli de la bande hypothèses). Reprise à
// l'identique du script inline retiré lors de la découpe initiale de la
// maquette (commit ce6331e) — sa suppression avait rendu les onglets ECS et
// Projeté inatteignables faute de gestionnaire de clic.
//
// La logique de calcul réelle du Module 2 (CH M1-M4, ECS M1-M4, synthèse)
// n'est pas encore portée depuis FLUX — ce fichier en sera la base une fois
// ce portage fait.

// Référence de la SST actuellement ouverte en M2 (null si aucune)
let p2SstRef = null;

function initPuissanceMaquette() {
  // ── Bascule d'onglets CH / ECS / Projeté ──────────────────────────────
  const tabs   = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.tab-panel');
  if (!tabs.length || !panels.length) return;

  tabs.forEach(t => {
    t.addEventListener('click', () => {
      const target = t.getAttribute('data-tab');
      tabs.forEach(x => x.setAttribute('aria-selected', x === t ? 'true' : 'false'));
      if (target === 'projete') {
        // Projeté → affiche CH + ECS combinés (identique à l'état existant pour l'instant)
        panels.forEach(p => {
          const pt = p.getAttribute('data-tab');
          p.setAttribute('data-active', (pt === 'ch' || pt === 'ecs') ? 'true' : 'false');
        });
        document.body.setAttribute('data-state', 'projete');
      } else {
        panels.forEach(p => p.setAttribute('data-active', p.getAttribute('data-tab') === target ? 'true' : 'false'));
        document.body.setAttribute('data-state', 'existant');
      }
      if (typeof renderBandeIdentite === 'function') renderBandeIdentite();
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  });
  document.body.setAttribute('data-state', 'existant');

  // ── Reuse-init : cases à cocher → application automatique ─────────────
  const reuseInit = document.querySelector('.reuse-init');
  if (reuseInit) {
    const rows = reuseInit.querySelectorAll('.reuse-row');
    const checkboxes = reuseInit.querySelectorAll('.reuse-row input[type="checkbox"]');

    function syncRows() {
      rows.forEach(r => {
        const cb = r.querySelector('input[type="checkbox"]');
        if (cb.checked) r.classList.add('applied');
        else r.classList.remove('applied');
        // Bascule .reused sur les cartes méthodes + synthèse ciblées (état projeté uniquement)
        const target = r.getAttribute('data-target');
        if (target) {
          const targets = [];
          if (target === 'methods-card-ch') targets.push('.methods-card-ch', '.synth-card-ch');
          else if (target === 'methods-card-ecs') targets.push('.methods-card-ecs', '.synth-card-ecs', '.ecs-target-card');
          else targets.push('.' + target);
          targets.forEach(sel => {
            const el = document.querySelector(sel);
            if (el) {
              if (cb.checked) el.classList.add('reused');
              else el.classList.remove('reused');
            }
          });
        }
      });
    }

    checkboxes.forEach(cb => {
      cb.addEventListener('change', syncRows);
    });

    syncRows();
  }

  // ── Repli de la bande hypothèses (sticky) ──────────────────────────────
  const hypBar  = document.getElementById('hypBar');
  const hypHead = document.getElementById('hypHead');
  if (hypBar && hypHead) {
    hypHead.addEventListener('click', () => {
      hypBar.classList.toggle('collapsed');
    });
  }

  // ── Bandeau d'identification SST : sélecteur + rendu ───────────────────
  const sstSelect = document.getElementById('p2-sst-select');
  if (sstSelect) sstSelect.addEventListener('change', onSSTChange);
  document.getElementById('p2-btn-modifier-sst')?.addEventListener('click', ouvrirEditionSSTDepuisM2);
  refreshSSTSelect();
  afficherEtatVide();

  initDonneesChauffageM2();
}

// Bouton "Modifier" du bandeau SST — renvoie au formulaire d'édition Module 1
function ouvrirEditionSSTDepuisM2() {
  if (!p2SstRef) return;
  const index = (window.sousStations || []).findIndex(s => s.ref === p2SstRef);
  if (index === -1) return;
  if (typeof allerOnglet === 'function') allerOnglet('bdd');
  if (typeof ouvrirFormulaireEdition === 'function') ouvrirFormulaireEdition(index);
}

// ── Bandeau d'identification SST (id-bar) ───────────────────────────────

// Remplit le <select> de choix de SST depuis window.sousStations
function refreshSSTSelect() {
  const sel = document.getElementById('p2-sst-select');
  if (!sel) return;
  const liste = window.sousStations || [];
  sel.innerHTML = '<option value="">— Choisir une sous-station —</option>'
    + liste.map(s => `<option value="${esc(s.ref)}">${esc(s.ref)}</option>`).join('');
  sel.value = p2SstRef || '';
}

// Changement de SST depuis le <select> du bandeau
function onSSTChange() {
  const sel = document.getElementById('p2-sst-select');
  const ref = sel?.value || '';
  if (ref) {
    chargerDonneeSST(ref);
    if (window.currentProjectId) localStorage.setItem('flux_p2SstRef_' + window.currentProjectId, ref);
  } else {
    afficherEtatVide();
    if (window.currentProjectId) localStorage.removeItem('flux_p2SstRef_' + window.currentProjectId);
  }
}

// Ouvre une SST donnée dans le bandeau M2 (appelé aussi depuis bdd.js)
function chargerDonneeSST(ref) {
  const sst = (window.sousStations || []).find(s => s.ref === ref);
  if (!sst) { afficherEtatVide(); return; }
  p2SstRef = ref;
  const sel = document.getElementById('p2-sst-select');
  if (sel) sel.value = ref;
  renderBandeIdentite();
  chargerDonneesChauffageM2();
}

// Bandeau vide (aucune SST chargée, ou SST supprimée pendant qu'elle était ouverte)
function afficherEtatVide() {
  p2SstRef = null;
  const sel  = document.getElementById('p2-sst-select');
  const tag  = document.getElementById('p2-sst-tag');
  const l1   = document.getElementById('p2-sst-addr-line1');
  const l2   = document.getElementById('p2-sst-addr-line2');
  const tags = document.getElementById('p2-sst-tags');
  if (sel)  sel.value = '';
  if (tag)  tag.textContent  = '—';
  if (l1)   l1.textContent   = 'Aucune sous-station sélectionnée';
  if (l2)   l2.textContent   = 'Choisissez une SST dans la liste';
  if (tags) tags.innerHTML   = '';
  renderBandeHypotheses();
  chargerDonneesChauffageM2();
}

// Rend le bandeau d'identification (référence, adresse, pastilles) pour p2SstRef,
// selon l'état actif (Existant/Projeté, piloté par les onglets CH/ECS/Projeté)
function renderBandeIdentite() {
  const sst = (window.sousStations || []).find(s => s.ref === p2SstRef);
  if (!sst) { afficherEtatVide(); return; }

  const etatChoisi   = document.body.getAttribute('data-state') || 'existant';
  const etatEffectif = (etatChoisi === 'existant' && sst.hasExistant) ? 'existant'
                      : (etatChoisi === 'projete' && sst.hasProjete)  ? 'projete'
                      : (sst.hasExistant ? 'existant' : 'projete');
  const b = sst[etatEffectif] || {};

  const tag = document.getElementById('p2-sst-tag');
  if (tag) tag.textContent = sst.ref;

  const cpVille = [sst.cp, sst.ville].filter(Boolean).join(' ');
  const l1 = document.getElementById('p2-sst-addr-line1');
  if (l1) l1.textContent = [sst.adresse, cpVille].filter(Boolean).join(', ') || 'Adresse non renseignée';

  const sousLigne = [
    b.typeBatiment || null,
    b.nbLogements ? `${b.nbLogements} logements` : (b.sref != null ? `${b.sref.toLocaleString('fr-FR')} m²` : null),
  ].filter(Boolean).join(' · ');
  const l2 = document.getElementById('p2-sst-addr-line2');
  if (l2) l2.textContent = sousLigne || '—';

  const tags = document.getElementById('p2-sst-tags');
  if (tags) {
    tags.innerHTML = [
      b.typeSST         ? badgeTypeSst(b.typeSST)          : '',
      b.typeService     ? badgeType(b.typeService)         : '',
      sst.nature        ? badgeNature(sst.nature)          : '',
      b.energieActuelle ? badgeEnergie(b.energieActuelle)  : '',
    ].join('');
  }

  renderBandeHypotheses();
}

// ── Bande "Hypothèses générales & données Module 1" (repli sticky) ──────
// Climat/DJU/Régimes : toujours issus du Module 0 (projet). Données bâtiment :
// issues de la SST ouverte, avec pastille Mod.0 (hérité) ou Mod.1 (surchargé
// dans le formulaire SST) — même logique de résolution que le Module 1
// (getSSTHypParams, "sst" → Mod.1, "mod0"/"defaut" → Mod.0).
function _p2SetKv(id, value, unit, badge) {
  const el = document.getElementById(id);
  if (!el) return;
  if (value === null || value === undefined || value === '') {
    el.innerHTML = '<span style="color:var(--ink-4)">—</span>';
    return;
  }
  const unitHtml  = unit  ? `<span class="unit">${esc(unit)}</span>` : '';
  const badgeHtml = badge ? `<span class="mod-badge ${badge}">${badge === 'm1' ? 'Mod.1' : 'Mod.0'}</span>` : '';
  el.innerHTML = `${esc(String(value))}${unitHtml}${badgeHtml}`;
}

function renderBandeHypotheses() {
  const h = window.hypotheses || {};
  const fmt = (v, digits) => (v === null || v === undefined || v === '')
    ? null
    : Number(v).toLocaleString('fr-FR', digits !== undefined
        ? { minimumFractionDigits: digits, maximumFractionDigits: digits }
        : undefined);

  // Climat & DJU — paramètres projet, toujours Module 0
  _p2SetKv('p2h-t-ext-base', fmt(h.tExtBase), '°C', 'm0');
  _p2SetKv('p2h-t-coupure',  fmt(h.tCoupure),  '°C', 'm0');
  _p2SetKv('p2h-dju-ref',    fmt(h.djuRef),    '°C·j', 'm0');

  // Une ligne par année renseignée dans l'historique DJU du Module 0 (la plus
  // récente en premier) — reflète directement les ajouts/retraits faits en M0
  const djuAnneesEl = document.getElementById('p2h-dju-annees');
  if (djuAnneesEl) {
    const annees = (Array.isArray(h.djuHistorique) ? h.djuHistorique : [])
      .filter(r => r.annee != null && r.dju != null)
      .sort((a, b) => b.annee - a.annee);
    djuAnneesEl.innerHTML = annees.map(r =>
      `<div class="kv-row"><span class="k">DJU ${esc(String(r.annee))}</span><span class="v">${esc(fmt(r.dju))}<span class="unit">°C·j</span><span class="mod-badge m0">Mod.0</span></span></div>`
    ).join('');
  }

  const ecsDepRet = (h.tDepEcs != null && h.tRetEcs != null) ? `${fmt(h.tDepEcs)} / ${fmt(h.tRetEcs)}` : null;
  _p2SetKv('p2h-ecs-dep-ret',    ecsDepRet, '°C', 'm0');
  _p2SetKv('p2h-t-eau-froide',   fmt(h.tempEauFroideEcs), '°C', 'm0');
  _p2SetKv('p2h-t-puisage',      fmt(h.tPuisageEcs),      '°C', 'm0');
  _p2SetKv('p2h-t-ret-bouclage', fmt(h.tRetBouclageEcs),  '°C', 'm0');
  _p2SetKv('p2h-taux-bouclage',  fmt(h.ecsTauxBouclage),  '%',  'm0');
  _p2SetKv('p2h-t-dep-primaire', fmt(h.rchDepHiver),      '°C', 'm0');
  _p2SetKv('p2h-t-dep-primaire-ete', fmt(h.rchDepEte),    '°C', 'm0');
  _p2SetKv('p2h-pincement-ch',   fmt(h.pincementCh),      '°C', 'm0');
  _p2SetKv('p2h-pincement-ecs',  fmt(h.pincementEcs),     '°C', 'm0');

  // Bascule l'affichage d'une ligne conditionnelle (non pertinente pour toutes les SST)
  const toggleRow = (rowId, visible) => {
    const row = document.getElementById(rowId);
    if (row) row.style.display = visible ? '' : 'none';
  };

  // Données Module 1 — dépendent de la SST ouverte
  const sst = (window.sousStations || []).find(s => s.ref === p2SstRef);
  if (!sst) {
    ['p2h-type-batiment', 'p2h-sref', 'p2h-nblogements', 'p2h-ratio', 'p2h-interm', 'p2h-duree', 'p2h-pu-ecs', 'p2h-hpointe', 'p2h-besoin', 'p2h-pcs-gaz', 'p2h-pci-fioul']
      .forEach(id => _p2SetKv(id, null));
    toggleRow('p2h-nblogements-row', false);
    toggleRow('p2h-pcs-gaz-row', false);
    toggleRow('p2h-pci-fioul-row', false);
    return;
  }

  const etatChoisi   = document.body.getAttribute('data-state') || 'existant';
  const etatEffectif = (etatChoisi === 'existant' && sst.hasExistant) ? 'existant'
                      : (etatChoisi === 'projete' && sst.hasProjete)  ? 'projete'
                      : (sst.hasExistant ? 'existant' : 'projete');
  const b      = sst[etatEffectif] || {};
  const params = (typeof getSSTHypParams === 'function') ? getSSTHypParams(sst, etatEffectif) : {};
  const bat    = (typeof getHypoBatiment === 'function') ? (getHypoBatiment(b.typeBatiment) || {}) : {};

  // Philosophie : tout ce qui découle du type de bâtiment (choisi en Module 1)
  // s'affiche en Mod.1, que la valeur soit surchargée sur la SST ou héritée du
  // tableau Module 0 — seule la case "type de bâtiment" en Module 1 compte.
  _p2SetKv('p2h-type-batiment', b.typeBatiment || null, '', 'm1');
  _p2SetKv('p2h-sref', fmt(b.sref), 'm²', 'm1');

  toggleRow('p2h-nblogements-row', b.nbLogements != null);
  _p2SetKv('p2h-nblogements', fmt(b.nbLogements), '', 'm1');

  _p2SetKv('p2h-ratio',   fmt(params.ratio),     'W/m²', 'm1');
  _p2SetKv('p2h-interm',  fmt(params.interm, 2), '',     'm1');
  _p2SetKv('p2h-duree',   fmt(params.duree),     'h/an', 'm1');
  _p2SetKv('p2h-hpointe', fmt(params.hPointe),   'h',    'm1');
  _p2SetKv('p2h-pu-ecs',  fmt(params.puEcs, 2),  'kW',   'm1');
  _p2SetKv('p2h-besoin',  fmt(bat.besoin), bat.unitBesoin || '', 'm1');

  // PCS gaz / PCI fioul — paramètres projet (Module 0), pertinents selon
  // l'énergie actuelle de la SST (Module 1)
  toggleRow('p2h-pcs-gaz-row',   b.energieActuelle === 'Gaz');
  toggleRow('p2h-pci-fioul-row', b.energieActuelle === 'Fioul');
  _p2SetKv('p2h-pcs-gaz',   fmt(h.pcsGaz, 2),   'kWh/m³', 'm0');
  _p2SetKv('p2h-pci-fioul', fmt(h.pciFioul, 2), 'kWh/L',  'm0');
}

// ── Données chauffage (état Existant) — énergie actuelle, périmètre CH/CH+ECS,
// consommations historiques calées sur les années de l'historique DJU du
// Module 0 (pour garantir la paire conso/DJU nécessaire à la Méthode 1), et
// équipements existants. Persisté dans donneesP2[ref__existant] — l'énergie
// actuelle, elle, est écrite directement sur la SST (sst.existant.energieActuelle),
// affichée à la fois ici et sur le bandeau SST : une seule source de vérité.
function initDonneesChauffageM2() {
  document.querySelectorAll('.p2-energie-btn').forEach(btn => {
    btn.addEventListener('click', () => _p2SetEnergieActuelle(btn.dataset.energie));
  });

  document.querySelectorAll('.src-pill[data-perimetre]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.src-pill[data-perimetre]').forEach(b => b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'));
      const repartitionRow = document.getElementById('p2-repartition-row');
      if (repartitionRow) repartitionRow.style.display = btn.dataset.perimetre === 'ch_ecs' ? '' : 'none';
      _p2SauverDonneesChauffage();
    });
  });

  document.getElementById('p2-pct-ch')?.addEventListener('input', e => {
    const v = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
    const pctEcsEl = document.getElementById('p2-pct-ecs');
    if (pctEcsEl) pctEcsEl.value = (100 - v).toFixed(0);
    _p2SauverDonneesChauffage();
  });

  document.getElementById('p2-conso-annees')?.addEventListener('input', e => {
    if (e.target.matches('[data-conso-input]')) _p2SauverDonneesChauffage();
  });

  document.getElementById('p2-rendement-chaudiere')?.addEventListener('input', _p2SauverDonneesChauffage);

  document.getElementById('p2-nb-generateurs')?.addEventListener('input', () => {
    _p2RenderGenerateursUnitaires();
    _p2SauverDonneesChauffage();
  });
  document.getElementById('p2-puissance-totale')?.addEventListener('input', _p2SauverDonneesChauffage);
  document.getElementById('p2-generateurs-unitaires')?.addEventListener('input', e => {
    if (e.target.matches('[data-generateur-input]')) {
      _p2MajPuissanceTotaleDepuisUnitaires();
      _p2SauverDonneesChauffage();
    }
  });
}

// Clic sur une pastille Gaz/RCU/Fioul — met à jour l'énergie de la SST (Module 1
// et bandeau SST inclus), pas seulement l'affichage local de ce bloc
function _p2SetEnergieActuelle(energie) {
  const sst = (window.sousStations || []).find(s => s.ref === p2SstRef);
  if (!sst || !sst.existant) return;
  sst.existant.energieActuelle = energie;
  if (typeof saveCurrentProjectData === 'function') saveCurrentProjectData();
  _p2RenderEnergiePills(energie);
  _p2MajUniteConso();
  if (typeof renderBandeIdentite === 'function') renderBandeIdentite();
}

function _p2RenderEnergiePills(energieActive) {
  document.querySelectorAll('.p2-energie-btn').forEach(btn => {
    btn.classList.toggle('inactive', btn.dataset.energie !== energieActive);
  });
}

function _p2UniteConsoPourEnergie(energie) {
  return energie === 'Gaz' ? 'm³/an' : energie === 'Fioul' ? 'L/an' : 'MWh/an';
}

function _p2MajUniteConso() {
  const sst = (window.sousStations || []).find(s => s.ref === p2SstRef);
  const energie = (sst && sst.existant && sst.existant.energieActuelle) || '';
  const unite = _p2UniteConsoPourEnergie(energie);
  document.querySelectorAll('#p2-conso-annees [data-unit-label]').forEach(el => { el.textContent = unite; });
  return unite;
}

// Reconstruit la liste des lignes "Conso CH {année}" à partir de l'historique
// DJU du Module 0 — une ligne par année qui existe dans ce tableau
function _p2RenderConsoAnnees(consoParAnnee) {
  const container = document.getElementById('p2-conso-annees');
  if (!container) return;
  const h = window.hypotheses || {};
  const annees = (Array.isArray(h.djuHistorique) ? h.djuHistorique : [])
    .filter(r => r.annee != null)
    .sort((a, b) => b.annee - a.annee);

  if (!annees.length) {
    container.innerHTML = '<p class="field-hint">Aucune année dans l\'historique DJU (Module 0) — ajoutez-en pour saisir des consommations.</p>';
    return;
  }

  const sst = (window.sousStations || []).find(s => s.ref === p2SstRef);
  const energie = (sst && sst.existant && sst.existant.energieActuelle) || '';
  const uniteLabel = _p2UniteConsoPourEnergie(energie);

  container.innerHTML = annees.map(r => {
    const val = (consoParAnnee || {})[r.annee];
    const djuTxt = r.dju != null ? `${Number(r.dju).toLocaleString('fr-FR')} °C·j` : 'non renseigné';
    return `<div class="field-row cols-2">
      <div class="field">
        <span class="lbl">Conso CH ${esc(String(r.annee))}</span>
        <div class="input-group">
          <input type="number" class="input" data-conso-input data-annee="${esc(String(r.annee))}" placeholder="non renseigné" value="${val ?? ''}" />
          <span class="input-group-unit" data-unit-label>${esc(uniteLabel)}</span>
        </div>
      </div>
      <div class="field">
        <span class="lbl" style="color:var(--ink-3); font-weight:400;">DJU ${esc(String(r.annee))} (référence)</span>
        <div class="input empty"><span class="ph">${esc(djuTxt)}</span></div>
      </div>
    </div>`;
  }).join('');
}

// Génère les champs "Puissance générateur i" quand il y a plusieurs générateurs ;
// avec un seul générateur (ou aucun renseigné), un seul champ total suffit.
function _p2RenderGenerateursUnitaires(puissancesUnitaires) {
  const container = document.getElementById('p2-generateurs-unitaires');
  const totalField = document.getElementById('p2-puissance-totale-field');
  const totalInput = document.getElementById('p2-puissance-totale');
  const infoBadge  = document.getElementById('p2-generateurs-info-badge');
  if (!container) return;

  const nb = parseInt(document.getElementById('p2-nb-generateurs')?.value, 10) || 0;

  if (nb <= 1) {
    container.innerHTML = '';
    if (infoBadge) infoBadge.style.display = 'none';
    if (totalInput) totalInput.readOnly = false;
    return;
  }

  if (infoBadge) infoBadge.style.display = '';
  if (totalInput) totalInput.readOnly = true;

  const valeurs = puissancesUnitaires || [];
  container.innerHTML = `<div class="field-row cols-3" style="margin-top:8px;">` +
    Array.from({ length: nb }, (_, i) => `
      <div class="field">
        <span class="lbl opt">Puissance générateur ${i + 1}</span>
        <div class="input-group">
          <input type="number" class="input" data-generateur-input data-idx="${i}" min="0" step="1" placeholder="ex : 250" value="${valeurs[i] ?? ''}" />
          <span class="input-group-unit">kW</span>
        </div>
      </div>`).join('') +
    `</div>`;

  if (!totalField) return;
  _p2MajPuissanceTotaleDepuisUnitaires();
}

function _p2MajPuissanceTotaleDepuisUnitaires() {
  const totalInput = document.getElementById('p2-puissance-totale');
  if (!totalInput) return;
  const somme = Array.from(document.querySelectorAll('#p2-generateurs-unitaires [data-generateur-input]'))
    .reduce((acc, el) => acc + (parseFloat(el.value) || 0), 0);
  totalInput.value = somme || '';
}

// Charge le bloc "Données chauffage" pour la SST actuellement ouverte en M2
function chargerDonneesChauffageM2() {
  const sst = (window.sousStations || []).find(s => s.ref === p2SstRef);
  const d2  = sst ? ((window.donneesP2 || {})[sst.ref + '__existant'] || {}) : {};

  const energie = (sst && sst.existant && sst.existant.energieActuelle) || '';
  _p2RenderEnergiePills(energie);

  // Le bloc périmètre CH/CH+ECS n'a de sens que si la SST est de type CH+ECS
  const typeService = sst ? (sst.existant || {}).typeService : null;
  const estChEcs = typeService === 'CH+ECS';
  const perimetreSubhead = document.getElementById('p2-perimetre-subhead');
  const perimetreBlock   = document.getElementById('p2-perimetre-block');
  if (perimetreSubhead) perimetreSubhead.style.display = estChEcs ? '' : 'none';
  if (perimetreBlock)   perimetreBlock.style.display   = estChEcs ? '' : 'none';

  const perimetre = d2.perimetreConsoCh || 'ch';
  document.querySelectorAll('.src-pill[data-perimetre]').forEach(b => b.setAttribute('aria-pressed', b.dataset.perimetre === perimetre ? 'true' : 'false'));
  const repartitionRow = document.getElementById('p2-repartition-row');
  if (repartitionRow) repartitionRow.style.display = (estChEcs && perimetre === 'ch_ecs') ? '' : 'none';

  const pctCh = d2.pctChSurChEcs ?? 70;
  const pctChEl  = document.getElementById('p2-pct-ch');
  const pctEcsEl = document.getElementById('p2-pct-ecs');
  if (pctChEl)  pctChEl.value  = pctCh;
  if (pctEcsEl) pctEcsEl.value = 100 - pctCh;

  const rendementEl = document.getElementById('p2-rendement-chaudiere');
  if (rendementEl) rendementEl.value = d2.rendementChaudiere ?? 0.88;

  const nbGenerateursEl = document.getElementById('p2-nb-generateurs');
  if (nbGenerateursEl) nbGenerateursEl.value = d2.nbGenerateurs ?? '';
  _p2RenderGenerateursUnitaires(d2.puissancesGenerateurs);
  const totalInput = document.getElementById('p2-puissance-totale');
  if (totalInput && (d2.nbGenerateurs || 0) <= 1) totalInput.value = d2.puissanceTotaleChaudiere ?? '';

  _p2RenderConsoAnnees(d2.consoChParAnnee);
}

// Sauvegarde le bloc "Données chauffage" pour la SST actuellement ouverte
function _p2SauverDonneesChauffage() {
  const sst = (window.sousStations || []).find(s => s.ref === p2SstRef);
  if (!sst) return;
  const key = sst.ref + '__existant';
  if (!window.donneesP2) window.donneesP2 = {};
  if (!window.donneesP2[key]) window.donneesP2[key] = {};
  const d2 = window.donneesP2[key];

  const perimetreBtn = document.querySelector('.src-pill[data-perimetre][aria-pressed="true"]');
  d2.perimetreConsoCh = perimetreBtn ? perimetreBtn.dataset.perimetre : 'ch';
  d2.pctChSurChEcs = Math.min(100, Math.max(0, parseFloat(document.getElementById('p2-pct-ch')?.value) || 70));

  const rendement = parseFloat(document.getElementById('p2-rendement-chaudiere')?.value);
  d2.rendementChaudiere = isNaN(rendement) ? 0.88 : rendement;

  const consoParAnnee = {};
  document.querySelectorAll('#p2-conso-annees [data-conso-input]').forEach(input => {
    const v = parseFloat(input.value);
    if (!isNaN(v)) consoParAnnee[input.dataset.annee] = v;
  });
  d2.consoChParAnnee = consoParAnnee;

  const nb = parseInt(document.getElementById('p2-nb-generateurs')?.value, 10) || 0;
  d2.nbGenerateurs = nb || null;
  if (nb > 1) {
    d2.puissancesGenerateurs = Array.from(document.querySelectorAll('#p2-generateurs-unitaires [data-generateur-input]'))
      .map(el => { const v = parseFloat(el.value); return isNaN(v) ? null : v; });
    d2.puissanceTotaleChaudiere = null;
  } else {
    d2.puissancesGenerateurs = null;
    const totalV = parseFloat(document.getElementById('p2-puissance-totale')?.value);
    d2.puissanceTotaleChaudiere = isNaN(totalV) ? null : totalV;
  }

  if (typeof saveCurrentProjectData === 'function') saveCurrentProjectData();
}
