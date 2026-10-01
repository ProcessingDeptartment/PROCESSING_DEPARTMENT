// REC 8.1.7 Mock recall: once a job number is chosen, list every box (bin) that job's stock went
// into, with the other jobs in each box and the REC 7.4.5 inspection. Read-only and live: it reads
// GET /api/recall/job/:job/boxes (stock_link joined to closed_box). Box code = bin code.
// Loads after form-record.js; the form renders asynchronously, so wait for the Job no. input.
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let panel = null, lastJob = null, seq = 0, tries = 0;

  function jobInput() { return document.getElementById('fr_f_jobNo'); }

  function ensurePanel(input) {
    if (panel && document.body.contains(panel)) return panel;
    panel = document.createElement('section');
    panel.id = 'recallBoxes';
    panel.className = 'fr-section';
    panel.style.cssText = 'margin:16px 0;padding:12px 16px;border:1px solid #cbd5e1;border-radius:8px';
    const anchor = input.closest('.fr-section, section, fieldset') || input.parentElement;
    anchor.insertAdjacentElement('afterend', panel);
    return panel;
  }

  // Two states only: a 7.4.5 inspection that passed is "Approved"; anything else is "Not inspected".
  const result = (i) => ({ text: i && i.approved ? 'Approved' : 'Not inspected' });

  function render(p, job, data) {
    const stamp = new Date(data.generatedAt).toLocaleString('en-ZA');
    const rows = data.boxes.map((b) => `<tr>
      <td><b>${esc(b.boxCode)}</b>${b.fromDraft ? ' <small>(from draft)</small>' : ''}</td>
      <td>${esc(b.state === 'closed' ? 'Closed box' : 'Open bin (stock still in bin)')}</td>
      <td>${esc(b.sizeGrade || '')}</td>
      <td style="text-align:right">${b.nettKg == null ? '' : esc(Number(b.nettKg).toFixed(2))}</td>
      <td>${esc(b.jobs.join(', '))}${b.jobs.length > 1 ? ' <small>(blended)</small>' : ''}</td>
      <td>${esc(result(b.inspection).text)}${b.inspection && b.inspection.changedAfterInspection ? ' <small>(box changed after inspection)</small>' : ''}</td>
      <td>${b.inspection && b.inspection.packingDate ? esc(String(b.inspection.packingDate).slice(0, 10)) : ''}</td></tr>`).join('');
    p.innerHTML = `<h3 style="margin:0 0 4px">Boxes containing job ${esc(job)}</h3>
      <p style="margin:0 0 8px;font-size:.85em;color:#475569">${data.count} box${data.count === 1 ? '' : 'es'} / bin${data.count === 1 ? '' : 's'} found &middot; generated ${esc(stamp)} &middot; live from REC 7.4.3, 7.4.5 records</p>
      ${data.count ? `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.9em">
        <thead><tr style="text-align:left;border-bottom:2px solid #cbd5e1"><th>Box code</th><th>Status</th><th>Size grade</th><th>Nett kg</th><th>Jobs in box</th><th>Inspection</th><th>Packing date</th></tr></thead>
        <tbody>${rows}</tbody></table></div>`
        : '<p><b>No boxes found for this job.</b> Either grading has not been recorded for it in REC 7.4.3.1 / 7.4.3.2, or the job number is not exactly as entered there.</p>'}`;
  }

  async function load(job) {
    const input = jobInput();
    if (!input) return;
    const p = ensurePanel(input);
    const mine = ++seq;
    p.innerHTML = '<p>Looking up boxes for ' + esc(job) + '…</p>';
    try {
      const res = await window.FacilityApi.fetch('/api/recall/job/' + encodeURIComponent(job) + '/boxes');
      const data = await res.json();
      if (mine !== seq) return; // a newer lookup superseded this one
      if (!res.ok || !data.ok) throw new Error('lookup failed');
      render(p, job, data);
    } catch (e) {
      if (mine === seq) p.innerHTML = '<p>Could not look up boxes for ' + esc(job) + ' (offline or server error). Try again.</p>';
      lastJob = null; // allow a retry on the next check
    }
  }

  function check() {
    const input = jobInput();
    if (!input) return;
    const job = String(input.value || '').trim().toUpperCase();
    if (job === lastJob) return;
    lastJob = job;
    if (!job) { if (panel) panel.innerHTML = ''; return; }
    load(job);
  }

  // Cheap, bounded: one interval comparing a string, plus change events. No DOM observers.
  function start() {
    if (!window.FacilityApi) return;
    setInterval(check, 1000);
    ['input', 'change'].forEach((ev) => document.addEventListener(ev, (e) => { if (e.target && e.target.id === 'fr_f_jobNo') check(); }));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
