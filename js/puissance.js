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

  initConsommationsM2();
  initEquipementsM2();
  initDepartsM2();
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
  chargerConsommationsM2();
  chargerEquipementsM2();
  chargerDepartsM2();
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
  chargerConsommationsM2();
  chargerEquipementsM2();
  chargerDepartsM2();
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
    // État projeté : la SST est par définition raccordée au RCU (c'est
    // l'objet du projet), l'énergie actuelle (Gaz/Fioul/RCU) ne s'applique
    // qu'à l'état existant.
    const badgeEnergieHtml = etatEffectif === 'projete'
      ? badgeEnergie('RCU')
      : (b.energieActuelle ? badgeEnergie(b.energieActuelle) : '');
    tags.innerHTML = [
      b.typeSST         ? badgeTypeSst(b.typeSST)          : '',
      b.typeService     ? badgeType(b.typeService)         : '',
      sst.nature        ? badgeNature(sst.nature)          : '',
      badgeEnergieHtml,
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

// ── Consommations (commun CH + ECS) — énergie actuelle, périmètre Chauffage
// seul / ECS seul / Chauffage+ECS, consommations historiques calées sur les
// années de l'historique DJU du Module 0 (pour garantir la paire conso/DJU
// nécessaire aux Méthodes 1 CH et ECS). Bloc partagé, affiché une seule fois
// au-dessus des onglets CH/ECS — remplace l'ancien bloc "Énergie compteur
// d'énergie" (jamais câblé) de la carte ECS. Persisté dans
// donneesP2[ref__existant] — l'énergie actuelle, elle, est écrite directement
// sur la SST (sst.existant.energieActuelle), affichée à la fois ici et sur le
// bandeau SST : une seule source de vérité.
function initConsommationsM2() {
  document.querySelectorAll('.p2-energie-btn').forEach(btn => {
    btn.addEventListener('click', () => _p2SetEnergieActuelle(btn.dataset.energie));
  });

  document.querySelectorAll('.src-pill[data-perimetre]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.src-pill[data-perimetre]').forEach(b => b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'));
      const repartitionRow = document.getElementById('p2-repartition-row');
      if (repartitionRow) repartitionRow.style.display = btn.dataset.perimetre === 'ch_ecs' ? '' : 'none';
      _p2SauverConsommations();
    });
  });

  document.getElementById('p2-pct-ch')?.addEventListener('input', e => {
    const v = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
    const pctEcsEl = document.getElementById('p2-pct-ecs');
    if (pctEcsEl) pctEcsEl.value = (100 - v).toFixed(0);
    _p2SauverConsommations();
  });

  document.getElementById('p2-conso-annees')?.addEventListener('input', e => {
    if (e.target.matches('[data-conso-input], [data-conso-mwh-input]')) _p2SauverConsommations();
  });
}

// Clic sur une pastille Gaz/RCU/Fioul — met à jour l'énergie de la SST (Module 1
// et bandeau SST inclus), pas seulement l'affichage local de ce bloc
function _p2SetEnergieActuelle(energie) {
  const sst = (window.sousStations || []).find(s => s.ref === p2SstRef);
  if (!sst || !sst.existant) return;
  sst.existant.energieActuelle = energie;
  // La nature (Raccordement/Rénovation) dépend de l'énergie existante quand
  // la SST a aussi un état Projeté — la recalculer immédiatement plutôt que
  // d'attendre le prochain enregistrement du formulaire Module 1.
  if (typeof calculerNature === 'function') sst.nature = calculerNature(sst);
  if (typeof saveCurrentProjectData === 'function') saveCurrentProjectData();
  _p2RenderEnergiePills(energie);
  _p2MajUniteConso();
  _p2MajVisibilitePerimetre();
  _p2SauverConsommations();
  if (typeof renderBandeIdentite === 'function') renderBandeIdentite();
  if (typeof rendreTableau === 'function') rendreTableau();
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
  document.querySelectorAll('#p2-conso-annees [data-conso-label]').forEach(el => { el.textContent = _p2LabelConsoPrincipale(energie); });

  // Le MWh/an secondaire n'a de sens que pour le gaz et le fioul (équivalent
  // énergie d'une conso en m³/an ou L/an) — pas pour le RCU, déjà en MWh/an.
  const avecMwh = energie === 'Gaz' || energie === 'Fioul';
  document.querySelectorAll('#p2-conso-annees [data-conso-mwh-field]').forEach(field => {
    field.style.display = avecMwh ? '' : 'none';
    if (!avecMwh) { const inp = field.querySelector('[data-conso-mwh-input]'); if (inp) inp.value = ''; }
  });
  return unite;
}

