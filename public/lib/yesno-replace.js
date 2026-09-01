// Replace Yes/No <select> elements with three-button radio-like groups (None, Y, N) on page load
(function(){
  function focusButton(btn) { try { btn.focus(); } catch (e) {} }

  function createYesNoForSelect(sel) {
    const opts = Array.from(sel.options || []).map(o => o.text.trim().toLowerCase());
    if (!(opts.includes('yes') && opts.includes('no'))) return false;

    const currentVal = sel.value || '';
    const id = sel.id || sel.name || ('yesno_' + Date.now() + '_' + Math.random().toString(36).slice(2,7));

    const span = document.createElement('span');
    span.className = 'ml-yesno';
    span.setAttribute('data-yesno-for', id);
    // Which answer counts as "good" (colored green) varies by question -- e.g. "No
    // damages?" wants No=green, "Correct?" wants Yes=green. Mark it on the original
    // select with data-good="No"; defaults to Yes when not specified.
    span.setAttribute('data-good', sel.dataset.good === 'No' ? 'No' : 'Yes');
    span.setAttribute('role', 'radiogroup');

    function makeBtn(label, v, idx){
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.v = v;
      b.textContent = label;
      b.setAttribute('role','radio');
      // aria-checked reflects whether this matches currentVal
      const checked = String(currentVal) === String(v);
      b.setAttribute('aria-checked', checked ? 'true' : 'false');
      b.tabIndex = checked ? 0 : -1;
      return b;
    }

    const noneBtn = makeBtn('None', '', 0);
    const yesBtn = makeBtn('Y', 'Yes', 1);
    const noBtn = makeBtn('N', 'No', 2);
    const buttons = [noneBtn, yesBtn, noBtn];

    const hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.id = id;
    if (sel.name) hidden.name = sel.name;
    hidden.value = currentVal;

    if (sel.disabled) { buttons.forEach(b => b.disabled = true); hidden.disabled = true; }

    buttons.forEach(b => span.appendChild(b));
    span.appendChild(hidden);

    sel.parentNode && sel.parentNode.replaceChild(span, sel);

    function selectValue(v) {
      hidden.value = v;
      buttons.forEach(b => {
        const is = b.dataset.v === v;
        b.classList.toggle('on', is);
        b.setAttribute('aria-checked', is ? 'true' : 'false');
        b.tabIndex = is ? 0 : -1;
      });
      hidden.dispatchEvent(new Event('input', { bubbles: true }));
    }

    buttons.forEach((btn, i) => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        selectValue(btn.dataset.v);
      });

      btn.addEventListener('keydown', (ev) => {
        if (btn.disabled) return;
        const code = ev.key;
        let nextIndex = null;
        if (code === 'ArrowRight' || code === 'ArrowDown') nextIndex = (i + 1) % buttons.length;
        else if (code === 'ArrowLeft' || code === 'ArrowUp') nextIndex = (i - 1 + buttons.length) % buttons.length;
        else if (code === 'Home') nextIndex = 0;
        else if (code === 'End') nextIndex = buttons.length - 1;
        else if (code === 'Enter' || code === ' ' || code === 'Spacebar') { ev.preventDefault(); selectValue(btn.dataset.v); return; }
        if (nextIndex !== null) {
          ev.preventDefault();
          const nb = buttons[nextIndex];
          focusButton(nb);
          selectValue(nb.dataset.v);
        }
      });
    });

    return true;
  }

  function wireYesNo(root) {
    root = root || document;
    root.querySelectorAll('.ml-yesno').forEach(group => {
      if (group.getAttribute('data-yesno-wired')) return;
      group.setAttribute('role','radiogroup');
      const hidden = group.querySelector('input[type=hidden]');
      const buttons = Array.from(group.querySelectorAll('button'));
      const current = hidden ? String(hidden.value) : '';
      buttons.forEach((btn, i) => {
        btn.setAttribute('role','radio');
        const is = current === String(btn.dataset.v);
        btn.classList.toggle('on', is);
        btn.setAttribute('aria-checked', is ? 'true' : 'false');
        btn.tabIndex = is ? 0 : -1;

        btn.addEventListener('click', () => {
          if (btn.disabled) return;
          const v = btn.dataset.v;
          if (hidden) hidden.value = v;
          buttons.forEach(b => { const on = b.dataset.v === v; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; });
          if (hidden) hidden.dispatchEvent(new Event('input', { bubbles: true }));
        });

        btn.addEventListener('keydown', (ev) => {
          if (btn.disabled) return;
          const code = ev.key;
          let nextIndex = null;
          if (code === 'ArrowRight' || code === 'ArrowDown') nextIndex = (i + 1) % buttons.length;
          else if (code === 'ArrowLeft' || code === 'ArrowUp') nextIndex = (i - 1 + buttons.length) % buttons.length;
          else if (code === 'Home') nextIndex = 0;
          else if (code === 'End') nextIndex = buttons.length - 1;
          else if (code === 'Enter' || code === ' ' || code === 'Spacebar') { ev.preventDefault(); btn.click(); return; }
          if (nextIndex !== null) {
            ev.preventDefault();
            const nb = buttons[nextIndex];
            try { nb.focus(); } catch (e) {}
            nb.click();
          }
        });
      });
      group.setAttribute('data-yesno-wired', '1');
    });
  }

  // expose for other scripts to wire dynamically created content
  window.wireYesNo = wireYesNo;

  function run() {
    document.querySelectorAll('select').forEach(sel => {
      try { createYesNoForSelect(sel); } catch (e) { console.error('yesno-replace failed for select', sel, e); }
    });
    // wire any inlined groups now
    wireYesNo(document);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();