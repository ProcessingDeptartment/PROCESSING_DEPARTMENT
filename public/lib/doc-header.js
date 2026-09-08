(function () {
  const KEY = k => 'doc_header:' + k;

  const FIELDS = ['document', 'docNumber', 'reviewedBy', 'approvedBy', 'effectiveDate'];


  const RESOLVED = {};


  const PAGE_SIDE_MARGIN = '12mm';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }


  function fmtDate(v) {
    if (!v) return '';
    let d;
    if (v instanceof Date) d = v;
    else if (typeof v === 'number') d = new Date(v);
    else if (/^\d{4}-\d{2}-\d{2}/.test(v)) d = new Date(v + 'T00:00:00');
    else return String(v);
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


  async function clearAutoStampedEffectiveDate(recordKey, stored) {
    const s = stored || await loadStored(recordKey);
    if (!s.effectiveDateSetAt) return s;
    delete s.effectiveDate;
    delete s.effectiveDateSetAt;
    await saveStored(recordKey, s);
    return s;
  }


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
      } catch (e) {  }
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


  function injectPrintHeaderStyles(side) {
    let s = document.getElementById('dh-print-header-styles');
    if (!s) {
      s = document.createElement('style');
      s.id = 'dh-print-header-styles';
    }
    s.textContent = `
      #dh-print-header{ display:none; }
      #dh-print-table{ display:none; }
      @media print{
        @page{
          margin:${side};
          @bottom-right{
            content:"Page " counter(page) " of " counter(pages);
            font-family:'Segoe UI',system-ui,sans-serif;
            font-size:10px;
            color:#4a4a4a;
          }
        }
        #dh-print-header{ display:block; }
        #dh-print-table{ display:table; width:100%; border-collapse:collapse; }
        #dh-print-table > thead > tr > td,
        #dh-print-table > tbody > tr > td{ padding:0; border:none; }
        #dh-print-table > thead{ display:table-header-group; }
      }
    `;
    document.head.appendChild(s);
  }


  function wrapForRepeatingHeader() {
    if (document.getElementById('dh-print-table')) return;

    if (document.body.hasAttribute('data-dh-skip-wrap')) return;
    const header = document.getElementById('dh-print-header');
    if (!header) return;

    const table = document.createElement('table');
    table.id = 'dh-print-table';
    const thead = document.createElement('thead');
    const theadRow = document.createElement('tr');
    const theadCell = document.createElement('td');
    const tbody = document.createElement('tbody');
    const tbodyRow = document.createElement('tr');
    const tbodyCell = document.createElement('td');


    theadCell.appendChild(header);
    theadRow.appendChild(theadCell);
    thead.appendChild(theadRow);


    Array.from(document.body.childNodes).forEach(node => tbodyCell.appendChild(node));
    tbodyRow.appendChild(tbodyCell);
    tbody.appendChild(tbodyRow);

    table.appendChild(thead);
    table.appendChild(tbody);
    document.body.appendChild(table);
  }


  function unwrapForRepeatingHeader() {
    const table = document.getElementById('dh-print-table');
    if (!table) return;

    const theadCell = table.tHead && table.tHead.rows[0] && table.tHead.rows[0].cells[0];
    const tbodyCell = table.tBodies[0] && table.tBodies[0].rows[0] && table.tBodies[0].rows[0].cells[0];
    const header = theadCell && theadCell.firstChild;
    const rest = tbodyCell ? Array.from(tbodyCell.childNodes) : [];

    table.remove();
    if (header) document.body.insertBefore(header, document.body.firstChild || null);
    rest.forEach(node => document.body.appendChild(node));
  }

  let printWrapWired = false;
  function wirePrintWrap() {
    if (printWrapWired) return;
    printWrapWired = true;
    window.addEventListener('beforeprint', wrapForRepeatingHeader);
    window.addEventListener('afterprint', unwrapForRepeatingHeader);
  }


  async function mountPrintHeader(opts) {
    opts = opts || {};

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
    wirePrintWrap();
    return h;
  }


  function current(recordKey) { return RESOLVED[recordKey] || null; }


  function badgeText(recordKey, fallbackRev) {
    const h = current(recordKey);
    const rev = h && h.revision !== '' && h.revision != null ? h.revision : (fallbackRev || 1);
    const date = h && h.revisionDate ? fmtDate(h.revisionDate) : null;
    return 'Rev ' + rev + ' · Rev date ' + (date || 'not set');
  }


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


  async function saveFieldsAll(recordKeys, fields) {
    const out = [];
    for (const key of recordKeys) {
      out.push({ recordKey: key, stored: await saveFields(key, fields) });
    }
    return out;
  }

  function blockHtml(h, page, pages, logoSrc) {
    h = h || {};
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
        <td class="dh-lbl">Revision Date:</td><td class="dh-val">${esc(fmtDate(h.revisionDate))}</td>
      </tr>
      <tr>
        <td class="dh-lbl">Effective Date:</td><td class="dh-val">${esc(fmtDate(h.effectiveDate))}</td>
        <td class="dh-lbl"></td><td class="dh-val"></td>
      </tr>
      <tr>
        <td class="dh-foot" colspan="5">Distribution approved as controlled copy</td>
      </tr>
    </tbody></table>`;
  }


  function injectStyles() {
    if (document.getElementById('dh-styles')) return;
    const s = document.createElement('style');
    s.id = 'dh-styles';
    s.textContent = `
      table.dh-block{ width:100%; border-collapse:collapse; table-layout:fixed;
        font-family:'Segoe UI',system-ui,sans-serif; color:#4a4a4a; margin-bottom:6px; }
      table.dh-block td{ border:1px solid #b9bcbe; padding:1px 5px; font-size:14px;
        line-height:1.35; vertical-align:middle; }
      table.dh-block td.dh-brand{ width:22%; text-align:center; padding:2px 6px; }
      table.dh-block td.dh-lbl{ width:13%; white-space:nowrap; }
      table.dh-block td.dh-val{ width:19%; color:#333; }
      table.dh-block td.dh-foot{ font-size:14px; }
      .dh-logo{ max-width:100%; max-height:34px; width:auto; height:auto; display:inline-block; }
      .dh-logo-text{ font-weight:700; letter-spacing:.22em; font-size:14px; color:#5a5a5a; }
      @media print{
        table.dh-block{ margin-bottom:5px; }
        table.dh-block td{ border:1px solid #999; font-size:14px; padding:0.5px 4px; line-height:1.3; }
        table.dh-block td.dh-foot{ font-size:14px; }
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
