# REC 7.4.0 Dry Cooking — pots section fixes (tablet toggle + PDF line)

Date: 2026-09-30. Instructions only, no code written. For Claude Code. Companion to `dry-cooking-pots-roster-instructions.md` (that file stays the full spec; this file is the fix list for what was seen on the built page).

Reported by Michaela after testing the built page:
1. On a tablet, pressing "+ Add pot" does not scroll down / open to show the new section.
2. A green tally line appears on the PDF (wrong).
3. The pots section in general is "not great".

Files involved (from reading the current build): `public/lib/form-record.js` (v56) — the pots chooser wiring near "processChoice" (`fr_potChoose`, `fr_addRosterRowBtn`), `container._addRow` (the add-a-card function), and `sheetOneRosterHtml` (the print sheet builder), plus the record definition `dry-cooking.json` (`roster.totals`). Do not touch other records; every change below must be gated behind the existing `processChoice` / `cardRows` roster options so other records print and behave exactly as today.

## Fix 1 — "+ Add pot" must bring the new section into view on a tablet

What happens today: pressing "+ Add pot" only reveals a small "Which process?" chooser (Blanching / Cooking) further down the page; it is not scrolled into view. After choosing, a new card is added and the code focuses its first field, but on a tablet the on-screen keyboard opens and the page does not scroll to the card, so the operator sees nothing change.

Required behaviour:
1. **One tap to add.** Replace the two-step "+ Add pot" then choose with two buttons shown together under the last card: **"+ Add blanching pot"** and **"+ Add cooking pot"**. When there are no cards yet, the same two buttons show (large, full width on a tablet). This removes the hidden chooser entirely, so nothing has to "toggle down".
2. **Scroll to the new card.** After a card is added, smooth-scroll so the top of the new card sits just below the sticky header, on every device. Do this after the card is drawn (next animation frame), and again once the keyboard settles if a field is focused.
3. **Do not auto-open the keyboard on tablets.** Focus the first field only on non-touch screens. On touch screens leave focus alone so the card is fully visible and the operator taps the field they want. (First field is Abalone weight (kg).)
4. **Keep the add buttons reachable.** After adding, the buttons move below the new card; the page must not jump back to the top. The previous cards stay where they are.
5. Same behaviour after removing a card (no jump to the top) and after loading a saved draft (page stays at the top of the record, not scrolled down to the pots).
6. Optional but recommended: once a card has its required fields filled and the operator adds the next card, collapse the earlier card to a one-line summary ("Pot 1 — Cooking — 120 kg — Edit") so the page does not become very long on a tablet. Reopening is one tap. Collapsed cards still print in full. Skip this if it risks the "no other record changes" rule.

Test: on a tablet (or 1024 x 768 and 768 x 1024), open a new entry, add three pots in a row — each new card is visible without manual scrolling, the keyboard does not open by itself, and the add buttons are still on screen.

## Fix 2 — Remove the green tally line from the PDF

What happens today: the printed sheet appends a totals line under the pots ("Pots: 2 · Blanching kg: … · Cooking kg: …", built from `roster.totals`) and it shows in green on the PDF. This is a screen convenience, not part of the paper record.

Required behaviour:
- **Do not print the totals/tally line.** The PDF and print view show only the pot cards (Pot 1 — Blanching, Pot 2 — Cooking, …), exactly like the paper record, with no summary line before or after them.
- The tally stays on screen as a small grey helper under the cards (as it is today on screen) and may also stay in the on-screen submitted view; it must not appear in print/PDF.
- Also check the print CSS for any green colouring, border or background on pots content (the green "good answer" colour used on Yes/No answers must not leak onto totals, card titles or rules). Print must be black on white like the rest of the sheet.
- Check the OOSW warning line keeps printing as it does today (a genuine red warning, only when overridden).

Test: submit an entry with 2 Cooking and 1 Blanching pot, open the PDF: three pot cards, no tally line, nothing green except (if you use it) nothing at all; job info and sign-off unchanged.

## Fix 3 — Pots section usability ("not great")

Michaela has not said exactly what is wrong. Until she does, apply these safe improvements, all inside the pots area only:
- Add buttons as in Fix 1 (one tap, large).
- Card title bar shows "Pot n — Blanching" or "Cooking" in a clear coloured tag so the two process types are easy to tell apart at a glance (screen only; print stays black and white).
- Remove button on each card is smaller and needs a confirm if the card has data.
- Row layout follows the spec (row 1 four fields, row 2 and row 3 three fields, total time last); on a tablet in portrait, wrap to two columns rather than shrinking fields.
- Keep the greyed-out "Temp 20 min after" on Blanching cards.

## Testing checklist (add to the spec's checklist)

1. Tablet landscape and portrait: "+ Add blanching pot" / "+ Add cooking pot" add a card and scroll it into view; no keyboard pops up by itself.
2. Adding, removing and reloading a draft never leave the page scrolled somewhere wrong.
3. PDF and print: pot cards only, no tally line, no green.
4. Other records with rosters (any record without `processChoice`) print and behave exactly as before.
5. On-screen tally still updates (pots count, blanching kg, cooking kg) and OOSW still counts Cooking cards only.
