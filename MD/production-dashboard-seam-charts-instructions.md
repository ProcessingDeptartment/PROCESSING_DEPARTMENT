# Production Dashboard — Double Seam Charts Redesign

**File:** `public/pages/production-dashboard.html`

---

## Overview

Replace the current double seam panel (bar chart + inline data table) with two line graphs showing actual measured values over time. No data table inline — only charts. A separate "View full seam log" button links to the full log page.

Default view shows **Production end** only. A toggle button switches to **Manufacturer (MR) end**. Both ends are never shown on the same chart at the same time.

---

## Layout structure

```
┌─────────────────────────────────────────────────────┐
│ Panel header: "Double seam — trend charts"   REC 7.2.4 │
│ [Production end] [MR end]  ← toggle buttons           │
├──────────────────────┬──────────────────────────────┤
│  % Overlap graph     │  Free Space graph             │
│  (line, 180px tall)  │  (line, 180px tall)           │
│  legend + OOS note   │  legend + OOS note            │
├──────────────────────┴──────────────────────────────┤
│ summary pills: X checks · Y OOS    [View full seam log →] │
└─────────────────────────────────────────────────────┘

↓ below the seam panel (separate panel)

┌─────────────────────────────────────────────────────┐
│ Quality non-conformances                             │
│ NC log table (existing)                              │
└─────────────────────────────────────────────────────┘
```

---

## Toggle button behaviour

- Two pill buttons in the panel header: **"Production end"** and **"MR end"**
- Default active: **Production end**
- Clicking the other button re-renders both graphs using only that end type's rows
- Filter: `rows.filter(r => r.end_type === activeEnd)` where `activeEnd` is `'production'` or `'manufacturer'`
- Active button style: dark background (`#2f4356`), white text
- Inactive: transparent background, muted text

---

## Graph 1 — % Overlap

| Property | Value |
|----------|-------|
| Chart type | Line |
| Data field | `overlap_pct` (number, %) |
| Y axis label | `%` |
| Y axis range | 30 – 100 |
| Spec minimum | **45%** |
| Canvas height | 180 px |

**Spec reference line:** dashed horizontal line at 45%, colour `rgba(165,53,45,0.5)`, no points.

**OOS detection:** a point is OOS if `overlap_pct < 45`.

**Line segment colouring (Chart.js `segment` option):**
```js
segment: {
  borderColor(ctx) {
    const v0 = rows[ctx.p0DataIndex]?.overlap_pct;
    const v1 = rows[ctx.p0DataIndex + 1]?.overlap_pct;
    if ((v0 != null && v0 < 45) || (v1 != null && v1 < 45)) return '#ef4444';
    return baseColor; // '#2f7a52' for Prod, '#1d4ed8' for MR
  }
}
```

**Point colours:** `pointBackgroundColor` and `pointBorderColor` — set to `#ef4444` for OOS points, otherwise match the line colour.

---

## Graph 2 — Free Space

| Property | Value |
|----------|-------|
| Chart type | Line |
| Data field | `free_space` (number, mm) |
| Y axis label | `mm` |
| Y axis range | 0 – 0.5 |
| Spec range | **0.10 – 0.30 mm** |
| Canvas height | 180 px |

**Spec reference lines:** two dashed horizontal lines:
- Min at 0.10 mm — colour `rgba(165,53,45,0.45)`, dash `[5,4]`
- Max at 0.30 mm — colour `rgba(165,53,45,0.45)`, dash `[3,4]`

**OOS detection:** `free_space < 0.10 || free_space > 0.30`

**Segment and point colouring:** same logic as % Overlap, using OOS condition above.

---

## Colours

| Series | Line colour |
|--------|------------|
| Production end | `#2f7a52` |
| Manufacturer end | `#1d4ed8` |
| OOS segment / point | `#ef4444` |
| Spec reference line | `rgba(165,53,45,0.5)` |

---

## Chart options (both graphs)

```js
{
  responsive: true,
  maintainAspectRatio: false,
  parsing: false,          // data is [{x, y}] objects
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { position: 'top', labels: { font: { size: 10 }, boxWidth: 16 } },
    tooltip: { bodyFont: { size: 11 }, titleFont: { size: 11 } }
  },
  scales: {
    x: { ticks: { font: { size: 10 }, maxTicksLimit: 10, maxRotation: 30 }, grid: { color: '#eceeef' } },
    y: { title: { display: true, text: yLabel, font: { size: 10 }, color: '#5c6771' },
         ticks: { font: { size: 10 } }, grid: { color: '#eceeef' } }
  }
}
```

X axis values: time string from `recorded_at`, formatted as `HH:mm` using `toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })`.

Dataset data shape: `[{ x: '08:30', y: 52.4 }, …]` sorted by `recorded_at` ascending.

---

## Summary pills (below charts)

Shown in the panel footer, left-aligned, one pill per active end:

```
Production end: 14 checks · 2 OOS
```

- If 0 OOS: "all in spec" (green text for `strong`)
- If OOS > 0: "X OOS" (red text for `strong`)

Derive from the filtered rows (active end only):
- Total: `rows.length`
- OOS count: `rows.filter(r => !r.all_pass).length`

---

## "View full seam log" button

Positioned right-aligned in the panel footer.

```html
<a class="view-log-btn" href="/pages/seam-log.html">
  View full seam log &rarr;
</a>
```

Style:
```css
.view-log-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: #2f4356;
  color: #fff;
  border-radius: 5px;
  font-size: 11.5px;
  font-weight: 600;
  text-decoration: none;
  transition: background .15s;
}
.view-log-btn:hover { background: #3d566e; }
```

---

## Data loading

Unchanged from current — fetch from `/api/seam-test-runs?limit=200`, use `window.FacilityApi.fetch`.

On load: filter to `end_type === 'production'`, render both charts.

On toggle to MR: filter to `end_type === 'manufacturer'`, re-render both charts.

Destroy previous Chart.js instances before creating new ones (`chart.destroy()`).

---

## NC log placement

The Quality NC log table moves to its own full-width panel **directly below the seam panel**, not in the old two-column layout beside the seam panel.

Remove the old `<div class="two-col">` wrapper that paired the seam panel with the NC panel.

---

## Remove

- The `#seamTrendChart` bar chart canvas
- The `#seamLiveTable` / `#seamLiveBody` inline data table
- The `#seamEndFilter` pill group (replaced by the new end-type toggle)

---

## Responsive

At ≤ 1100 px: stack the two chart columns vertically (single column), each chart full width.

---

## Cache-busting

After editing `production-dashboard.html`, check if it references `form-record.js` — unlikely for this page, but check:
```bash
grep "form-record.js" public/pages/production-dashboard.html
```
No bump needed if it does not reference it.
