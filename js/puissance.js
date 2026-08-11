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
}
