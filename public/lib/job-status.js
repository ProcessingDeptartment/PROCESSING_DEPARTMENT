/*
 * Job status (open / closed) for production job numbers.
 *
 * A job number is created implicitly the moment it's captured on Abalone Receiving (REC 7.1.2) --
 * there is no "create job" step. So a job with no status entry is OPEN by definition; closing one
 * writes a record, and that's what takes it out of the pickers on every downstream form.
 *
 * === STORAGE ===
 * One key per closed/reopened job, through window.storage like everything else:
 *
 *     job_status:<jobNo>  ->  { job_no, status, closed_at, closed_by, note, reopened_at, ... }
 *
 * Kept as one key per job (rather than a single index blob) so two people closing different jobs
 * at once can't clobber each other.
 *
 * === WHY READS GO STRAIGHT TO THE API, NOT THROUGH window.storage ===
 * Two reasons, and they're different:
 *
 * 1. The job LIST lives inside the whole Abalone Receiving record -- every submission and every
 *    basket roster row. Pulling that through window.storage just to read the job numbers off it
 *    would drag the full record down to a factory tablet on every form open. /api/values/...
 *    answers the same question in one small response, exactly as the autofill lookup already does.
 *
 * 2. STATUSES can't tolerate the api-backend health-check race. api-backend.js registers the real
 *    backend asynchronously, so a read issued on page load may hit localStorage instead and come
 *    back empty -- and for statuses "empty" is indistinguishable from the perfectly normal case of
 *    "nothing is closed yet", so it can't be detected and retried. Read through the API and there
 *    is no race to lose: a closed job is a closed job on the first paint.
 *
 * WRITES still go through window.storage, so closing a job stays on the normal seam. If the API is
 * unreachable, statuses fail open (everything looks open) rather than closed -- a job that can't be
 * selected is worse on the floor than one that shouldn't have been.
 */
(function () {
  const NS = 'job_status:';

  function apiBase() {
    return window.FACILITY_API_BASE || 'https://processing-department-api.onrender.com';
  }

  // Goes through FacilityApi (api-backend.js) so the access key is attached; falls back to a plain
  // fetch on the few pages that don't load a backend adapter at all.
  function apiFetch(path) {
    return window.FacilityApi ? window.FacilityApi.fetch(path) : fetch(apiBase() + path);
  }

  // jobNo -> { status, closed_at, closed_by, note }. Absent = open.
  async function statusMap() {
    const map = new Map();
    try {
      const res = await apiFetch('/api/storage/prefix/' + encodeURIComponent(NS));
      if (!res.ok) return map;
      const raw = await res.json();
      Object.keys(raw || {}).forEach((k) => {
        try {
          const row = JSON.parse(raw[k]);
          if (row && row.job_no) map.set(String(row.job_no), row);
        } catch (e) { /* skip an unreadable entry rather than break the whole list */ }
      });
    } catch (e) {
      console.warn('[job-status] status load failed', e);
    }
    return map;
  }

  // Every job number ever captured on Abalone Receiving, most recent first.
  async function allJobNumbers() {
    try {
      const res = await apiFetch('/api/values/abalone-receiving/jobNo');
      if (!res.ok) return [];
      const list = await res.json();
      return Array.isArray(list) ? list : [];
    } catch (e) {
      console.warn('[job-status] job list fetch failed', e);
      return [];
    }
  }

  // [{ job_no, status, closed_at, closed_by, note }] for every known job, most recent first.
  async function list() {
    const [numbers, map] = await Promise.all([allJobNumbers(), statusMap()]);
    return numbers.map((jobNo) => {
      const row = map.get(String(jobNo));
      return Object.assign({ job_no: jobNo, status: 'open' }, row || {});
    });
  }

  // Just the open ones -- what the job-number pickers on every downstream form are allowed to offer.
  async function openJobNumbers() {
    const rows = await list();
    return rows.filter((r) => r.status !== 'closed').map((r) => r.job_no);
  }

  async function get(jobNo) {
    const map = await statusMap();
    return map.get(String(jobNo)) || { job_no: jobNo, status: 'open' };
  }

  async function close(jobNo, meta) {
    const row = {
      job_no: String(jobNo),
      status: 'closed',
      closed_at: new Date().toISOString(),
      closed_by: (meta && meta.by) || (window.Auth && window.Auth.getCurrentUsername && window.Auth.getCurrentUsername()) || null,
      note: (meta && meta.note) || null
    };
    const ok = await window.storage.set(NS + jobNo, JSON.stringify(row), true);
    return ok ? row : null;
  }

  // Closing is not meant to be permanent-by-accident: a job closed in error can be reopened, and
  // the previous close is kept on the row so the history isn't silently erased.
  async function reopen(jobNo, meta) {
    const prev = await get(jobNo);
    const row = {
      job_no: String(jobNo),
      status: 'open',
      previously_closed_at: prev.closed_at || null,
      previously_closed_by: prev.closed_by || null,
      reopened_at: new Date().toISOString(),
      reopened_by: (meta && meta.by) || (window.Auth && window.Auth.getCurrentUsername && window.Auth.getCurrentUsername()) || null,
      note: (meta && meta.note) || null
    };
    const ok = await window.storage.set(NS + jobNo, JSON.stringify(row), true);
    return ok ? row : null;
  }

  window.JobStatus = { list, get, close, reopen, openJobNumbers, allJobNumbers };
})();
