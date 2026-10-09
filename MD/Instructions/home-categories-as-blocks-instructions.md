# Home Screen (Right After Login) — Six Blocks (Instructions for Claude Code)

**Date:** 2026-10-06
**Raised by:** Michaela — "when a user signs in the selections should be blocks" (screen right after login). Block list and moves decided 2026-10-06 (see Decisions line).
**Type:** Layout/presentation change to `public/index.html`, plus two added entries in `pages/fsms.html` and removal of Quick Abalone Receiving. **No change** to links, order, who sees what, login/logout, passkey logic, data or any other page.
**Device:** all floor users are on the Lenovo Tab M8 4th Gen (TB300XU, 8" 1280×800). See `claude/tablet-field-row-alignment-passkey-fix-instructions.md` §1A for how to measure its real CSS viewport. Do that first; the column counts below depend on it.
**Decisions 2026-10-06:** six blocks (§1.1); Quick Abalone Receiving removed (§1.2); Batch Traceability and Specifications move into FSMS (§1.3).
**Related docs:** `claude/tablet-ui-optimisation-brief.md` (type, touch targets, colour rules), `claude/hamburger-dropdown-menu-instructions.md`.

---

## 1. What is wanted

The page the user lands on after signing in (`public/index.html`) currently shows the **Categories** as a plain two-column table (Document | Contents), one thin row per item, with small 12px text. On the tablet these rows are small, hard to hit with a finger, and busy.

Change the selections on that page into **six blocks** (large tappable tiles). Items not yet placed stay in a plain "More" table (§1.4).

### 1.1 The six blocks (decided by Michaela, 2026-10-06)

| # | Block label | Goes to (existing page) | Note |
|---|---|---|---|
| 1 | **Handovers** | `pages/handovers.html` | unchanged target |
| 2 | **Job Progress report** | **two destinations:** `pages/job-status.html` (Job Status) and `pages/dashboard.html` (Dashboard) | Michaela: "job status and dashboards". Neither page is renamed. See §1.1a for how this block works. |
| 3 | **Records** | `records/record-list.html` | today "Record List" |
| 4 | **FSMS** | `pages/fsms.html` | unchanged |
| 5 | **Verification Assignments** | `pages/verifier-assignments.html` | today "Verifier Assignments"; block label only |
| 6 | **Logs** | `pages/submissions-log.html` | today "Submissions & Verifications Log"; block label only |

Order on screen is exactly the order above. Each block keeps its one-line description (reuse today's wording; shorten if it runs past 3 lines).

#### 1.1a Block 2 holds two links

Rule elsewhere is one `<a>` per block; this block is the one exception. Default (no new page needed): the block is a tile with the title **Job Progress report** and, inside it, **two large buttons side by side** (stacked in portrait): **Job Status** → `pages/job-status.html` and **Dashboard** → `pages/dashboard.html`. Each button ≥ 48px tall, 16px gap, no nested `<a>` inside another `<a>` (the tile itself is not a link). Both keep the same `auth-only` visibility they have today.
Alternative if Michaela prefers: the block is a single link to a small new hub page listing those two. Not built unless she asks.

### 1.2 Quick Abalone Receiving — to be removed

Michaela: "the quick abalone receiving should be deleted."

1. **Remove it from the home page** (it is not one of the six blocks and has no row any more).
2. Find every other reference (hamburger menu, Record List / REC 01 index, any link on other pages, manifest/shortcuts, service-worker or cache lists) and remove the link. List them in the work log.
3. **Do not hard-delete the page file or any saved data.** Move `records/quick-abalone-receiving.html` (and its own script/style files if only it uses them) into the existing `junk/` folder so it can be restored, and tell Michaela the exact file names moved. Permanent deletion only after she says so after reviewing.
4. **Do not touch database data.** Anything already saved by that page stays in the database untouched (traceability). Report whether any other page, report, trend or traceability view reads that page's data, so Michaela knows what would break if it is ever fully removed. Also check whether any other record feeds job no. / intake date from it. If yes, stop and ask before moving the file.

### 1.3 Batch Traceability and Specifications move to FSMS (decided 2026-10-06)

- Remove the **Batch Traceability** and **Specifications** rows from the home page.
- Add a Batch Traceability entry **inside the FSMS page** (`pages/fsms.html`), in the same style as the other FSMS entries and in the place that fits its existing layout (top of the list or its own "Traceability" group; state which in the work log). It links to the **same** `records/batch-trace.html`. Add a **Specifications** entry the same way, linking to the **same** `pages/specifications.html`. Do **not** move, rename or edit `batch-trace.html` or `specifications.html` or their URLs, so existing links and bookmarks keep working. Specifications keeps its current rules: everyone signed in can view, only the QA Manager or an Administrator can update a spec.
- Any other page that links to Batch Traceability or Specifications (menu, Record List, REC 01 index, record pages that link to specs) stays as is unless it linked via the home row. List them in the work log.
- Visibility: signed-in only, same as today.
- This is the only edit allowed in `fsms.html`: two added entries (Batch Traceability, Specifications). No other change to that page.

### 1.4 Items still to be placed (Awaiting Verification, Passkeys)

Michaela will say where these go. **Until she does, do not remove them:** keep them in a plain **"More"** table below the blocks, exactly as they are today (same links, same visibility rule), text raised to a 14px minimum. When she decides, this section is updated and the table is removed or reduced.

---

## 2. Design

### 2.1 Block grid

- Replace the `<table class="nav-table">` for the six blocks with a grid of blocks. **One block = one `<a>`** wrapping the whole tile (the entire block is the tap target). No nested links. No JS click handler on the row any more.
- Each block (the six in §1.1) contains: **title** (18px, bold, ink `#1B2330`) and **description** (14px, regular, secondary text `#54606B`, max 3 lines then ellipsis — full text stays in the `title` attribute).
- Block size: min-height **120px**, padding 16px, white surface, 1.5px border `#8A949C`-style field line is **not** needed here; use the existing hairline `#E2E4E3` plus a **4px left accent bar** (this already exists: green for Production, gold for Index). 8px radius. Soft shadow is allowed but keep it subtle (the tablet is low-powered; no animations beyond a 100ms background change).
- **Pressed state** visible without hover (tablet): background `#F4F1E8`, accent bar thickens. Focus ring: 3px gold `#96652B`. No hover-only effects.
- **Gap between blocks: 16px.** Page gutters 16px (portrait) / 24px (landscape).
- Keep the **document order exactly as today**, and keep the **Production → Index** grouping that the accent colours already imply. Add a small section heading above each group only if the list has more than 6 blocks in a group; otherwise a single grid is fine. Section headings use the same sentence-case 18px style as the rest of the app, not 11px all-caps.

### 2.2 Columns on the TB300XU

Measure the tablet's real CSS width first (§1A of the field-row doc), then:

| Orientation (measured width) | Columns |
|---|---|
| Landscape (roughly 900px or more) | **3** |
| Portrait (roughly 560–899px) | **2** |
| Below 560px (phone, if ever used) | **1** |

Use `grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))` **only if** it produces exactly the table above on the real device; otherwise use explicit `repeat(3 / 2 / 1, minmax(0,1fr))` at those breakpoints. Blocks in a row must be the **same height** (grid default `align-items: stretch`). A last row with fewer blocks simply leaves empty cells.

### 2.3 "More" table (temporary)

- Below the blocks: heading **More** and the existing table styling with the §1.4 items (Awaiting Verification, Passkeys).
- Visible only when signed in (same `auth-only` rule as today). Visibility rules for each row stay exactly as today (note in the work log if Passkeys, which is "Administrator only", shows to non-administrators).
- Row height ≥ 48px, text ≥ 14px.

### 2.4 What stays the same

- Signed-out view: today only Handovers and Quick Abalone Receiving show. After this change only **Handovers** shows signed out (Quick Abalone Receiving is removed); everything else stays `auth-only`. Confirm with Michaela that Handovers alone is right for signed-out users.
- `body.authenticated` toggling, `refreshSessionBar()`, Log in / Sign out buttons, session bar text: unchanged.
- Brand bar, header, logos, manifest, preconnect scripts, API health ping: unchanged.
- Every link `href`: unchanged.

---

## 3. Changes, file by file

### 3.1 `public/index.html`

1. In the `<style>` block: remove the table-specific `nav-table` rules for the six blocks (keep them, scoped, for the More table). Add the block-grid rules from §2 under new class names, e.g. `.block-grid`, `.block`, `.block-title`, `.block-desc`.
2. Move the accent colour from `td.document` borders to the block's left border (`.block.production`, `.block.index`). Keep green `#15803D` and gold `#A9763A`. **Purple** (`tr.quality`) is not used by any row; leave it out.
3. `tr.auth-only` / `body.authenticated tr.auth-only` currently show/hide **table rows**. Add the same rule for blocks: `.block.auth-only{display:none}` and `body.authenticated .block.auth-only{display:flex}`. Keep the old rule for the admin rows.
4. Keep the section title ("Categories"); set it to 18px sentence case.
5. Bump `?v=` on any script you edit (none are expected to change).

### 3.2 `pages/fsms.html` and the Quick Abalone Receiving move

Only as described in §1.3 and §1.2.

### 3.3 No other file

Do **not** change `login-ui.js`, `auth.js`, `record-theme.css`, the record pages, the Record List, the hamburger menu, or any admin page. If the login modal itself also has selection controls (e.g. a user picker), **do not change them in this task** — list them in the work log for Michaela.

---

## 4. Do NOT change

No link, order, wording of descriptions, visibility rule, login/logout behaviour, passkey logic, data call or any other page. No new JS layout code (the tablet is a low-powered Helio A22 / 3 GB device: CSS only).

---

## 5. Acceptance checks

On a real TB300XU, landscape and portrait, signed in and signed out:

- [ ] Every one of the six selections is a block; the whole block is tappable; no tiny links.
- [ ] Landscape = 3 columns, portrait = 2 columns (or whatever the measured width gives per §2.2); blocks in a row are equal height; 16px gaps.
- [ ] Block titles 18px, descriptions 14px; nothing on the page under 14px.
- [ ] Pressed state visible on touch; no hover-only behaviour.
- [ ] Exactly six blocks show (Handovers, Job Progress report, Records, FSMS, Verification Assignments, Logs); Job Progress report offers Job Status and Dashboard; the "More" table sits below with the two unplaced items; Quick Abalone Receiving and Batch Traceability and Specifications are gone from the home page; both open from FSMS.
- [ ] Signed out: only the two public blocks show; sign in → the rest appear; sign out → they disappear again.
- [ ] Every link goes to the same page as before.
- [ ] Page loads and scrolls smoothly on the tablet.
- [ ] No other page changed (spot-check Record List, a record, Job Status, Passkeys).

---

## 6. Build order

1. Measure the TB300XU viewport (landscape + portrait) and save screenshots of the current home page as `Claude outputs/home-before/`.
2. Confirm with Michaela where Awaiting Verification and Passkeys go (§1.4), and whether Handovers alone is right for signed-out users.
3. Build §3.1. **Stop and show Michaela** landscape + portrait screenshots, signed in and signed out.
4. Run §5 on the real tablet. Write `claude/home-categories-as-blocks-worklog.md` (what changed, screenshots, anything noticed in §2.3 and §3.2).

---

## 7. Paste-ready prompt for Claude Code

> Read `claude/home-categories-as-blocks-instructions.md` and follow it. Change `public/index.html` (plus Batch Traceability and Specifications entries in `pages/fsms.html`): turn the Categories table on the post-login home page into six large tappable blocks in this order: Handovers, Job Progress report (two buttons inside: Job Status and Dashboard), Records, FSMS, Verification Assignments, Logs (one `<a>` per block, title 18px, description 14px, 4px accent bar, equal heights, 3 columns landscape / 2 portrait on the Lenovo TB300XU — measure its real viewport first). Remove Quick Abalone Receiving from home and move its page to `junk/` (no data deleted; check dependencies first). Keep Awaiting Verification and Passkeys in a plain "More" table below until I say where they go. Keep all links, order, auth-only visibility, session bar and login/logout exactly as they are. CSS only, no new JS. Then stop after the first screenshots for my review. Do not touch any other file (other than the Quick Abalone Receiving move and the two FSMS entries), and list any selection controls in the login modal for me in the work log.
