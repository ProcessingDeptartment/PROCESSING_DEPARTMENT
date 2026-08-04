/*
 * Controlled-copy title block -- the ABAGOLD document-control header that sits at the
 * top of every page of a printed record (see the paper REC forms).
 *
 * Three of its fields are NOT hand-typed, because a stale one on a printed controlled
 * copy is a document-control failure:
 *   Revision      -- live from document-revision.js
 *   Revision Date -- date that revision was published
 *   Effective Date-- the first date anyone worked with the document here. Written once,
 *                    on first use, then never moved. It is the date the document came
 *                    into effect, not the date of the latest revision -- on the paper
 *                    forms these two are years apart.
 *
 * The typed fields (document name, doc number, reviewed by, approved by) are edited in
 * ONE place: master-record-index.html. Records only ever read them.
 *
 * Backed by window.storage (data-store.js), keyed per record so any record can use it.
 */
(function () {
  const KEY = k => 'doc_header:' + k;

  const FIELDS = ['document', 'docNumber', 'reviewedBy', 'approvedBy'];

  /* Last resolved block per record. An on-screen revision badge must state exactly what
   * the printed copy states, so it reads the resolved block rather than resolving the
   * revision a second time down a slightly different path -- which is how the badge came
   * to print "Rev date not set" beside a block carrying the real date. */
  const RESOLVED = {};

  /* The one page margin every record prints at. Records used to each pick
   * their own (6mm, 9mm, 10mm, 12mm), so no two printed forms lined up. Anything that
   * writes its own @page uses this, and nothing overrides it per record. */
  const PAGE_SIDE_MARGIN = '12mm';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // dd/mm/yyyy -- the format the paper forms use. Accepts a Date, ms, or YYYY-MM-DD.
  function fmtDate(v) {
    if (!v) return '';
    let d;
    if (v instanceof Date) d = v;
    else if (typeof v === 'number') d = new Date(v);
    else if (/^\d{4}-\d{2}-\d{2}/.test(v)) d = new Date(v + 'T00:00:00');
    else return String(v); // already dd/mm/yyyy or free text -- pass through untouched
    if (isNaN(d)) return String(v);
    return String(d.getDate()).padStart(2, '0') + '/' +
           String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  }

  async function loadStored(recordKey) {
    try {
      const raw = await window.storage.get(KEY(recordKey), true);
      return raw ? JSON.parse(raw.value) : {};
    } catch (e) { return {}; }
  }

  async function saveStored(recordKey, obj) {
    try {
      await window.storage.set(KEY(recordKey), JSON.stringify(obj), true);
      return true;
    } catch (e) { console.error('doc header save failed', e); return false; }
  }

  /* Effective date = the date the document came into effect, which on these forms is
   * years before the current revision. Nothing the app knows carries it: the Master Index
   * List holds revision dates, not effective dates.
   *
   * So it is never invented. This used to stamp today's date on first view, which printed
   * "Effective Date: 2026" on documents in effect since 2020 -- and because the value is
   * claimed once and never moved, that wrong date would have stuck. The cell prints blank
   * until someone records the real one, which is the same call document-revision.js makes
   * about an unknown revision date.
   *
   * Clears what the old auto-stamp already wrote. Those are identifiable: effectiveDateSetAt
   * was only ever set by the auto-stamp, so a value carrying it was invented, not recorded. */
  async function clearAutoStampedEffectiveDate(recordKey, stored) {
    const s = stored || await loadStored(recordKey);
    if (!s.effectiveDateSetAt) return s;
    delete s.effectiveDate;
    delete s.effectiveDateSetAt;
    await saveStored(recordKey, s);
    return s;
  }

  /* Everything the block needs, resolved. `defaults` supplies the paper baseline for
   * fields nobody has edited yet (typically from master-index-data.js).
   * `revisionStartAt` is the paper revision to fall back on before any online bump. */
  async function resolve(recordKey, defaults, revisionStartAt) {
    defaults = defaults || {};
    let stored = await loadStored(recordKey);
    stored = await clearAutoStampedEffectiveDate(recordKey, stored);

    let revision = revisionStartAt;
    let revisionDate = defaults.revisionDate || '';
    if (window.DocumentRevision) {
      try {
        revision = await window.DocumentRevision.getCurrent(recordKey, revisionStartAt);
        const d = await window.DocumentRevision.getCurrentDate(recordKey, null);
        if (d) revisionDate = d;
      } catch (e) { /* fall back to the paper baseline rather than print nothing */ }
    }

    const out = {
      document: stored.document || defaults.document || '',
      docNumber: stored.docNumber || defaults.docNumber || '',
      reviewedBy: stored.reviewedBy || defaults.reviewedBy || '',
      approvedBy: stored.approvedBy || defaults.approvedBy || '',
      effectiveDate: stored.effectiveDate || '',
      revision: revision == null ? '' : revision,
      revisionDate: revisionDate
    };
    return out;
  }

  /* The paper baseline for a record, read from the issued Master Index List instead of
   * being hand-copied into each of the 140-odd record pages -- one transcription, one
   * place to correct. `fallback` wins where the index has nothing, so a record can still
   * name itself before it earns a row. Reviewed/approved by are document-control roles
   * carried once on the index header, identical for every row. */
  function defaultsFor(recordKey, fallback) {
    const out = Object.assign({}, fallback || {});
    const mi = window.MasterIndexData;
    if (!mi) return out;
    const row = indexRow(recordKey);
    if (row) {
      if (!out.document) out.document = row.name || '';
      if (!out.docNumber) out.docNumber = row.docNo || '';
      if (!out.revisionDate) out.revisionDate = row.dateOfIssue || '';
    }
    const hdr = mi.header || {};
    if (!out.reviewedBy) out.reviewedBy = hdr.reviewedBy || '';
    if (!out.approvedBy) out.approvedBy = hdr.approvedBy || '';
    return out;
  }

  function indexRow(recordKey) {
    const mi = window.MasterIndexData;
    if (!mi) return null;
    return (mi.rows || []).filter(r => r.recordKey === recordKey)[0] || null;
  }

  function indexRevision(recordKey) {
    const row = indexRow(recordKey);
    return row && row.revision != null ? row.revision : 1;
  }

  /* Print the block once, in normal document flow, ahead of everything else on the page.
   *
   * This used to park the block in a position:fixed strip reserved by an @page top margin,
   * repainted once per printed page. That's the textbook trick for a repeating print header
   * and it works in a plain browser print dialog -- but the PDFs this app actually produces
   * come out of a renderer where position:fixed does not repeat per page; it gets placed
   * once using the *whole tall document's* flow coordinates, which is why the block was
   * showing up mid-document (over the sign-off section on REC-7.1.2) instead of at the top
   * of page 1. An in-flow block is the only placement every renderer agrees on, so that's
   * the trade made here: it prints once at the very top of the document rather than
   * repeating on every page. */
  function injectPrintHeaderStyles(side) {
    let s = document.getElementById('dh-print-header-styles');
    if (!s) {
      s = document.createElement('style');
      s.id = 'dh-print-header-styles';
    }
    s.textContent = `
      #dh-print-header{ display:none; }
      @media print{
        @page{ margin:${side}; }
        #dh-print-header{ display:block; }
      }
    `;
    document.head.appendChild(s); // moves it to the end if it was already there
  }

  /* Put the controlled-copy block on every printed page of the calling record.
   * Every record reaches the block through here -- the two shared engines (form-record.js,
   * monitoring-log.js) call it for the records they drive, and the hand-built records call
   * it themselves. blockHtml is only for a caller that lays out its own print pages and can
   * therefore number them; nothing does that today, so a record that skips this call simply
   * prints no title block at all.
   *
   * The Page cell is left blank here on purpose: CSS exposes no page count to an element
   * outside the @page margin boxes, and a wrong page number on a controlled copy is worse
   * than an empty one. */
  async function mountPrintHeader(opts) {
    opts = opts || {};
    // A caller that doesn't state its paper revision gets the one off the index row, so
    // records without their own baseline constant still fall back to paper, not to 1.
    const revisionStart = opts.revisionStart != null
      ? opts.revisionStart : indexRevision(opts.recordKey);
    const h = await resolve(opts.recordKey,
      defaultsFor(opts.recordKey, opts.defaults), revisionStart);
    injectStyles();
    injectPrintHeaderStyles(PAGE_SIDE_MARGIN);
    let host = document.getElementById('dh-print-header');
    if (!host) {
      host = document.createElement('div');
      host.id = 'dh-print-header';
      document.body.insertBefore(host, document.body.firstChild);
    }
    host.innerHTML = blockHtml(h, null, null, opts.logoSrc || '../assets/abagold-logo.png');
    RESOLVED[opts.recordKey] = h;
    return h;
  }

  /* The resolved block for a record, or null before it has mounted. Anything displaying
   * a revision on screen reads this instead of resolving its own. */
  function current(recordKey) { return RESOLVED[recordKey] || null; }

  /* "Rev 2 · Rev date 20/04/2020" -- the one wording, so every engine's badge matches. */
  function badgeText(recordKey, fallbackRev) {
    const h = current(recordKey);
    const rev = h && h.revision !== '' && h.revision != null ? h.revision : (fallbackRev || 1);
    const date = h && h.revisionDate ? fmtDate(h.revisionDate) : null;
    return 'Rev ' + rev + ' · Rev date ' + (date || 'not set');
  }

  // Persist only the typed fields; the automatic three are never accepted from a form.
  async function saveFields(recordKey, fields) {
    const stored = await loadStored(recordKey);
    FIELDS.forEach(f => {
      if (fields[f] !== undefined) stored[f] = String(fields[f] || '').trim();
    });
    stored.updatedAt = Date.now();
    const ok = await saveStored(recordKey, stored);
    if (!ok) throw new Error('Could not save the header — please retry.');
    return stored;
  }

  /* Same fields, written to every record in `recordKeys`. Reviewed/approved by are
   * document-control roles that usually change for the whole index at once (a new QA
   * manager, say), not one record at a time -- this is the bulk path master-record-index
   * uses instead of looping saveFields itself. Sequential, not Promise.all: each is a
   * write to shared storage and a stray failure should stop at a known point, not fire
   * every remaining write anyway. */
  async function saveFieldsAll(recordKeys, fields) {
    const out = [];
    for (const key of recordKeys) {
      out.push({ recordKey: key, stored: await saveFields(key, fields) });
    }
    return out;
  }

  /* One page's title block. `page`/`pages` produce the "1 of 3" cell; omit them and the
   * cell is left blank rather than printing a wrong number. `logoSrc` is relative to the
   * calling page. */
  function blockHtml(h, page, pages, logoSrc) {
    h = h || {};
    const pageText = (page && pages) ? (page + ' of ' + pages) : '';
    const logo = logoSrc
      ? `<img class="dh-logo" src="${esc(logoSrc)}" alt="Abagold">`
      : `<span class="dh-logo-text">ABAGOLD</span>`;
    return `<table class="dh-block"><tbody>
      <tr>
        <td class="dh-brand" rowspan="4">${logo}</td>
        <td class="dh-lbl">Document:</td><td class="dh-val">${esc(h.document)}</td>
        <td class="dh-lbl">Doc number:</td><td class="dh-val">${esc(h.docNumber)}</td>
      </tr>
      <tr>
        <td class="dh-lbl">Reviewed by:</td><td class="dh-val">${esc(h.reviewedBy)}</td>
        <td class="dh-lbl">Revision:</td><td class="dh-val">${esc(h.revision)}</td>
      </tr>
      <tr>
        <td class="dh-lbl">Approved by:</td><td class="dh-val">${esc(h.approvedBy)}</td>
        <td class="dh-lbl">Page</td><td class="dh-val">${esc(pageText)}</td>
      </tr>
      <tr>
        <td class="dh-lbl">Effective Date:</td><td class="dh-val">${esc(fmtDate(h.effectiveDate))}</td>
        <td class="dh-lbl">Revision Date:</td><td class="dh-val">${esc(fmtDate(h.revisionDate))}</td>
      </tr>
      <tr>
        <td class="dh-foot" colspan="5">Distribution approved as controlled copy</td>
      </tr>
    </tbody></table>`;
  }

  /* Injected rather than shipped as a stylesheet so a record only has to include this
   * one script. Sized for print: the block has to repeat on every page without pushing
   * a record onto an extra one. */
  function injectStyles() {
    if (document.getElementById('dh-styles')) return;
    const s = document.createElement('style');
    s.id = 'dh-styles';
    s.textContent = `
      table.dh-block{ width:100%; border-collapse:collapse; table-layout:fixed;
        font-family:'Segoe UI',system-ui,sans-serif; color:#4a4a4a; margin-bottom:6px; }
      table.dh-block td{ border:1px solid #b9bcbe; padding:1px 5px; font-size:9px;
        line-height:1.35; vertical-align:middle; }
      table.dh-block td.dh-brand{ width:22%; text-align:center; padding:2px 6px; }
      table.dh-block td.dh-lbl{ width:13%; white-space:nowrap; }
      table.dh-block td.dh-val{ width:19%; color:#333; }
      table.dh-block td.dh-foot{ font-size:8.5px; }
      .dh-logo{ max-width:100%; max-height:34px; width:auto; height:auto; display:inline-block; }
      .dh-logo-text{ font-weight:700; letter-spacing:.22em; font-size:12px; color:#5a5a5a; }
      @media print{
        table.dh-block{ margin-bottom:5px; }
        table.dh-block td{ border:1px solid #999; font-size:8px; padding:0.5px 4px; line-height:1.3; }
        table.dh-block td.dh-foot{ font-size:7.5px; }
        .dh-logo{ max-height:26px; }
      }
    `;
    document.head.appendChild(s);
  }

  window.DocHeader = {
    FIELDS, resolve, saveFields, saveFieldsAll, clearAutoStampedEffectiveDate, blockHtml, injectStyles, fmtDate,
    defaultsFor, mountPrintHeader, PAGE_SIDE_MARGIN,
    current, badgeText,
    load: loadStored
  };
})();
