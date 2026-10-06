# Index Page — 24-Hour Dashboard Placeholder

**Date:** 2026-10-06  
**Raised by:** Michaela  
**Type:** New feature — placeholder dashboard block on `public/index.html`  
**Use in:** Claude Code (build)

---

## 1. What to build

Add a **"Last 24 Hours — At a Glance"** section to `public/index.html`, positioned directly below the page header / navigation and above the Categories table. This is a **placeholder** — it shows the structure and tile layout now, with live data wired in once the dashboard API endpoints are ready.

---

## 2. Visual layout

A horizontal row of **KPI tiles**, followed by a single-line timestamp showing when the data was last refreshed.

### Tile definitions (placeholder values shown)

| # | Tile label | Placeholder value | Colour signal |
|---|---|---|---|
| 1 | Jobs opened | `—` | Neutral |
| 2 | Jobs closed | `—` | Neutral |
| 3 | Submissions filed | `—` | Neutral |
| 4 | Verifications pending | `—` | Warning (amber) when > 0 |
| 5 | **⚠ Open NCs** | `—` | Danger (red) when > 0, else green |
| 6 | Kg received (24 hr) | `—` | Neutral |

Below the tiles:

```
Last refreshed: — · [Refresh]
```

The **"⚠ Open NCs"** tile must be a **clickable link** — clicking it navigates to `public/pages/nc-log.html` (the NC log page described in the companion instruction file).

---

## 3. HTML structure (add to `public/index.html`)

Insert this block immediately after the `<header>` / nav bar and before the Categories section:

```html
<!-- ===== 24-HOUR DASHBOARD PLACEHOLDER ===== -->
<section id="dashboard-24hr" class="dashboard-24hr">
  <div class="dash-header">
    <h2 class="dash-title">Last 24 Hours — At a Glance</h2>
    <span class="dash-refresh-line">
      Last refreshed: <span id="dash-refresh-time">—</span>
      <button id="dash-refresh-btn" class="btn-icon" title="Refresh">↻</button>
    </span>
  </div>

  <div class="dash-tiles">
    <div class="dash-tile">
      <span class="tile-value" id="dash-jobs-opened">—</span>
      <span class="tile-label">Jobs opened</span>
    </div>
    <div class="dash-tile">
      <span class="tile-value" id="dash-jobs-closed">—</span>
      <span class="tile-label">Jobs closed</span>
    </div>
    <div class="dash-tile">
      <span class="tile-value" id="dash-submissions">—</span>
      <span class="tile-label">Submissions filed</span>
    </div>
    <div class="dash-tile dash-tile--warn" id="dash-tile-verifications">
      <span class="tile-value" id="dash-verifications">—</span>
      <span class="tile-label">Verifications pending</span>
    </div>
    <a href="pages/nc-log.html" class="dash-tile dash-tile--danger" id="dash-tile-ncs">
      <span class="tile-value" id="dash-open-ncs">—</span>
      <span class="tile-label">⚠ Open NCs</span>
    </a>
    <div class="dash-tile">
      <span class="tile-value" id="dash-kg-received">—</span>
      <span class="tile-label">Kg received (24 hr)</span>
    </div>
  </div>
</section>
<!-- ===== END 24-HOUR DASHBOARD ===== -->
```

---

## 4. CSS (add to the page's `<style>` block or shared stylesheet)

```css
/* ---- 24-hr dashboard ---- */
.dashboard-24hr {
  background: var(--surface, #fff);
  border: 1px solid var(--border, #e0e0e0);
  border-radius: 8px;
  padding: 1rem 1.25rem 1.25rem;
  margin: 0 0 1.5rem 0;
}

.dash-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.dash-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary, #1a1a1a);
}

.dash-refresh-line {
  font-size: 0.78rem;
  color: var(--text-muted, #666);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  color: var(--text-muted, #666);
  padding: 0 0.2rem;
}

.dash-tiles {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.dash-tile {
  flex: 1 1 130px;
  background: var(--surface-raised, #f5f5f5);
  border: 1px solid var(--border, #e0e0e0);
  border-radius: 6px;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  text-decoration: none;
  color: inherit;
  transition: box-shadow 0.15s;
}

.dash-tile:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.10);
}

.tile-value {
  font-size: 1.6rem;
  font-weight: 700;
  line-height: 1.1;
  color: var(--text-primary, #1a1a1a);
}

.tile-label {
  font-size: 0.72rem;
  color: var(--text-muted, #666);
  margin-top: 0.3rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* State colours */
.dash-tile--warn {
  border-color: #f59e0b;
  background: #fffbeb;
}
.dash-tile--warn .tile-value { color: #92400e; }

.dash-tile--danger {
  border-color: #ef4444;
  background: #fef2f2;
}
.dash-tile--danger .tile-value { color: #991b1b; }

.dash-tile--ok {
  border-color: #22c55e;
  background: #f0fdf4;
}
.dash-tile--ok .tile-value { color: #166534; }

/* Responsive */
@media (max-width: 600px) {
  .dash-tiles { gap: 0.5rem; }
  .dash-tile { flex: 1 1 calc(50% - 0.5rem); }
}
```

---

## 5. JavaScript (placeholder — wires up refresh button only)

Add this script at the bottom of `public/index.html`, before `</body>`:

```javascript
// ---- 24-hr Dashboard placeholder ----
(function () {
  const refreshTime = document.getElementById('dash-refresh-time');
  const refreshBtn  = document.getElementById('dash-refresh-btn');

  function formatTime(d) {
    return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  }

  async function loadDashboard24hr() {
    // TODO: replace with real API calls once /api/dashboard/24hr endpoint exists
    // Example:
    // const data = await fetch('/api/dashboard/24hr').then(r => r.json());
    // document.getElementById('dash-jobs-opened').textContent = data.jobsOpened ?? '—';
    // document.getElementById('dash-open-ncs').textContent    = data.openNCs     ?? '—';
    // ... etc.

    // For now, just update the refresh timestamp
    refreshTime.textContent = formatTime(new Date());
  }

  refreshBtn.addEventListener('click', loadDashboard24hr);
  loadDashboard24hr();
})();
```

---

## 6. Future wiring (when API is ready)

When the backend endpoint `/api/dashboard/24hr` is built (see NC log instructions for the NC count source), it should return:

```json
{
  "jobsOpened": 3,
  "jobsClosed": 2,
  "submissionsFiled": 18,
  "verificationsPending": 4,
  "openNCs": 1,
  "kgReceived24hr": 1250
}
```

Replace the `// TODO` block in the JS above with real fetch calls. Also:
- If `openNCs > 0` → ensure `dash-tile--danger` class is on the NC tile.
- If `openNCs === 0` → swap class to `dash-tile--ok`.
- If `verificationsPending > 0` → add `dash-tile--warn` class.

---

## 7. Checks before finishing

- [ ] Dashboard block appears above the Categories table with no layout shift.
- [ ] All 6 tiles render with `—` placeholder values.
- [ ] "⚠ Open NCs" tile navigates to `pages/nc-log.html` when clicked.
- [ ] Refresh button updates the timestamp without errors.
- [ ] No console errors on load.
- [ ] Mobile (≤ 600 px): tiles wrap into 2-column layout correctly.
- [ ] Categories table and all existing functionality unchanged.
