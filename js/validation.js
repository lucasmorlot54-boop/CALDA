// ── Validation visuelle inline ──────────────────────────────────────────────
// Helpers globaux réutilisables par tous les formulaires CALDA.
// Chaque champ en erreur reçoit .field-error (bordure rouge) + un span
// .field-error-msg inséré après lui. L'erreur s'efface à la frappe.

function setFieldError(idOrEl, message) {
  const el = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
  if (!el) return;
  clearFieldError(el);
  el.classList.add('field-error');
  let span = el.parentElement.querySelector('.field-error-msg');
  if (!span) {
    span = document.createElement('span');
    span.className = 'field-error-msg';
    el.insertAdjacentElement('afterend', span);
  }
  span.textContent = message;
  const ac = new AbortController();
  el._fieldErrorAbortCtrl = ac;
  const evtType = el.tagName === 'SELECT' ? 'change' : 'input';
  el.addEventListener(evtType, () => clearFieldError(el), { signal: ac.signal, once: true });
}

function clearFieldError(idOrEl) {
  const el = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
  if (!el) return;
  el.classList.remove('field-error');
  const span = el.parentElement?.querySelector('.field-error-msg');
  if (span) span.remove();
  if (el._fieldErrorAbortCtrl) {
    el._fieldErrorAbortCtrl.abort();
    el._fieldErrorAbortCtrl = null;
  }
}

function clearAllErrors(containerEl) {
  containerEl.querySelectorAll('.field-error').forEach(el => clearFieldError(el));
  containerEl.querySelectorAll('.field-error-msg').forEach(span => span.remove());
}

function focusFirstError(containerEl) {
  const first = containerEl.querySelector('.field-error');
  if (!first) return;
  first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  first.focus();
}