// Reconstruit la liste des cartes "{année}" à partir de l'historique DJU du
// Module 0 — une carte par année qui existe dans ce tableau (même thème
// visuel que les cartes "Équipements existants"). Pour le gaz et le fioul,
// une valeur MWh/an secondaire (optionnelle) — l'équivalent énergie de la
// conso volumique relevée au compteur/à la livraison — complète l'unité
// principale.
// Libellé du relevé principal — distingue le relevé d'un compteur d'énergie
// (RCU, direct en MWh/an) du relevé volumique combustible (gaz au compteur
// en m³/an, fioul à la livraison/cuve en L/an).
function _p2LabelConsoPrincipale(energie) {
  if (energie === 'RCU')   return 'Consommation de chaleur (compteur d’énergie)';
  if (energie === 'Gaz')   return 'Consommation de gaz (compteur)';
  if (energie === 'Fioul') return 'Consommation de fioul (livraisons)';
  return 'Consommation';
}

function _p2RenderConsoAnnees(consoParAnnee, consoMwhParAnnee) {
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
  const labelPrincipal = _p2LabelConsoPrincipale(energie);
  const avecMwh = energie === 'Gaz' || energie === 'Fioul';

  container.innerHTML = annees.map(r => {
    const anneeStr = esc(String(r.annee));
    const val    = (consoParAnnee || {})[r.annee];
    const valMwh = (consoMwhParAnnee || {})[r.annee];
    return `<div class="p2-subcard p2-conso-card">
      <div class="p2-subcard-head">
        <span class="p2-subcard-title">${anneeStr}</span>
      </div>
      <div class="field-row cols-2">
        <div class="field">
          <span class="lbl" data-conso-label>${esc(labelPrincipal)}</span>
          <div class="input-group">
            <input type="number" class="input" data-conso-input data-annee="${anneeStr}" placeholder="non renseigné" value="${val ?? ''}" />
            <span class="input-group-unit" data-unit-label>${esc(uniteLabel)}</span>
          </div>
        </div>
        <div class="field" data-conso-mwh-field style="${avecMwh ? '' : 'display:none;'}">
          <span class="lbl opt">Équivalent énergie <span class="hint">MWh/an</span></span>
          <input type="number" class="input" data-conso-mwh-input data-annee="${anneeStr}" placeholder="si connu (ex. facture)" value="${valMwh ?? ''}" />
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── Équipements existants (commun CH + ECS) ──────────────────────────────
// Un ou plusieurs équipements (chaudière, échangeur, ballon, PAC…), chacun
// avec son propre type, son usage (Chauffage / ECS / Chauffage+ECS) et son
// rendement — un équipement mixte porte un rendement CH et un rendement ECS
// distincts. Remplace les anciens champs nbGenerateurs/puissancesGenerateurs/
// puissanceTotaleChaudiere (CH seul, dans "Données chauffage") et les champs
// ECS jamais câblés de la carte ECS. Bloc partagé, affiché une seule fois
// au-dessus des onglets CH/ECS. Persisté dans
// donneesP2[ref__existant].equipements — voir migration dans
// _migrateProjectData() (js/projects.js).
const P2_EQUIP_TYPES = [
  { value: 'chaudiere', label: 'Chaudière' },
  { value: 'echangeur', label: 'Échangeur' },
  { value: 'ballon',    label: 'Ballon' },
  { value: 'pac',       label: 'PAC' },
  { value: 'autre',     label: 'Autre' },
];

// Type par défaut d'un nouvel équipement, déduit de l'énergie actuelle de la
// SST (bandeau SST / Données chauffage) : RCU → échangeur, Gaz/Fioul → chaudière.
function _p2DefaultEquipType() {
  const sst = (window.sousStations || []).find(s => s.ref === p2SstRef);
  const energie = (sst && sst.existant && sst.existant.energieActuelle) || '';
  return energie === 'RCU' ? 'echangeur' : 'chaudiere';
}

function _p2EquipementCardHtml(eq, idx) {
  eq = eq || {};
  const type  = eq.type  || _p2DefaultEquipType();
  const usage = eq.usage || 'ch';
  const estChaudiere = type === 'chaudiere';
  const avecCh  = estChaudiere && (usage === 'ch'  || usage === 'ch_ecs');
  const avecEcs = estChaudiere && (usage === 'ecs' || usage === 'ch_ecs');
  const estBallon = type === 'ballon';
  return `<div class="p2-subcard p2-equip-card">
    <div class="p2-subcard-head">
      <span class="p2-subcard-title">Équipement ${idx + 1}</span>
      <button type="button" class="btn ghost sm p2-subcard-remove p2-equip-remove" title="Retirer cet équipement">✕</button>
    </div>
    <div class="field-row cols-4">
      <div class="field">
        <span class="lbl opt">Référence <span class="hint">identification</span></span>
        <input type="text" class="input p2-equip-label" placeholder="ex : Chaudière n°1" value="${esc(eq.label ?? '')}" />
      </div>
      <div class="field">
        <span class="lbl">Type</span>
        <select class="input p2-equip-type">
          ${P2_EQUIP_TYPES.map(t => `<option value="${t.value}" ${type === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <span class="lbl">Usage</span>
        <select class="input p2-equip-usage">
          <option value="ch"     ${usage === 'ch'     ? 'selected' : ''}>Chauffage</option>
          <option value="ecs"    ${usage === 'ecs'    ? 'selected' : ''}>ECS</option>
          <option value="ch_ecs" ${usage === 'ch_ecs' ? 'selected' : ''}>Mixte (CH + ECS)</option>
        </select>
      </div>
      <div class="field">
        <span class="lbl">Puissance unitaire <span class="hint">kW</span></span>
        <div class="input-group">
          <input type="number" class="input p2-equip-puissance" min="0" step="1" placeholder="ex : 250" value="${eq.puissance ?? ''}" />
          <span class="input-group-unit">kW</span>
        </div>
      </div>
    </div>
    <div class="field-row cols-4">
      <div class="field">
        <span class="lbl opt">Année de mise en service</span>
        <input type="number" class="input p2-equip-annee" min="1950" max="2100" step="1" placeholder="ex : 2010" value="${eq.anneeMES ?? ''}" />
      </div>
      <div class="field p2-equip-rend-ch-field" style="${avecCh ? '' : 'display:none;'}">
        <span class="lbl opt">Rendement CH <span class="hint">0–1</span></span>
        <input type="number" class="input p2-equip-rendement-ch" min="0" max="1" step="0.01" placeholder="ex : 0,88" value="${eq.rendementCh ?? ''}" />
      </div>
      <div class="field p2-equip-rend-ecs-field" style="${avecEcs ? '' : 'display:none;'}">
        <span class="lbl opt">Rendement ECS <span class="hint">0–1</span></span>
        <input type="number" class="input p2-equip-rendement-ecs" min="0" max="1" step="0.01" placeholder="ex : 0,88" value="${eq.rendementEcs ?? ''}" />
      </div>
      <div class="field p2-equip-volume-field" style="${estBallon ? '' : 'display:none;'}">
        <span class="lbl opt">Volume ballon <span class="hint">L</span></span>
        <input type="number" class="input p2-equip-volume" min="0" step="1" placeholder="ex : 1000" value="${eq.volumeBallon ?? ''}" />
      </div>
    </div>
  </div>`;
}

// Affiche toujours au moins une carte (vide si aucun équipement enregistré) —
// évite d'imposer un clic sur "+ Ajouter un équipement" avant de pouvoir saisir.
function renderEquipements(liste) {
  const container = document.getElementById('p2-equipements-liste');
  if (!container) return;
  const arr = Array.isArray(liste) && liste.length ? liste : [{}];
  container.innerHTML = arr.map(_p2EquipementCardHtml).join('');
}

// Lit les cartes actuellement affichées dans le formulaire (pas
// donneesP2, qui n'est mis à jour qu'à la sauvegarde)
function _lireEquipements() {
  const g = (card, sel) => { const v = parseFloat(card.querySelector(sel)?.value); return isNaN(v) ? null : v; };
  const t = (card, sel) => (card.querySelector(sel)?.value || '').trim();
  return Array.from(document.querySelectorAll('#p2-equipements-liste .p2-equip-card')).map(card => ({
    label:        t(card, '.p2-equip-label'),
    type:         card.querySelector('.p2-equip-type')?.value  || 'chaudiere',
    usage:        card.querySelector('.p2-equip-usage')?.value || 'ch',
    anneeMES:     g(card, '.p2-equip-annee'),
    puissance:    g(card, '.p2-equip-puissance'),
    rendementCh:  g(card, '.p2-equip-rendement-ch'),
    rendementEcs: g(card, '.p2-equip-rendement-ecs'),
    volumeBallon: g(card, '.p2-equip-volume'),
  })).filter(eq => eq.label || eq.puissance != null || eq.anneeMES != null || eq.rendementCh != null || eq.rendementEcs != null || eq.volumeBallon != null);
}

// Charge le bloc "Équipements existants" pour la SST actuellement ouverte en M2
function chargerEquipementsM2() {
  const sst = (window.sousStations || []).find(s => s.ref === p2SstRef);
  const d2  = sst ? ((window.donneesP2 || {})[sst.ref + '__existant'] || {}) : {};
  renderEquipements(d2.equipements);
}

// Sauvegarde le bloc "Équipements existants" pour la SST actuellement ouverte
function _p2SauverEquipements() {
  const sst = (window.sousStations || []).find(s => s.ref === p2SstRef);
  if (!sst) return;
  const key = sst.ref + '__existant';
  if (!window.donneesP2) window.donneesP2 = {};
  if (!window.donneesP2[key]) window.donneesP2[key] = {};
  window.donneesP2[key].equipements = _lireEquipements();
  if (typeof saveCurrentProjectData === 'function') saveCurrentProjectData();
}

// Renumérote les titres "Équipement N" après ajout/suppression
function _p2RenumeroterEquipements() {
  document.querySelectorAll('#p2-equipements-liste .p2-equip-card .p2-subcard-title').forEach((el, i) => {
    el.textContent = 'Équipement ' + (i + 1);
  });
}

// Recalcule la visibilité des champs conditionnels (rendements liés au type
// chaudière + à l'usage, volume ballon lié au type ballon) pour une carte donnée
function _p2RecomputeEquipCardVisibility(card) {
  const type  = card.querySelector('.p2-equip-type')?.value  || 'chaudiere';
  const usage = card.querySelector('.p2-equip-usage')?.value || 'ch';
  const estChaudiere = type === 'chaudiere';
  const avecCh  = estChaudiere && (usage === 'ch'  || usage === 'ch_ecs');
  const avecEcs = estChaudiere && (usage === 'ecs' || usage === 'ch_ecs');
  const estBallon = type === 'ballon';

  const rendChField  = card.querySelector('.p2-equip-rend-ch-field');
  const rendEcsField = card.querySelector('.p2-equip-rend-ecs-field');
  const volField     = card.querySelector('.p2-equip-volume-field');
  if (rendChField)  { rendChField.style.display  = avecCh  ? '' : 'none'; if (!avecCh)  card.querySelector('.p2-equip-rendement-ch').value  = ''; }
  if (rendEcsField) { rendEcsField.style.display = avecEcs ? '' : 'none'; if (!avecEcs) card.querySelector('.p2-equip-rendement-ecs').value = ''; }
  if (volField)     { volField.style.display     = estBallon ? '' : 'none'; if (!estBallon) card.querySelector('.p2-equip-volume').value    = ''; }
}

function initEquipementsM2() {
  document.getElementById('p2-equipement-ajouter')?.addEventListener('click', () => {
    const container = document.getElementById('p2-equipements-liste');
    if (!container) return;
    const idx = container.querySelectorAll('.p2-equip-card').length;
    container.insertAdjacentHTML('beforeend', _p2EquipementCardHtml({ type: _p2DefaultEquipType() }, idx));
    container.querySelector('.p2-equip-card:last-child .p2-equip-label')?.focus();
    _p2SauverEquipements();
  });

  document.getElementById('p2-equipements-liste')?.addEventListener('click', e => {
    const btn = e.target.closest('.p2-equip-remove');
    if (!btn) return;
    btn.closest('.p2-equip-card')?.remove();
    if (!document.querySelector('#p2-equipements-liste .p2-equip-card')) renderEquipements([]);
    else _p2RenumeroterEquipements();
    _p2SauverEquipements();
  });

  document.getElementById('p2-equipements-liste')?.addEventListener('change', e => {
    const card = e.target.closest('.p2-equip-card');
    if (!card) return;
    if (!e.target.matches('.p2-equip-usage, .p2-equip-type')) return;
    _p2RecomputeEquipCardVisibility(card);
    _p2SauverEquipements();
  });

  document.getElementById('p2-equipements-liste')?.addEventListener('input', e => {
    if (e.target.matches('.p2-equip-label, .p2-equip-puissance, .p2-equip-volume, .p2-equip-annee, .p2-equip-rendement-ch, .p2-equip-rendement-ecs')) {
      _p2SauverEquipements();
    }
  });
}

// ── Départs chauffage secondaires ────────────────────────────────────────
// Un ou plusieurs départs secondaires — DN, débit, loi d'eau (départ/retour),
// ΔT émetteur, régulation, émetteur. Champs de saisie libre, non branchés sur
// la table DN du module Référentiels ni sur un calcul hydraulique (portage
// futur). Alimente la Méthode 2B. Persisté dans
// donneesP2[ref__existant].departsCh.
function _p2DepartCardHtml(dep, idx) {
  dep = dep || {};
  return `<div class="p2-subcard p2-depart-card">
    <div class="p2-subcard-head">
      <span class="p2-subcard-title">Départ ${idx + 1}</span>
      <button type="button" class="btn ghost sm p2-subcard-remove p2-depart-remove" title="Retirer ce départ">✕</button>
    </div>
    <div class="field-row cols-4">
      <div class="field">
        <span class="lbl opt">Régulation</span>
        <input type="text" class="input p2-depart-regulation" placeholder="ex : Constant" value="${esc(dep.regulation ?? '')}" />
      </div>
      <div class="field">
        <span class="lbl opt">Émetteur</span>
        <input type="text" class="input p2-depart-emetteur" placeholder="ex : Radiateur" value="${esc(dep.emetteur ?? '')}" />
      </div>
      <div class="field">
        <span class="lbl opt">DN</span>
        <input type="text" class="input p2-depart-dn" placeholder="ex : DN25" value="${esc(dep.dn ?? '')}" />
      </div>
      <div class="field">
        <span class="lbl opt">Débit <span class="hint">m³/h</span></span>
        <input type="number" class="input p2-depart-debit" min="0" step="0.1" placeholder="ex : 1,0" value="${dep.debit ?? ''}" />
      </div>
    </div>
    <div class="field-row cols-4">
      <div class="field">
        <span class="lbl opt">T° départ <span class="hint">°C</span></span>
        <input type="number" class="input p2-depart-t-depart" min="0" max="120" step="1" placeholder="ex : 60" value="${dep.tDepart ?? ''}" />
      </div>
      <div class="field">
        <span class="lbl opt">T° retour <span class="hint">°C</span></span>
        <input type="number" class="input p2-depart-t-retour" min="0" max="120" step="1" placeholder="ex : 40" value="${dep.tRetour ?? ''}" />
      </div>
      <div class="field">
        <span class="lbl opt">ΔT émetteur <span class="hint">°C</span></span>
        <input type="number" class="input p2-depart-delta-t" min="0" max="60" step="1" placeholder="ex : 20" value="${dep.deltaTEmetteur ?? ''}" />
      </div>
      <div class="field"></div>
    </div>
  </div>`;
}

function renderDeparts(liste) {
  const container = document.getElementById('p2-departs-liste');
  if (!container) return;
  const arr = Array.isArray(liste) ? liste : [];
  container.innerHTML = arr.length
    ? arr.map(_p2DepartCardHtml).join('')
    : '<p class="p2-subcard-empty">Aucun départ enregistré pour l\'instant.</p>';
}

function _lireDeparts() {
  const g = (card, sel) => { const v = parseFloat(card.querySelector(sel)?.value); return isNaN(v) ? null : v; };
  const t = (card, sel) => (card.querySelector(sel)?.value || '').trim();
  return Array.from(document.querySelectorAll('#p2-departs-liste .p2-depart-card')).map(card => ({
    regulation:     t(card, '.p2-depart-regulation'),
    emetteur:       t(card, '.p2-depart-emetteur'),
    dn:             t(card, '.p2-depart-dn'),
    debit:          g(card, '.p2-depart-debit'),
    tDepart:        g(card, '.p2-depart-t-depart'),
    tRetour:        g(card, '.p2-depart-t-retour'),
    deltaTEmetteur: g(card, '.p2-depart-delta-t'),
  })).filter(d => d.regulation || d.emetteur || d.dn || d.debit != null || d.tDepart != null || d.tRetour != null || d.deltaTEmetteur != null);
}

function chargerDepartsM2() {
  const sst = (window.sousStations || []).find(s => s.ref === p2SstRef);
  const d2  = sst ? ((window.donneesP2 || {})[sst.ref + '__existant'] || {}) : {};
  renderDeparts(d2.departsCh);
}

function _p2SauverDeparts() {
  const sst = (window.sousStations || []).find(s => s.ref === p2SstRef);
  if (!sst) return;
  const key = sst.ref + '__existant';
  if (!window.donneesP2) window.donneesP2 = {};
  if (!window.donneesP2[key]) window.donneesP2[key] = {};
  window.donneesP2[key].departsCh = _lireDeparts();
  if (typeof saveCurrentProjectData === 'function') saveCurrentProjectData();
}

function _p2RenumeroterDeparts() {
  document.querySelectorAll('#p2-departs-liste .p2-depart-card .p2-subcard-title').forEach((el, i) => {
    el.textContent = 'Départ ' + (i + 1);
  });
}

function initDepartsM2() {
  document.getElementById('p2-depart-ajouter')?.addEventListener('click', () => {
    const container = document.getElementById('p2-departs-liste');
    if (!container) return;
    if (!container.querySelector('.p2-depart-card')) container.innerHTML = '';
    const idx = container.querySelectorAll('.p2-depart-card').length;
    container.insertAdjacentHTML('beforeend', _p2DepartCardHtml({}, idx));
    container.querySelector('.p2-depart-card:last-child .p2-depart-regulation')?.focus();
    _p2SauverDeparts();
  });

  document.getElementById('p2-departs-liste')?.addEventListener('click', e => {
    const btn = e.target.closest('.p2-depart-remove');
    if (!btn) return;
    btn.closest('.p2-depart-card')?.remove();
    if (!document.querySelector('#p2-departs-liste .p2-depart-card')) renderDeparts([]);
    else _p2RenumeroterDeparts();
    _p2SauverDeparts();
  });

  document.getElementById('p2-departs-liste')?.addEventListener('input', e => {
    if (e.target.matches('.p2-depart-regulation, .p2-depart-emetteur, .p2-depart-dn, .p2-depart-debit, .p2-depart-t-depart, .p2-depart-t-retour, .p2-depart-delta-t')) {
      _p2SauverDeparts();
    }
  });
}

// Affiche/masque le bloc périmètre (Chauffage seul / ECS seul / Chauffage+ECS)
// et le choix laissé ou non à l'utilisateur — n'a de sens que si la SST est de
// type CH+ECS. En gaz/fioul, chaudière/cuve commune par construction :
// périmètre forcé à "Chauffage + ECS", pas de choix proposé (seule la
// répartition % reste demandée). En RCU, la SST peut avoir des sous-compteurs
// séparés : le choix reste ouvert à l'utilisateur.
function _p2MajVisibilitePerimetre() {
  const sst = (window.sousStations || []).find(s => s.ref === p2SstRef);
  const d2  = sst ? ((window.donneesP2 || {})[sst.ref + '__existant'] || {}) : {};
  const energie = (sst && sst.existant && sst.existant.energieActuelle) || '';
  const typeService = sst ? (sst.existant || {}).typeService : null;
  const estChEcs = typeService === 'CH+ECS';
  const avecChoixPerimetre = estChEcs && energie === 'RCU';

  const perimetreSubhead   = document.getElementById('p2-perimetre-subhead');
  const perimetreBlock     = document.getElementById('p2-perimetre-block');
  const perimetrePills     = document.getElementById('p2-perimetre-pills');
  const perimetrePillsNote = document.getElementById('p2-perimetre-pills-note');
  const perimetreAutoNote  = document.getElementById('p2-perimetre-auto-note');
  if (perimetreSubhead) perimetreSubhead.style.display = estChEcs ? '' : 'none';
  if (perimetreBlock)   perimetreBlock.style.display   = estChEcs ? '' : 'none';
  if (perimetrePills)     perimetrePills.style.display     = avecChoixPerimetre ? '' : 'none';
  if (perimetrePillsNote) perimetrePillsNote.style.display = avecChoixPerimetre ? '' : 'none';
  if (perimetreAutoNote)  perimetreAutoNote.style.display  = (estChEcs && !avecChoixPerimetre) ? '' : 'none';

  const perimetre = avecChoixPerimetre ? (d2.perimetreConsoCh || 'ch') : 'ch_ecs';
  document.querySelectorAll('.src-pill[data-perimetre]').forEach(b => b.setAttribute('aria-pressed', b.dataset.perimetre === perimetre ? 'true' : 'false'));
  const repartitionRow = document.getElementById('p2-repartition-row');
  if (repartitionRow) repartitionRow.style.display = (estChEcs && perimetre === 'ch_ecs') ? '' : 'none';
}

// Charge le bloc "Consommations" pour la SST actuellement ouverte en M2
function chargerConsommationsM2() {
  const sst = (window.sousStations || []).find(s => s.ref === p2SstRef);
  const d2  = sst ? ((window.donneesP2 || {})[sst.ref + '__existant'] || {}) : {};

  const energie = (sst && sst.existant && sst.existant.energieActuelle) || '';
  _p2RenderEnergiePills(energie);
  _p2MajVisibilitePerimetre();

  const pctCh = d2.pctChSurChEcs ?? 70;
  const pctChEl  = document.getElementById('p2-pct-ch');
  const pctEcsEl = document.getElementById('p2-pct-ecs');
  if (pctChEl)  pctChEl.value  = pctCh;
  if (pctEcsEl) pctEcsEl.value = 100 - pctCh;

  _p2RenderConsoAnnees(d2.consoParAnnee, d2.consoMwhParAnnee);
}

// Sauvegarde le bloc "Consommations" pour la SST actuellement ouverte
function _p2SauverConsommations() {
  const sst = (window.sousStations || []).find(s => s.ref === p2SstRef);
  if (!sst) return;
  const key = sst.ref + '__existant';
  if (!window.donneesP2) window.donneesP2 = {};
  if (!window.donneesP2[key]) window.donneesP2[key] = {};
  const d2 = window.donneesP2[key];

  // Choix du périmètre laissé à l'utilisateur uniquement en RCU (sous-compteurs
  // CH/ECS potentiellement séparés) — en gaz/fioul, chaudière/cuve commune par
  // construction : périmètre effectif forcé à "Chauffage + ECS" à l'affichage
  // (voir chargerConsommationsM2/_p2MajVisibilitePerimetre), sans écraser le
  // choix RCU déjà enregistré si l'utilisateur revient dessus plus tard.
  const typeService = (sst.existant || {}).typeService;
  const estChEcs = typeService === 'CH+ECS';
  const energieActuelle = (sst.existant || {}).energieActuelle;
  const avecChoixPerimetre = estChEcs && energieActuelle === 'RCU';
  if (avecChoixPerimetre) {
    const perimetreBtn = document.querySelector('.src-pill[data-perimetre][aria-pressed="true"]');
    d2.perimetreConsoCh = perimetreBtn ? perimetreBtn.dataset.perimetre : 'ch';
  } else if (d2.perimetreConsoCh === undefined) {
    d2.perimetreConsoCh = estChEcs ? 'ch_ecs' : 'ch';
  }
  d2.pctChSurChEcs = Math.min(100, Math.max(0, parseFloat(document.getElementById('p2-pct-ch')?.value) || 70));

  const consoParAnnee = {};
  document.querySelectorAll('#p2-conso-annees [data-conso-input]').forEach(input => {
    const v = parseFloat(input.value);
    if (!isNaN(v)) consoParAnnee[input.dataset.annee] = v;
  });
  d2.consoParAnnee = consoParAnnee;

  const consoMwhParAnnee = {};
  document.querySelectorAll('#p2-conso-annees [data-conso-mwh-input]').forEach(input => {
    const v = parseFloat(input.value);
    if (!isNaN(v)) consoMwhParAnnee[input.dataset.annee] = v;
  });
  d2.consoMwhParAnnee = consoMwhParAnnee;

  if (typeof saveCurrentProjectData === 'function') saveCurrentProjectData();
}
