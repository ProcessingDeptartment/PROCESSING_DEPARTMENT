# Production Dashboard — Mockup to Live (Seam Section)

**Date:** 2026-10-09  
**Raised by:** Michaela  
**Type:** Rework — convert mockup to real page; wire seam data first  
**Source file:** `public/pages/production-dashboard-mockup.html`  
**Target file:** `public/pages/production-dashboard.html` (new file; keep mockup as-is for reference)  
**Use in:** Claude Code (build)

---

## 1. What this instruction covers

The mockup page (`production-dashboard-mockup.html`) has good structure and styling. This instruction converts it into a live page step by step. **In this phase, only the seam section is wired to real data.** All other panels (Line status, NCs, Drying room, Grading, Records due, Recent activity) remain with placeholder rows but are structurally ready for future wiring.

---

## 2. Step 1 — Create the new file

Copy `public/pages/production-dashboard-mockup.html` to `public/pages/production-dashboard.html`.

Make these changes immediately:

**a) Update `<title>`:**
```html
<title>Production Dashboard</title>
```

**b) Remove the mockup banner entirely:**
```html
<!-- DELETE this block -->
<div class="mockup-banner">
  <strong>Mockup only.</strong> ...
</div>
```

**c) Update the header subtitle:**
```html
<!-- FROM -->
<p>Live floor snapshot &mdash; harvesting, seams, drying, grading and quality across today's shift.</p>
<!-- TO -->
<p>Production floor snapshot &mdash; seam data live &middot; other sections coming soon</p>
```

**d) Add a refresh button to the header:**
```html
<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
  <a class="back-link" href="../index.html">&larr; Back to Processing Department</a>
  <button id="dashRefreshBtn" style="background:transparent;border:1px solid #55636e;color:#b9c3cc;padding:5px 12px;border-radius:4px;font-size:11px;cursor:pointer;font-family:inherit;">↻ Refresh</button>
</div>
```

---

## 3. Step 2 — Clear temp/test seam data in Neon

Before going live, flush development test data from `seam_test_run`:

```sql
-- Option A: wipe everything and reset ID counter
TRUNCATE TABLE seam_test_run RESTART IDENTITY;

-- Option B: delete only entries before today
DELETE FROM seam_test_run WHERE recorded_at < '2026-10-09T00:00:00Z';
```

Run this directly on the Neon console at console.neon.tech.

---

## 4. Step 3 — Wire the Seam summary card to live data

The existing "Seams in spec" summary card (`.summary-card.clickable#seamCard`) currently shows hardcoded `98.6%` and `142 / 144 checked`. Replace the inner content with live-loaded values:

**HTML — replace the card's inner divs:**
```html
<div class="summary-card clickable" id="seamCard" tabindex="0" role="button" aria-haspopup="dialog">
  <div class="num ok" id="seamSpecPct">—</div>
  <div class="lbl">Seams in spec</div>
  <div class="sub" id="seamSpecSub">Loading…</div>
</div>
```

The JS (Step 5) will populate `#seamSpecPct` and `#seamSpecSub` from live data.

---

## 5. Step 4 — Replace static seam log panel with live seam trends panel

The current seam log panel shows a hardcoded 4-row table. Replace the entire panel with a live version that shows a pass/fail bar chart and the last 50 runs.

**Replace this block** (the left panel inside the first `.two-col`):
```html
<div class="panel">
  <div class="panel-head">
    <h2>Seam inspection &mdash; double seam log</h2>
    <span class="panel-note">REC 7.2.4</span>
  </div>
  <div class="panel-body">
    <table class="dash-table"> ... (static rows) ... </table>
  </div>
</div>
```

**With this live panel:**
```html
<div class="panel" id="seamLivePanel">
  <div class="panel-head">
    <h2>Double seam — live log</h2>
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      <div class="seam-filter-group" id="seamEndFilter">
        <button class="seam-filter-btn active" data-filter="all">All</button>
        <button class="seam-filter-btn" data-filter="manufacturer">Mfr</button>
        <button class="seam-filter-btn" data-filter="production">Prod</button>
      </div>
      <span class="panel-note">REC 7.2.4</span>
    </div>
  </div>
  <div class="panel-body pad" style="padding-bottom:0;">
    <!-- trend chart -->
    <div style="position:relative;height:120px;margin-bottom:10px;">
      <canvas id="seamTrendChart"></canvas>
    </div>
  </div>
  <div class="panel-body" style="padding-top:0;">
    <table class="dash-table" id="seamLiveTable">
      <thead>
        <tr>
          <th>Time</th>
          <th>End type</th>
          <th>Operator</th>
          <th>Overlap</th>
          <th>% Overlap</th>
          <th>Free space</th>
          <th>Result</th>
        </tr>
      </thead>
      <tbody id="seamLiveBody">
        <tr><td colspan="7" style="text-align:center;color:#8a939b;padding:14px;">Loading…</td></tr>
      </tbody>
    </table>
  </div>
</div>
```

