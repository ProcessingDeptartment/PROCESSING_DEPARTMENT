# Code Instruction — REC 7.1.2 & REC 7.1.5 Entry Flow Redesign

**Paste this prompt into Claude Code to implement both redesigns.**

---

> Read the following three instruction files in full before writing a single line of code:
>
> 1. `claude/rec-7.1.2-basket-entry-flow-instructions.md`
> 2. `claude/rec-7.1.5-oosw-entry-flow-instructions.md`
> 3. `claude/rec-7.1.2-7.1.5-tablet-ux-instructions.md` (touch targets, font sizes — apply throughout)
>
> Also read for context (do not change their scope):
> - `claude/record-open-job-gate-instructions.md` — the job gate pattern; REC 7.1.2 is the job-creating start record so the gate does NOT apply to it, but REC 7.1.5 IS gated and must confirm a job before the entry panel appears.
> - `claude/record-sections-collapse-and-job-autofocus-instructions.md` — the collapsible `<details>` section component already in `form-record.js`; reuse it, do not reinvent it.
>
> Then implement the following, in this order:
>
> ---
>
> ## Step 1 — REC 7.1.5 OOSW (simpler, do first)
>
> Replace the current OOSW entry form with the focused entry panel described in `rec-7.1.5-oosw-entry-flow-instructions.md`:
>
> 1. Size range selector: a row of large segmented buttons (one per existing size range option). One selectable at a time. Unselected = outline; selected = filled `--action` colour + tick. Wrap on narrow screens, no horizontal scroll.
> 2. Weight (kg) input: numeric, 48 px, disabled until a size range is selected.
> 3. **Add weight** button: 56 px full width, disabled until size range selected and weight > 0.
> 4. On Add: store the weight for that size range (replace if already exists), show a brief toast, clear the weight field, keep the size range button selected.
> 5. Re-tapping a button that has a value pre-fills the weight field; button label changes to **Update weight**.
> 6. Green totals section below (keep the existing green background colour exactly): one row per size range that has a weight — size range label, weight, auto-calculated %; a Total OOSW row at the bottom. Percentages are read-only (grey background, lock icon, no cursor on tap). Each row has an Edit link (re-selects the button and pre-fills weight) and a ✕ with confirm before removing.
> 7. Touch targets throughout per the tablet brief (buttons ≥ 48 px, Add ≥ 56 px, Edit ≥ 44 px, ✕ ≥ 40 px).
>
> **Do not change:** storage keys, database columns, the OOSW cap business rule used by REC 7.4.0, CSV export, print/PDF layout, or any validation rule.
>
> After building Step 1: show the rendered page, run the §8 testing checklist from `rec-7.1.5-oosw-entry-flow-instructions.md`, and report results before continuing.
>
> ---
>
> ## Step 2 — REC 7.1.2 Abalone Received
>
> Replace the current basket entry form with the three-section flow described in `rec-7.1.2-basket-entry-flow-instructions.md`:
>
> ### Section 1 — Job Info
> - On new entry, only Section 1 is visible (Sections 2 and 3 hidden/inert in the DOM — same gate pattern from `record-open-job-gate-instructions.md §2`, adapted: this record creates the job so there is no search bar, just the existing full job fields).
> - A **Confirm job info** primary button (48 px) sits inside Section 1, disabled until all required Section 1 fields are valid.
> - On Confirm: validate → Section 1 collapses (collapsible `<details>` component, 150 ms transition) → collapsed header shows job summary line → Section 2 revealed and opened, focus on the scan/enter area → Section 3 revealed but collapsed → footer Save draft / Submit appear.
> - Re-opening Section 1 by tapping its header does not re-hide Sections 2 and 3.
>
> ### Section 2 — Basket Entry
> - Size range strip at top: current size range in large bold text (18 px) + **⟳ New size range** button (44 px). If no size range set: shows "Not set" in amber; Add basket disabled.
> - **New size range** opens a modal with the existing size range options as large tap-target buttons (48 px). **Set size range** and **Cancel** buttons. On Set: strip updates; applies to all subsequent baskets.
> - **Scan barcode** button (56 px): activates `BarcodeDetector` API where supported (feature-detect; hide button gracefully if unsupported — no error). On successful scan: auto-fills basket # field, focus moves to Weight.
> - **Basket # input** (48 px, text). If value starts with "FD"/"fd": inline suggestion "Did you mean [value without FD]?" with one-tap correction. Hint below: *"Basket # = lot code without 'FD'"*.
> - **Weight (kg)** numeric input (48 px, decimal, numeric keyboard).
> - **Add basket** button (56 px full width): disabled until basket # filled and weight > 0 and size range set. On tap: validate → store basket row (basket #, weight, current size range, timestamp) → toast "Basket [#] added — [weight] kg · [size range]" (2 s) → clear basket # and weight fields → focus basket # → update tally strip.
> - Tally strip pinned at the bottom of Section 2: "Baskets added: N · Total weight: X.XX kg" — updates live.
> - Section 2 contains NO list of previously added baskets.
>
> ### Section 3 — Basket List
> - Collapsed by default. Header shows live count and total: "▸ BASKET LIST — N baskets · X.XX kg".
> - Expanded: table of all baskets in order added (basket #, size range, weight, ✕).
> - ✕ delete: confirm toast ("Remove basket [#]? Yes / Keep"), on Yes remove row, update tally and header.
> - Portrait tablet: each basket as a compact card (basket # + size range line 1, weight line 2, ✕ top right). Landscape: standard table, no horizontal scroll.
> - "＋ Add more baskets" link at bottom of list: scroll to Section 2, focus basket # input.
>
> **Do not change:** basket storage keys, database schema, basket validation, OOSW cap rule, CSV export, print/PDF layout.
>
> After building Step 2: show the rendered page, run the §8 testing checklist from `rec-7.1.2-basket-entry-flow-instructions.md`, and report results.
>
> ---
>
> ## Rules that apply to both steps
>
> - **Touch targets:** inputs and secondary buttons ≥ 48 px; primary submit/add buttons ≥ 56 px; destructive (✕) buttons ≥ 40 px; all section headers ≥ 44 px.
> - **Font sizes on tablet/touch (coarse pointer):** field values 18 px, labels 15 px, hints 14 px minimum. Apply via the existing touch media query in `responsive.css`, not inline styles.
> - **Print:** `@media print { details > *:not(summary) { display: block } }` — all sections always print expanded. Print layout is unchanged from today.
> - **No schema changes.** If any existing stored key or column would need to change, stop and flag it before proceeding.
> - **Bump version query strings** on `form-record.js`, `responsive.css`, and the two record page files so no browser loads a stale cached copy.
> - Write a short **work log** at `claude/rec-7.1.2-7.1.5-redesign-worklog.md` recording: files changed, any stored keys that were removed or repointed, test results, and any open items.
