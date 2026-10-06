// Photos on problem answers (REC 7.4.2 Dry Monitoring, config.imageUploadFields).
// Loaded on demand by monitoring-log.js. Images go to the API as compressed base64 data URIs
// (src/dry-monitoring-images.js); a failed upload is parked in localStorage and retried.
(function () {
  const PATH = '/api/dry-monitoring';
  const PENDING_PREFIX = 'draft_images_';
  const MAX_SIDE = 1280, Q1 = 0.82, Q2 = 0.65, RECOMPRESS_OVER = 900 * 1024, MAX_DATA = 2 * 1024 * 1024;

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function api() { return window.FacilityApi; }
  function base() { const a = api(); return (a && a.base && a.base()) || window.FACILITY_API_BASE || 'https://processing-department-api.onrender.com'; }
  function hdrs(json) { const a = api(); const h = json ? { 'Content-Type': 'application/json' } : {}; return a && a.headers ? a.headers(h) : h; }
  async function call(method, path, body) {
    const r = await fetch(base() + path, { method, headers: hdrs(!!body), body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) { let msg = ''; try { msg = (await r.json()).error || ''; } catch (e) {} const err = new Error(msg || ('HTTP ' + r.status)); err.status = r.status; throw err; }
    return r.status === 204 ? null : r.json();
  }
  function me() { try { const A = window.Auth; return (A && A.getCurrentUsername && A.getCurrentUsername()) || ''; } catch (e) { return ''; } }
  function when(ts) { const d = new Date(ts); return isNaN(d) ? '' : d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  function sizeOfDataUri(d) { return Math.round((d.length - d.indexOf(',') - 1) * 3 / 4); }

  /* ---- pending (failed) uploads, kept per submission+field ---- */
  function pendKey(sid, fk) { return PENDING_PREFIX + sid + '_' + fk; }
  function pendGet(sid, fk) { try { return JSON.parse(localStorage.getItem(pendKey(sid, fk)) || '[]'); } catch (e) { return []; } }
  function pendSet(sid, fk, list) { try { list.length ? localStorage.setItem(pendKey(sid, fk), JSON.stringify(list)) : localStorage.removeItem(pendKey(sid, fk)); } catch (e) {} }
  function pendingCount() {
    let n = 0;
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PENDING_PREFIX)) n += JSON.parse(localStorage.getItem(k) || '[]').length; } } catch (e) {}
    return n + inFlight;
  }
  let inFlight = 0;
  window.addEventListener('beforeunload', (ev) => {
    if (pendingCount()) { ev.preventDefault(); ev.returnValue = 'Some photos have not uploaded yet.'; return ev.returnValue; }
  });

  /* ---- compression ---- */
  function readAsDataUrl(file) {
    return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
  }
  function loadImg(src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  }
  async function compress(file) {
    const raw = await readAsDataUrl(file);
    let img;
    try { img = await loadImg(raw); } catch (e) {
      // the browser can't decode it (e.g. HEIC on most desktops): send as-is if small enough
      if (raw.length <= MAX_DATA) return { data: raw, mime: file.type || 'image/heic' };
      throw new Error('This photo format could not be read. Please take the photo as JPEG.');
    }
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
    let data = c.toDataURL('image/jpeg', Q1);
    if (sizeOfDataUri(data) > RECOMPRESS_OVER) data = c.toDataURL('image/jpeg', Q2);
    return { data, mime: 'image/jpeg' };
  }

  /* ---- styles ---- */
  const CSS = `
  .fr-image-block{margin:4px 0 10px;padding:8px 10px;border:1px solid #f0c9c5;border-left:4px solid #c0392b;border-radius:6px;background:#fff8f7;grid-column:1/-1}
  .fr-image-block[hidden]{display:none}
  .fr-image-block.fr-image-stale{border-color:#d6d9dc;border-left-color:#9aa3ab;background:#f6f7f8}
  .fr-image-block-header{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
  .fr-image-label{font:600 12.5px system-ui,sans-serif;color:#7a2018}
  .fr-image-stale .fr-image-label{color:#5b6670}
  .fr-image-add-btn{font:600 12.5px system-ui,sans-serif;padding:6px 12px;border-radius:6px;border:1px solid #c0392b;background:#fff;color:#c0392b;cursor:pointer;min-height:36px}
  .fr-image-add-btn[hidden]{display:none}
  .fr-image-thumbs{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
  .fr-image-thumbs:empty{display:none}
  .fr-image-thumb{position:relative;width:96px;font:11px system-ui,sans-serif;color:#6b747c}
  .fr-image-thumb img{width:80px;height:80px;object-fit:cover;border-radius:4px;border:1px solid #d6d9dc;display:block;background:#eee;cursor:zoom-in}
  .fr-image-stale .fr-image-thumb img{opacity:.55;filter:grayscale(.6)}
  .fr-image-thumb .fr-it-x{position:absolute;top:-6px;left:68px;width:22px;height:22px;border-radius:50%;border:1px solid #c0392b;background:#fff;color:#c0392b;font:700 13px/1 system-ui;cursor:pointer;padding:0;min-height:0;min-width:0;box-shadow:none}
  .fr-image-thumb .fr-it-cap{display:block;margin-top:3px;color:#2c3338;word-break:break-word;font-style:italic}
  .fr-image-thumb .fr-it-pen{border:0;background:none;cursor:pointer;padding:0 2px;font-size:12px;min-height:0;min-width:0;width:auto;height:auto;display:inline;box-shadow:none}
  .fr-image-thumb input{width:92px;font:11px system-ui;margin-top:3px}
  .fr-image-thumb .fr-it-state{position:absolute;top:28px;left:0;width:80px;text-align:center;font:600 10.5px system-ui;background:rgba(255,255,255,.85);padding:2px 0}
  .fr-image-thumb.fr-it-failed .fr-it-state{color:#fff;background:#c0392b;cursor:pointer;top:22px;padding:4px 2px}
  .fr-image-stale-note{font:11.5px system-ui;color:#5b6670;margin-top:4px}
  .fr-image-zoom{position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;z-index:99999;cursor:zoom-out}
  .fr-image-zoom img{max-width:95vw;max-height:92vh}
  @media print{
    .fr-image-block{display:none!important}
    .fr-print-photos{margin-top:4px;break-inside:avoid}
    .fr-print-photos-lbl{font-weight:700;font-size:9pt;margin:4px 0 2px}
    .fr-print-image-row{display:flex;gap:4mm;margin-bottom:3mm;break-inside:avoid}
    .fr-print-image-cell{width:6cm;max-width:48%}
    .fr-print-image-cell img{max-width:6cm;max-height:6cm;display:block}
    .fr-print-image-caption{font-size:8pt;font-style:italic}
    .fr-print-image-meta{font-size:7pt;color:#777}
  }`;
  function injectCss() {
    if (document.getElementById('fr-image-css')) return;
    const s = document.createElement('style'); s.id = 'fr-image-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  /* ---- one field's block ---- */
  function makeBlock(opts, f, toast) {
    const sid = opts.submissionId, locked = !!opts.locked;
    const wrap = document.createElement('div');
    wrap.className = 'fr-image-block'; wrap.dataset.fieldKey = f.key;
    wrap.innerHTML = `<div class="fr-image-block-header">
        <span class="fr-image-label">📷 Photos — attach evidence or corrective action</span>
        <button class="fr-image-add-btn" type="button">+ Add photo</button></div>
      <div class="fr-image-stale-note" hidden></div>
      <div class="fr-image-thumbs"></div>
      <input type="file" class="fr-image-file-input" accept="image/*" capture="environment" multiple style="display:none">`;
    const addBtn = wrap.querySelector('.fr-image-add-btn'), input = wrap.querySelector('input[type=file]');
    const thumbs = wrap.querySelector('.fr-image-thumbs'), staleNote = wrap.querySelector('.fr-image-stale-note');
    const hidden = document.getElementById(opts.ns + '_f_' + f.key);
    let count = 0;

    function refresh() {
      const v = hidden ? String(hidden.value || '') : '';
      const bad = v === f.bad;
      count = thumbs.children.length;
      wrap.hidden = !bad && !count;
      wrap.classList.toggle('fr-image-stale', !bad && count > 0);
      staleNote.hidden = bad || !count;
      staleNote.textContent = `Saved while answer was ${f.bad} — answer changed.`;
      addBtn.hidden = locked || !bad;
    }

    function thumb(img) {
      const t = document.createElement('div');
      t.className = 'fr-image-thumb';
      t.innerHTML = `<img alt="">${locked ? '' : '<button type="button" class="fr-it-x" title="Delete photo" aria-label="Delete photo">×</button>'}
        <span class="fr-it-cap"></span><div class="fr-it-meta"></div>`;
      t.querySelector('img').src = img.imageData;
      t.querySelector('img').addEventListener('click', () => {
        const z = document.createElement('div'); z.className = 'fr-image-zoom';
        z.innerHTML = '<img alt="">'; z.firstChild.src = img.imageData;
        z.addEventListener('click', () => z.remove()); document.body.appendChild(z);
      });
      paint(t, img);
      thumbs.appendChild(t);
      return t;
    }
    function paint(t, img) {
      t.dataset.id = img.id || '';
      const cap = t.querySelector('.fr-it-cap');
      cap.innerHTML = esc(img.caption || '') + (!locked && img.id ? ' <button type="button" class="fr-it-pen" title="Edit caption" aria-label="Edit caption">✎</button>' : '');
      t.querySelector('.fr-it-meta').textContent = img.uploadedBy || img.uploadedAt ? `${img.uploadedBy || ''}${img.uploadedBy ? ' · ' : ''}${when(img.uploadedAt)}` : '';
      const pen = cap.querySelector('.fr-it-pen');
      if (pen) pen.addEventListener('click', () => editCaption(t, img));
      const x = t.querySelector('.fr-it-x');
      if (x) x.onclick = () => remove(t, img);
    }
    function setState(t, text, failed, onRetry) {
      let s = t.querySelector('.fr-it-state');
      if (!text) { if (s) s.remove(); t.classList.remove('fr-it-failed'); return; }
      if (!s) { s = document.createElement('div'); s.className = 'fr-it-state'; t.appendChild(s); }
      s.textContent = text; t.classList.toggle('fr-it-failed', !!failed);
      s.onclick = failed && onRetry ? onRetry : null;
    }
    function editCaption(t, img) {
      const cap = t.querySelector('.fr-it-cap');
      const inp = document.createElement('input'); inp.type = 'text'; inp.maxLength = 500; inp.value = img.caption || ''; inp.placeholder = 'Caption';
      cap.replaceWith(inp); inp.focus();
      let done = false;
      const save = async () => {
        if (done) return; done = true;
        const caption = inp.value.trim();
        const span = document.createElement('span'); span.className = 'fr-it-cap'; inp.replaceWith(span);
        if (caption !== (img.caption || '')) {
          try { await call('PATCH', `${PATH}/images/${img.id}`, { caption }); img.caption = caption; }
          catch (e) { toast('Caption not saved — ' + e.message); }
        }
        paint(t, img);
      };
      inp.addEventListener('blur', save);
      inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); inp.blur(); } });
    }
    async function remove(t, img) {
      if (!img.id) { // a parked failed upload
        pendSet(sid, f.key, pendGet(sid, f.key).filter((p) => p.tmpId !== img.tmpId));
        t.remove(); refresh(); return;
      }
      if (!confirm('Delete this photo? This cannot be undone.')) return;
      try { await call('DELETE', `${PATH}/images/${img.id}`); t.remove(); refresh(); }
      catch (e) { toast(e.message || 'Could not delete the photo.'); }
    }
    async function upload(t, payload, tmpId) {
      setState(t, 'Uploading…'); inFlight++;
      try {
        const r = await call('POST', `${PATH}/${encodeURIComponent(sid)}/images`, payload);
        pendSet(sid, f.key, pendGet(sid, f.key).filter((p) => p.tmpId !== tmpId));
        setState(t, '');
        paint(t, { ...payload, ...r });
      } catch (e) {
        if (e.status && e.status >= 400 && e.status < 500) { // refused, retrying will not help
          pendSet(sid, f.key, pendGet(sid, f.key).filter((p) => p.tmpId !== tmpId));
          t.remove(); refresh(); toast(e.message || 'Photo refused.');
        } else {
          const list = pendGet(sid, f.key);
          if (!list.some((p) => p.tmpId === tmpId)) { list.push({ tmpId, payload }); pendSet(sid, f.key, list); }
          setState(t, 'Upload failed — tap to retry', true, () => upload(t, payload, tmpId));
          t._retry = () => upload(t, payload, tmpId);
        }
      } finally { inFlight--; }
    }

    addBtn.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const files = Array.from(input.files || []); input.value = '';
      if (thumbs.children.length + files.length > 10) { toast('Maximum 10 photos per check.'); return; }
      for (const file of files) {
        let c;
        try { c = await compress(file); } catch (e) { toast(e.message); continue; }
        const payload = { fieldKey: f.key, imageData: c.data, fileName: file.name, fileSizeBytes: file.size, mimeType: c.mime, caption: '', uploadedBy: me() };
        const tmpId = 'p' + Date.now() + Math.random().toString(36).slice(2, 6);
        const t = thumb({ imageData: c.data, uploadedBy: payload.uploadedBy, uploadedAt: Date.now() });
        refresh();
        upload(t, payload, tmpId);
      }
    });
    if (hidden) hidden.addEventListener('input', refresh);

    return {
      el: wrap, refresh,
      load(list) {
        (list || []).forEach((img) => thumb(img));
        pendGet(sid, f.key).forEach((p) => {
          const t = thumb({ ...p.payload, uploadedAt: Date.now() });
          setState(t, 'Upload failed — tap to retry', true, () => upload(t, p.payload, p.tmpId));
          t._retry = () => upload(t, p.payload, p.tmpId);
        });
        refresh();
      },
      retryAll() { Array.from(thumbs.children).forEach((t) => { if (t.classList.contains('fr-it-failed') && t._retry) t._retry(); }); },
    };
  }

  let activeBlocks = [];
  window.addEventListener('focus', () => activeBlocks.forEach((b) => b.retryAll()));

  // fields: [{ key, label, bad }]; the block goes right after each field's label element
  async function attach(container, opts) {
    injectCss();
    const toast = opts.toast || ((m) => alert(m));
    activeBlocks = [];
    const blocks = opts.fields.map((f) => {
      const anchor = container.querySelector(`[data-field="${f.key}"]`);
      if (!anchor) return null;
      const b = makeBlock(opts, f, toast);
      anchor.after(b.el);
      b.refresh();
      activeBlocks.push(b);
      return { f, b };
    }).filter(Boolean);
    let byField = {};
    try { byField = await call('GET', `${PATH}/${encodeURIComponent(opts.submissionId)}/images`); }
    catch (e) { console.warn('photos: could not load', e); }
    blocks.forEach(({ f, b }) => b.load(byField[f.key] || []));
  }

  let countCache = { at: 0, p: null };
  function counts(force) {
    if (force || !countCache.p || Date.now() - countCache.at > 30000) {
      countCache = { at: Date.now(), p: call('GET', `${PATH}/images/counts`).catch(() => ({})) };
    }
    return countCache.p;
  }

  // print block per field: { fieldKey: html }, "Photos:" omitted where there are none
  async function printBlocks(submissionId) {
    injectCss();
    let byField = {};
    try { byField = await call('GET', `${PATH}/${encodeURIComponent(submissionId)}/images`); } catch (e) { return {}; }
    const out = {};
    Object.keys(byField).forEach((k) => {
      const list = byField[k] || [];
      if (!list.length) return;
      const shown = list.slice(0, 6), rows = [];
      for (let i = 0; i < shown.length; i += 2) {
        rows.push('<div class="fr-print-image-row">' + shown.slice(i, i + 2).map((img) => `<div class="fr-print-image-cell">
          <img src="${esc(img.imageData)}" alt="">
          ${img.caption ? `<div class="fr-print-image-caption">${esc(img.caption)}</div>` : ''}
          <div class="fr-print-image-meta">${esc(img.uploadedBy || '')}${img.uploadedBy ? ' · ' : ''}${esc(when(img.uploadedAt))}</div></div>`).join('') + '</div>');
      }
      out[k] = `<div class="fr-print-photos"><div class="fr-print-photos-lbl">Photos:</div>${rows.join('')}${list.length > 6 ? `<div class="fr-print-image-meta">+ ${list.length - 6} more not printed</div>` : ''}</div>`;
    });
    return out;
  }

  // PDF grid of every photo on a job's checks. items: [{ id, label(fieldKey) }], oldest check first; each cell is
  // captioned with the date of the image and the check that failed. '' when there are no photos.
  async function printGrid(items, fmtDate) {
    const lists = await Promise.all(items.map((it) => call('GET', `${PATH}/${encodeURIComponent(it.id)}/images`).catch(() => ({}))));
    const day = (ts) => { const d = new Date(ts); if (isNaN(d)) return ''; const iso = d.toISOString().slice(0, 10); return fmtDate ? fmtDate(iso) : iso; };
    const cells = [];
    lists.forEach((byField, i) => Object.keys(byField || {}).forEach((k) => (byField[k] || []).forEach((img) => cells.push(
      `<div class="ph-cell"><img src="${esc(img.imageData)}" alt=""><div class="ph-cap">${esc(day(img.uploadedAt))} · ${esc(items[i].label(k))}</div>`
      + `${img.caption ? `<div class="ph-cap" style="font-weight:400;">${esc(img.caption)}</div>` : ''}</div>`))));
    return cells.length ? `<div class="dc-block"><div class="dc-bhead">Photos</div><div class="ph-grid">${cells.join('')}</div></div>` : '';
  }

  window.EntryPhotos = { attach, counts, printBlocks, printGrid };
})();
