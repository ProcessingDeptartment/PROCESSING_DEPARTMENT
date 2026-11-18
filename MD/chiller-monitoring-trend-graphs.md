# Chiller Temperature Monitoring — Trend Graphs

## Context

REC 7.9.1 (`chiller-temperature-monitoring`) stores repeating-row submissions where each row has:
- `chillerUnit` — `"Chiller 1"`, `"Chiller 2"`, or `"Freezer"`
- `dialTemp` — dial temperature (°C)
- `productTemp` — product temperature (°C)

Data is stored under `readings[]` in the submission's data JSONB. Each submission also has a timestamp (the entry date/time).

Two trend graphs are needed, rendered **within the record's view/list page** (not a separate page).

---

## Graph 1 — Chiller Temperature Trend

**What it shows:** Dial temperature over time for Chiller 1 and Chiller 2 (not Freezer).

- **X axis:** submission date/time (chronological)
- **Y axis:** temperature in °C
- **Lines:**
  - Line 1 — `Chiller 1` dial temperature (e.g. blue)
  - Line 2 — `Chiller 2` dial temperature (e.g. green)
- **Reference band / lines:** shade or draw dashed lines at 0°C (min) and 10°C (max) — the accepted range for chillers
- **Title:** "Chiller Temperature Trend"

**Data extraction logic:**
```js
// For each submission (sorted by date asc):
//   submission.data.readings is an array of rows
//   Find row where chillerUnit === "Chiller 1" → plot dialTemp
//   Find row where chillerUnit === "Chiller 2" → plot dialTemp
//   If a unit has no row in that submission, leave a gap (null) for that point
```

---

## Graph 2 — Freezer Temperature Trend

**What it shows:** Both dial temp and product temp for the Freezer over time.

- **X axis:** submission date/time (chronological)
- **Y axis:** temperature in °C
- **Lines:**
  - Line 1 — `Freezer` dial temperature (e.g. purple)
  - Line 2 — `Freezer` product temperature (e.g. orange)
- **Reference lines:** dashed lines at -28°C (min) and 2°C (max) — the freezer spec (`freezerTemp` spec in the record def)
- **Title:** "Freezer Temperature Trend"

**Data extraction logic:**
```js
// For each submission (sorted by date asc):
//   Find row where chillerUnit === "Freezer"
//   Plot dialTemp as one line, productTemp as the other
//   If Freezer row is absent in a submission, gap both lines
```

---

## Rendering Location

Add both graphs to the **record list/history view** for `chiller-temperature-monitoring` — above or below the submission table, clearly separated. Use a "Trends" collapsible section so it doesn't clutter the default view.

Suggested layout:
```
[ ▼ Trends ]
  [ Graph 1: Chiller Temperature Trend ]
  [ Graph 2: Freezer Temperature Trend ]
[ Submission table ... ]
```

---

## Technical implementation

Use **Chart.js** (already likely available; if not, load from CDN — `https://cdn.jsdelivr.net/npm/chart.js`).

### Data query

Add an API endpoint or reuse an existing submissions list endpoint that returns submissions for `chiller-temperature-monitoring` in chronological order. The graph reads from `submission.data.readings[]`.

Alternatively, if the submissions list page already loads all submissions client-side, extract the graph data from that in-memory array.

### Chart config sketch

```js
// Shared X labels = submission dates formatted as "DD MMM HH:mm"
// Each dataset: { label, data: [...], borderColor, tension: 0.3, spanGaps: true }
// spanGaps: true so a missing reading doesn't break the line
// Reference lines via Chart.js annotation plugin or drawn as extra datasets with pointRadius: 0

const chillerChart = new Chart(ctx1, {
  type: 'line',
  data: {
    labels: xLabels,
    datasets: [
      { label: 'Chiller 1', data: chiller1Data, borderColor: '#2563eb', backgroundColor: 'transparent', spanGaps: true },
      { label: 'Chiller 2', data: chiller2Data, borderColor: '#16a34a', backgroundColor: 'transparent', spanGaps: true },
      // Reference lines (dashed)
      { label: 'Max (10°C)', data: Array(xLabels.length).fill(10), borderColor: '#dc2626', borderDash: [4,4], pointRadius: 0, spanGaps: true },
      { label: 'Min (0°C)',  data: Array(xLabels.length).fill(0),  borderColor: '#f59e0b', borderDash: [4,4], pointRadius: 0, spanGaps: true },
    ]
  },
  options: {
    responsive: true,
    plugins: { legend: { position: 'top' }, title: { display: true, text: 'Chiller Temperature Trend' } },
    scales: { y: { title: { display: true, text: '°C' } } }
  }
});

const freezerChart = new Chart(ctx2, {
  type: 'line',
  data: {
    labels: xLabels,
    datasets: [
      { label: 'Freezer dial',    data: freezerDialData,    borderColor: '#7c3aed', backgroundColor: 'transparent', spanGaps: true },
      { label: 'Freezer product', data: freezerProductData, borderColor: '#ea580c', backgroundColor: 'transparent', spanGaps: true },
      { label: 'Max (2°C)',   data: Array(xLabels.length).fill(2),   borderColor: '#dc2626', borderDash: [4,4], pointRadius: 0, spanGaps: true },
      { label: 'Min (-28°C)', data: Array(xLabels.length).fill(-28), borderColor: '#f59e0b', borderDash: [4,4], pointRadius: 0, spanGaps: true },
    ]
  },
  options: {
    responsive: true,
    plugins: { legend: { position: 'top' }, title: { display: true, text: 'Freezer Temperature Trend' } },
    scales: { y: { title: { display: true, text: '°C' } } }
  }
});
```

---

## Default time range

Default to showing the **last 30 days** of submissions. Optionally add a simple date-range filter (last 7 days / 30 days / 90 days / all) above the graphs.

---

## Files to touch

| File | Change |
|---|---|
| Record list/history page for `chiller-temperature-monitoring` (HTML or JS) | Add "Trends" collapsible section with two `<canvas>` elements |
| Supporting JS (inline or separate file) | Graph data extraction + Chart.js init |
| `public/lib/form-record.js` or the record list page | Load Chart.js from CDN if not already present |

If `form-record.js` controls the list view for all records, add a hook that checks `recordKey === 'chiller-temperature-monitoring'` and injects the trend section.

---

## Notes

- Out-of-spec points on the lines should be shown in **red** (use `pointBackgroundColor` as an array, mapping each index to red if the value is outside the spec range, otherwise the line colour).
- Tooltips should show: date/time, unit name, value with °C unit.
- If fewer than 3 submissions exist, still render the charts — just with the available data points.
