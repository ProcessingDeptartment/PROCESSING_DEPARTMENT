(function () {
  const NS = 'job_status:';

  function apiBase() {
    return window.FACILITY_API_BASE || 'https://processing-department-api.onrender.com';
  }

  function apiFetch(path) {
    return window.FacilityApi ? window.FacilityApi.fetch(path) : fetch(apiBase() + path);
  }

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
        } catch (e) {  }
      });
    } catch (e) {
      console.warn('[job-status] status load failed', e);
    }
    return map;
  }

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

  async function list() {
    const [numbers, map] = await Promise.all([allJobNumbers(), statusMap()]);
    return numbers.map((jobNo) => {
      const row = map.get(String(jobNo));
      return Object.assign({ job_no: jobNo, status: 'open' }, row || {});
    });
  }

  async function openJobNumbers() {
    const rows = await list();
    return rows.filter((r) => r.status !== 'closed').map((r) => r.job_no);
  }

  async function get(jobNo) {
    const map = await statusMap();
    return map.get(String(jobNo)) || { job_no: jobNo, status: 'open' };
  }

  async function close(jobNo, meta) {
    const prev = await get(jobNo);
    const row = Object.assign({}, prev, {
      job_no: String(jobNo),
      status: 'closed',
      closed_at: new Date().toISOString(),
      closed_by: (meta && meta.by) || (window.Auth && window.Auth.getCurrentUsername && window.Auth.getCurrentUsername()) || null,
      note: (meta && meta.note) || null
    });
    const ok = await window.storage.set(NS + jobNo, JSON.stringify(row), true);
    return ok ? row : null;
  }

  async function reopen(jobNo, meta) {
    const prev = await get(jobNo);
    const row = Object.assign({}, prev, {
      job_no: String(jobNo),
      status: 'open',
      previously_closed_at: prev.closed_at || null,
      previously_closed_by: prev.closed_by || null,
      reopened_at: new Date().toISOString(),
      reopened_by: (meta && meta.by) || (window.Auth && window.Auth.getCurrentUsername && window.Auth.getCurrentUsername()) || null,
      note: (meta && meta.note) || null
    });
    const ok = await window.storage.set(NS + jobNo, JSON.stringify(row), true);
    return ok ? row : null;
  }

  async function saveDetails(jobNo, patch) {
    const prev = await get(jobNo);
    const row = Object.assign({}, prev, patch, { job_no: String(jobNo) });
    const ok = await window.storage.set(NS + jobNo, JSON.stringify(row), true);
    return ok ? row : null;
  }

  window.JobStatus = { list, get, close, reopen, openJobNumbers, allJobNumbers, saveDetails };
})();
