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
}