---

## 6. Step 5 — Add CSS for seam filter buttons

Add to the `<style>` block:

```css
/* seam filter pill group */
.seam-filter-group {
  display: flex;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  overflow: hidden;
}
.seam-filter-btn {
  border: none;
  border-right: 1px solid #d1d5db;
  background: transparent;
  color: #5c6771;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  font-family: inherit;
}
.seam-filter-btn:last-child { border-right: none; }
.seam-filter-btn.active { background: #2f4356; color: #fff; }
```

---

## 7. Step 6 — Add Chart.js CDN to `<head>`

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
```

---

## 8. Step 7 — Replace the seam JS block with live data JS

The existing `<script>` block handles only the modal. Replace the entire `<script>` block (starting from `<script>(function () {` to its closing `</script>`) with this:

```html
<script>
(function () {

  /* ─── state ─── */
  const API = '/api/seam-test-runs?limit=200';
  let allRows = [];
  let chart = null;
  let activeFilter = 'all';

  /* ─── helpers ─── */
  const $ = id => document.getElementById(id);

  function fmt(v, dec, unit) {
    return v == null ? '—' : Number(v).toFixed(dec) + (unit || '');
  }

  function fmtTime(iso) {
    return new Date(iso).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  }

  function dayKey(iso) { return iso.slice(0, 10); }

  /* ─── filter ─── */
  function filtered() {
    if (activeFilter === 'all') return allRows;
    return allRows.filter(r => r.end_type === activeFilter);
  }

  /* ─── seam KPI card ─── */
  function updateSeamCard(rows) {
    const total = rows.length;
    const passes = rows.filter(r => r.all_pass).length;
    const pct = total ? (100 * passes / total).toFixed(1) : null;

    const pctEl = $('seamSpecPct');
    const subEl = $('seamSpecSub');
    if (!pctEl) return;

    if (pct == null) {
      pctEl.textContent = '—';
      subEl.textContent = 'No data';
      return;
    }

    pctEl.textContent = pct + '%';
    pctEl.className = 'num ' + (parseFloat(pct) >= 97 ? 'ok' : 'warn');
    subEl.textContent = passes + ' / ' + total + ' checked';
  }

  /* ─── chart ─── */
  function buildChart(rows) {
    const byDay = {};
    rows.forEach(r => {
      const d = dayKey(r.recorded_at);
      if (!byDay[d]) byDay[d] = { pass: 0, fail: 0 };
      r.all_pass ? byDay[d].pass++ : byDay[d].fail++;
    });

    const labels = Object.keys(byDay).sort().map(d => {
      const dt = new Date(d);
      return dt.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
    });
    const days = Object.keys(byDay).sort();
    const passData = days.map(d => byDay[d].pass);
    const failData = days.map(d => byDay[d].fail);

    const ctx = $('seamTrendChart');
    if (!ctx) return;
    if (chart) chart.destroy();

    chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Pass', data: passData, backgroundColor: '#86efac', borderColor: '#22c55e', borderWidth: 1 },
          { label: 'Fail', data: failData, backgroundColor: '#fca5a5', borderColor: '#ef4444', borderWidth: 1 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { font: { size: 10 }, boxWidth: 12 } } },
        scales: {
          x: { stacked: true, ticks: { font: { size: 10 } } },
          y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1, font: { size: 10 } } }
        }
      }
    });
  }

  /* ─── live table ─── */
  function buildTable(rows) {
    const tbody = $('seamLiveBody');
    if (!tbody) return;
    const slice = rows.slice(0, 25);
    if (!slice.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#8a939b;padding:14px;">No records</td></tr>';
      return;
    }
    tbody.innerHTML = slice.map(r => {
      const endLabel = r.end_type === 'manufacturer' ? 'Mfr' : r.end_type === 'production' ? 'Prod' : '—';
      const badgeClass = r.all_pass ? 'badge-ok' : 'badge-warn';
      const badgeText = r.all_pass ? 'Pass' : 'Fail';
      return `<tr>
        <td class="num-cell">${fmtTime(r.recorded_at)}</td>
        <td>${endLabel}</td>
        <td>${r.operator || '—'}</td>
        <td class="num-cell">${fmt(r.overlap, 3, ' mm')}</td>
        <td class="num-cell">${fmt(r.overlap_pct, 1, '%')}</td>
        <td class="num-cell">${fmt(r.free_space, 3, ' mm')}</td>
        <td><span class="badge ${badgeClass}">${badgeText}</span></td>
      </tr>`;
    }).join('');
  }

  /* ─── render ─── */
  function render() {
    const rows = filtered();
    updateSeamCard(rows);
    buildChart(rows);
    buildTable(rows);
  }

  /* ─── load from API ─── */
  async function loadData() {
    try {
      // Use FacilityApi if authenticated, else plain fetch
      const fetcher = window.FacilityApi
        ? window.FacilityApi.fetch.bind(window.FacilityApi)
        : fetch;
      const resp = await fetcher(API);
      const data = await resp.json();
      if (data.ok && Array.isArray(data.rows)) {
        allRows = data.rows;
        render();
      }
    } catch (e) {
      console.warn('Dashboard seam data load failed', e);
      const tbody = $('seamLiveBody');
      if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#a3352d;padding:14px;">Could not load seam data</td></tr>';
    }
  }

  /* ─── filter buttons ─── */
  document.querySelectorAll('.seam-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.seam-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      render();
    });
  });

  /* ─── refresh button ─── */
  $('dashRefreshBtn')?.addEventListener('click', loadData);

  /* ─── init ─── */
  loadData();

})();
</script>
```

---

## 9. API column names (what the GET endpoint returns)

The `GET /api/seam-test-runs` response has these fields per row. Check `src/index.js` to confirm whether it returns snake_case (direct DB) or camelCase. The JS above assumes **snake_case**. If camelCase, map as follows:

| snake_case (DB/JS above) | camelCase alternative |
|---|---|
| `r.recorded_at` | `r.recordedAt` |
| `r.end_type` | `r.endType` |
| `r.all_pass` | `r.allPass` |
| `r.overlap_pct` | `r.overlapPct` |
| `r.free_space` | `r.freeSpace` |
| `r.bh_butting` | `r.bhButting` |

Adjust in the JS if needed.

---

## 10. Home page — add link to production dashboard

Add a tile on `public/index.html` (auth-only, visible when logged in) linking to the new page:

```html
<a class="block auth-only" href="pages/production-dashboard.html" title="Live production floor snapshot">
  <span class="block-title">Production Dashboard</span>
  <span class="block-desc">Live seam data, line status and quality overview for the production floor</span>
