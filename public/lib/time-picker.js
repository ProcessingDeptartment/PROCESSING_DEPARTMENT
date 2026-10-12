/* Digital HH:MM time picker (no analog clock). Shared by form-record.js and monitoring-log.js.
   The widget keeps its value in a hidden text input carrying the field id, so save/validate/autofill code
   reads and sets it exactly as it did the native <input type="time">. External code that sets .value and
   dispatches 'input' (e.g. the "Now" button) also refreshes the spinners. */
(function () {
  'use strict';
  if (window.FRTimePicker) return;

  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const pad = n => String(n).padStart(2, '0');

  function html(id, value, readOnly) {
    const m = /^(\d{1,2}):(\d{1,2})/.exec(String(value || ''));
    const hh = m ? pad(+m[1]) : '', mm = m ? pad(+m[2]) : '';
    const ro = readOnly ? ' readonly disabled' : '';
    const unit = (part, cls, val, max, ph, label) =>
      `<span class="fr-time-unit">` +
      `<button type="button" class="fr-time-btn fr-time-up" data-part="${part}" tabindex="-1" aria-label="${label} up"${readOnly ? ' disabled' : ''}>▲</button>` +
      `<input type="number" class="${cls}" min="0" max="${max}" inputmode="numeric" value="${val}" placeholder="${ph}" aria-label="${label}"${ro}>` +
      `<button type="button" class="fr-time-btn fr-time-dn" data-part="${part}" tabindex="-1" aria-label="${label} down"${readOnly ? ' disabled' : ''}>▼</button>` +
      `</span>`;
    return `<span class="fr-time-picker" data-for="${esc(id)}">` +
      `<input type="text" id="${esc(id)}" value="${esc(value || '')}" class="fr-time-hidden" readonly tabindex="-1" aria-hidden="true">` +
      unit('h', 'fr-time-h', hh, 23, 'HH', 'Hours') + `<span class="fr-time-sep">:</span>` + unit('m', 'fr-time-m', mm, 59, 'MM', 'Minutes') +
      `</span>`;
  }

  const clamp = (v, max) => Math.min(max, Math.max(0, parseInt(v, 10) || 0));

  function parts(w) {
    return { hidden: w.querySelector('.fr-time-hidden'), h: w.querySelector('.fr-time-h'), m: w.querySelector('.fr-time-m') };
  }

  // spinners -> hidden
  function writeBack(w) {
    const p = parts(w);
    const h = p.h.value.trim(), m = p.m.value.trim();
    const v = (h === '' && m === '') ? '' : pad(clamp(h, 23)) + ':' + pad(clamp(m, 59));
    if (p.hidden.value === v) return;
    p.hidden.value = v;
    p.hidden.dispatchEvent(new Event('input', { bubbles: true }));
    p.hidden.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // hidden -> spinners (value set from outside)
  function syncFromHidden(w) {
    const p = parts(w);
    const mt = /^(\d{1,2}):(\d{1,2})/.exec(p.hidden.value || '');
    const h = mt ? pad(clamp(mt[1], 23)) : '', m = mt ? pad(clamp(mt[2], 59)) : '';
    const cur = (p.h.value.trim() === '' && p.m.value.trim() === '') ? '' : pad(clamp(p.h.value, 23)) + ':' + pad(clamp(p.m.value, 59));
    if (cur === (mt ? h + ':' + m : '')) return;
    p.h.value = h; p.m.value = m;
  }

  function install() {
    document.addEventListener('input', e => {
      const t = e.target;
      if (!t || !t.classList) return;
      const w = t.closest && t.closest('.fr-time-picker');
      if (!w) return;
      if (t.classList.contains('fr-time-hidden')) syncFromHidden(w);
      else writeBack(w);
    }, true);

    document.addEventListener('blur', e => {
      const t = e.target;
      if (!t || !t.classList || !(t.classList.contains('fr-time-h') || t.classList.contains('fr-time-m'))) return;
      if (t.value !== '') t.value = pad(clamp(t.value, t.classList.contains('fr-time-h') ? 23 : 59));
      writeBack(t.closest('.fr-time-picker'));
    }, true);

    document.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('.fr-time-btn');
      if (!b || b.disabled) return;
      const w = b.closest('.fr-time-picker');
      const p = parts(w);
      const isH = b.dataset.part === 'h';
      const inp = isH ? p.h : p.m;
      if (inp.disabled || inp.readOnly) return;
      const max = isH ? 23 : 59;
      const step = b.classList.contains('fr-time-up') ? 1 : -1;
      const cur = inp.value.trim() === '' ? (step > 0 ? -1 : max + 1) : parseInt(inp.value, 10) || 0;
      inp.value = pad((cur + step + max + 1) % (max + 1)); // wraps 23 -> 00, 59 -> 00
      if (isH && p.m.value.trim() === '') p.m.value = '00';
      if (!isH && p.h.value.trim() === '') p.h.value = '00';
      writeBack(w);
    });
  }

  window.FRTimePicker = { html: html };
  install();
})();
