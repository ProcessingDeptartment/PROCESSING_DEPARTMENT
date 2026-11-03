# Trending Section — Requirements Questionnaire

**Instructions for the user:**
Before any development starts, answer the questions below for each metric you want to display in the trending section. Make a copy of the "Metric Definition Template" (Section 2) for each metric you add. The developer needs completed answers to build the section correctly.

---

## Section 1 — General Setup

Answer these once for the whole trending section.

### 1.1 How many topics do you want to trend?

Count the distinct categories of information (e.g. quality, production volume, drying, staff attendance). Write them here:

```
1.
2.
3.
4.
5.
```

### 1.2 Tab structure

If you have 4 or more topics, they should be grouped into tabs.

How do you want to group them?

```
Tab 1 name:        Topics it covers:
Tab 2 name:        Topics it covers:
Tab 3 name:        Topics it covers:
```

*If you have 3 or fewer topics, no tabs are needed — all panels show on one scrolling page.*

### 1.3 Default date range

When someone opens the trending page, what date range should the charts show by default?

- [ ] Last 7 days
- [ ] Last 30 days  ← recommended
- [ ] Last 90 days
- [ ] This calendar month

### 1.4 Who can access this section?

- [ ] All logged-in users
- [ ] Supervisors and above only
- [ ] Admin only

### 1.5 Who can export data (CSV / PDF)?

- [ ] All logged-in users
- [ ] Supervisors and above only
- [ ] Admin only

---

## Section 2 — Metric Definition Template

*Copy this block once for each metric you want to trend. Fill in every field.*

---

### Metric Name

*What do you call this? Keep it short (3–5 words). This is what appears on the chart title and KPI tile.*

```
Name:
```

### What question does this answer?

*Write the question a manager or supervisor would ask that this chart answers. Example: "Is our seam pass rate improving or declining?"*

```
Question:
```

### Where does the data come from?

*Name the form or record in the system that contains this data. If you are not sure of the exact table name, describe the form (e.g. "the daily QC check sheet", "the receiving record").*

```
Form / Record name:
Specific field(s) on that form:
```

### What is being measured?

Tick one:

- [ ] A count (how many of something happened)
- [ ] A weight or volume (kg, litres, units)
- [ ] A percentage or rate (%)
- [ ] A duration (how many days / hours)
- [ ] A temperature or physical reading
- [ ] Other: _______________

### How should it be grouped over time?

Tick one:

- [ ] Per day
- [ ] Per week  ← recommended for most metrics
- [ ] Per month

### Chart type

Tick the best fit (refer to the Layout & Design Reference document if unsure):

- [ ] **Bar chart** — best for volumes and counts over time
- [ ] **Line chart** — best for rates, percentages, and trend direction
- [ ] **Scatter chart** — best for individual readings (e.g. temperature measurements)
- [ ] **Horizontal bar** — best for comparing categories to each other (not over time)

### Does this metric need a KPI tile?

A KPI tile shows the current value as a big number at the top of the page, colour-coded.

- [ ] Yes — show this as a KPI tile at the top
- [ ] No — chart only

*If yes, complete the colour thresholds below:*

```
What value triggers GREEN (on track)?
e.g. "Pass rate is 98% or above"

What value triggers AMBER (watch)?
e.g. "Pass rate is between 95% and 97%"

What value triggers RED (action needed)?
e.g. "Pass rate drops below 95%"
```

### Should users be able to break this down by a sub-category?

Example: the same chart filtered by location, by product type, by supplier, by shift.

- [ ] No — one combined view is enough
- [ ] Yes — users can filter by: _______________

### Drill-down: what records appear when someone clicks a bar?

When a user clicks a bar or data point on this chart, a list of the underlying records appears. What columns should that list show?

```
Column 1:
Column 2:
Column 3:
Column 4:
```

*Minimum: always include Date and a reference number (job number, form ID, or similar).*

### Does clicking a row open the full record?

- [ ] Yes — the row links to the full submitted form
- [ ] No — the detail panel is the end point

---

## Section 3 — Colour System Confirmation

The system uses three colours consistently across all tiles and charts. Before development, confirm the hex codes or confirm you are using the defaults.

| State | Default colour | Your colour (if different) |
|---|---|---|
| Green — on track | #22c55e | |
| Amber — watch | #f59e0b | |
| Red — action needed | #ef4444 | |

*If you leave the "Your colour" column blank, the defaults above are used.*

---

## Section 4 — Monthly Summary Report

The system can generate a single-page PDF summary covering all your trends for a selected month.

### Do you want a monthly summary report?

- [ ] Yes
- [ ] No

*If yes:*

```
What should the report be titled?
Who should it be generated for? (audience)
Should it include all charts, or only specific ones? List them:
```

---

## Section 5 — Sign-off

Once you have completed this questionnaire, hand it to the developer along with the **Trending Section — Layout & Design Reference** document. The developer does not need access to the live system to start planning the build.

```
Completed by:
Date:
Reviewed by (optional):
```

---

*Keep this file in the MD/ folder of the repository alongside other instruction files.*