</a>
```

---

## 11. Deployment checklist

- [ ] `public/pages/production-dashboard.html` created (copy from mockup)
- [ ] Mockup banner removed; title and subtitle updated
- [ ] Refresh button added to header
- [ ] Seam KPI card inner HTML updated to use `#seamSpecPct` and `#seamSpecSub`
- [ ] Static seam log panel replaced with live seam trends panel
- [ ] Chart.js CDN `<script>` added to `<head>`
- [ ] CSS for `.seam-filter-btn` added to `<style>` block
- [ ] Old seam modal JS replaced with live data JS
- [ ] Temp data cleared from `seam_test_run` in Neon
- [ ] Home page tile added linking to `pages/production-dashboard.html`
- [ ] `git add`, `git commit`, `git push` — Render auto-deploys
- [ ] Verify seam card shows live pass % after real data submitted from calculator
- [ ] Verify chart shows bars per day
- [ ] Verify filter (All / Mfr / Prod) works
- [ ] Verify table shows 25 most recent runs
- [ ] No console errors; mobile layout correct

---

## 12. Sections to wire in future phases

| Panel | Data source | Status |
|---|---|---|
| Harvested weight | Jobs API / SysPro | Placeholder |
| OOSW | Jobs API / weight records | Placeholder |
| Kg in drying room | REC 7.9.3.1 dry room logs | Placeholder |
| Graded this week | Grading records | Placeholder |
| Open quality NCs | NC log table | Placeholder |
| Line status | Jobs table (open jobs) | Placeholder |
| Drying room log | REC 7.9.3.1 submissions | Placeholder |
| Records due this shift | Records + due-time logic | Placeholder |
| Recent activity | Submissions audit log | Placeholder |
| **Seam in spec** | `seam_test_run` | **✓ Live (this phase)** |
