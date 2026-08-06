// Replace Yes/No <select> elements with three-button groups (None, Y, N) on page load
(function(){
  function createYesNoForSelect(sel) {
    const opts = Array.from(sel.options || []).map(o => o.text.trim().toLowerCase());
    if (!(opts.includes('yes') && opts.includes('no'))) return false;

    const currentVal = sel.value || '';
    const id = sel.id || sel.name || ('yesno_' + Date.now() + '_' + Math.random().toString(36).slice(2,7));

    const span = document.createElement('span');
    span.className = 'ml-yesno';
    span.setAttribute('data-yesno-for', id);

    function makeBtn(label, v){
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.v = v;
      b.textContent = label;
      if (String(currentVal) === String(v)) b.classList.add('on');
      return b;
    }

    const noneBtn = makeBtn('None', '');
    const yesBtn = makeBtn('Y', 'Yes');
    const noBtn = makeBtn('N', 'No');
    const hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.id = id;
    // Preserve name attribute on the hidden input if the select had one
    if (sel.name) hidden.name = sel.name;
    hidden.value = currentVal;

    // Preserve disabled state
    if (sel.disabled) { noneBtn.disabled = true; yesBtn.disabled = true; noBtn.disabled = true; hidden.disabled = true; }

    span.appendChild(noneBtn);
    span.appendChild(yesBtn);
    span.appendChild(noBtn);
    span.appendChild(hidden);

    // Replace select with span in DOM
    sel.parentNode && sel.parentNode.replaceChild(span, sel);

    // Wiring: clicking toggles on/off, writes hidden value and dispatches input
    [noneBtn, yesBtn, noBtn].forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        const requested = btn.dataset.v;
        const next = btn.classList.contains('on') ? '' : requested;
        hidden.value = next;
        [noneBtn, yesBtn, noBtn].forEach(b => b.classList.toggle('on', b.dataset.v === next));
        hidden.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });

    return true;
  }

  function run() {
    document.querySelectorAll('select').forEach(sel => {
      try { createYesNoForSelect(sel); } catch (e) { console.error('yesno-replace failed for select', sel, e); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();