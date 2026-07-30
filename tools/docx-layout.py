"""
Dumps the LAYOUT of a source .docx record -- page setup, table geometry, and the
cell-text grid -- so a record page's print/PDF output can be built to match the
paper form instead of guessed at.

    python tools/docx-layout.py "REC 7.2.12 Double Seam Inspection Report_rev 11.docx"
    python tools/docx-layout.py "<full path>.docx" --grid        # include cell text
    python tools/docx-layout.py --list 7.2.12                    # find the source file

A bare filename is resolved against 6. RECORDS/FINAL. No dependencies -- stdlib
zipfile + re, same approach the digitization pass has been using for .docx text.

Word stores lengths in twips (1/20 pt): 1 mm = 56.7 twips. A4 portrait is
11906 x 16838 twips; landscape swaps them. That orientation is the single most
important thing to carry into `@page { size: A4 <orientation> }`.
"""

from __future__ import annotations

import argparse
import re
import sys
import zipfile
from pathlib import Path

FINAL = Path(
    r"T:\Abagold Processing Facility\14. Projects\20. Paperless\6. RECORDS\FINAL"
)

TWIPS_PER_MM = 56.7
A4_SHORT, A4_LONG = 11906, 16838


def mm(twips: int | str) -> float:
    return round(int(twips) / TWIPS_PER_MM, 1)


def resolve(name: str) -> Path:
    p = Path(name)
    if p.is_file():
        return p
    cand = FINAL / name
    if cand.is_file():
        return cand
    matches = [
        m
        for m in FINAL.glob("*.doc*")
        if name.lower() in m.name.lower() and not m.name.startswith("~$")
    ]
    if len(matches) == 1:
        return matches[0]
    if not matches:
        sys.exit(f"No source document matching {name!r} in {FINAL}")
    sys.exit(
        "Ambiguous -- matches:\n  " + "\n  ".join(m.name for m in matches)
    )


def strip_tags(xml: str) -> str:
    """Cell/paragraph text: join <w:t> runs, drop everything else."""
    return " ".join(
        re.sub(r"<[^>]+>", "", t) for t in re.findall(r"<w:t[ >].*?</w:t>", xml, re.S)
    ).strip()


def describe_page(doc: str) -> list[str]:
    out: list[str] = []
    sz = re.search(r'<w:pgSz w:w="(\d+)" w:h="(\d+)"(?: w:orient="(\w+)")?', doc)
    if sz:
        w, h, orient = int(sz.group(1)), int(sz.group(2)), sz.group(3)
        # w:orient is omitted for portrait, so infer from the dimensions too.
        orient = orient or ("landscape" if w > h else "portrait")
        is_a4 = {w, h} == {A4_SHORT, A4_LONG}
        out.append(
            f"page      : {mm(w)} x {mm(h)} mm  ->  "
            f"{'A4' if is_a4 else 'NON-A4'} {orient}"
        )
        out.append(f"  @page   : size: A4 {orient};")
    mar = re.search(
        r'<w:pgMar w:top="(-?\d+)" w:right="(-?\d+)" w:bottom="(-?\d+)" w:left="(-?\d+)"',
        doc,
    )
    if mar:
        t, r, b, l = (mm(g) for g in mar.groups())
        out.append(f"margins   : top {t} right {r} bottom {b} left {l} mm")
        out.append(
            f"  @page   : margin: {t}mm {r}mm {b}mm {l}mm;  "
            f"(existing pages use a tighter 9-12mm -- match siblings, not this)"
        )
    return out


def describe_tables(doc: str, show_grid: bool) -> list[str]:
    out: list[str] = []
    tables = re.findall(r"<w:tbl>.*?</w:tbl>", doc, re.S)
    out.append(f"tables    : {len(tables)}")

    for i, tbl in enumerate(tables, 1):
        cols = [int(c) for c in re.findall(r'<w:gridCol w:w="(\d+)"', tbl)]
        rows = re.findall(r"<w:tr\b.*?</w:tr>", tbl, re.S)
        spans = len(re.findall(r"<w:gridSpan", tbl))
        vmerge = len(re.findall(r"<w:vMerge", tbl))
        total = sum(cols) or 1
        pct = [round(c * 100 / total) for c in cols]

        out.append("")
        out.append(f"  table {i}: {len(cols)} cols x {len(rows)} rows")
        out.append(f"    col %  : {pct}")
        out.append(f"    merges : gridSpan={spans}  vMerge={vmerge}")
        if spans or vmerge:
            out.append(
                "    NOTE   : merged cells -- a flat column-per-field HTML table will "
                "not reproduce this. Check whether it is a header band (colspan) or a "
                "grouped row label (rowspan)."
            )
        # A wide grid on a portrait page is the classic reason a print layout
        # overflows: flag it so the agent reaches for landscape or a split.
        if len(cols) >= 12:
            out.append(
                f"    WARN   : {len(cols)} columns is wide for portrait A4 -- expect to "
                "need landscape, a smaller print font-size, or a two-block split."
            )

        if show_grid:
            out.append("    cells  :")
            for r_i, row in enumerate(rows, 1):
                cells = [
                    strip_tags(c)
                    for c in re.findall(r"<w:tc>.*?</w:tc>", row, re.S)
                ]
                if any(cells):
                    label = " | ".join(c if c else "-" for c in cells)
                    out.append(f"      r{r_i:<3}: {label[:200]}")
    return out


def describe_header(z: zipfile.ZipFile) -> list[str]:
    out: list[str] = []
    heads = [n for n in z.namelist() if re.match(r"word/header\d+\.xml$", n)]
    for h in heads:
        text = strip_tags(z.read(h).decode("utf8", "ignore"))
        if text:
            out.append(f"{h}: {text[:300]}")
    imgs = [n for n in z.namelist() if n.startswith("word/media/")]
    if imgs:
        out.append(f"media (logos/images): {len(imgs)} -> {[Path(i).name for i in imgs]}")
    if out:
        out.insert(0, "repeating header (becomes the fixed print header):")
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("source", nargs="?", help="Filename or full path of the .docx")
    ap.add_argument("--grid", action="store_true", help="Include cell text per row.")
    ap.add_argument("--list", metavar="SUBSTR", help="List matching source files and exit.")
    args = ap.parse_args()

    if args.list:
        for m in sorted(FINAL.glob("*.doc*")):
            if args.list.lower() in m.name.lower() and not m.name.startswith("~$"):
                print(m.name)
        return 0

    if not args.source:
        ap.error("give a source filename, or --list SUBSTR to find one")

    path = resolve(args.source)
    if path.suffix.lower() != ".docx":
        sys.exit(
            f"{path.name} is not a .docx -- legacy .doc has no XML layout to read. "
            "Open it in Word and save as .docx first, or fall back to antiword for text."
        )

    print(f"source    : {path.name}")
    with zipfile.ZipFile(path) as z:
        doc = z.read("word/document.xml").decode("utf8", "ignore")
        for line in describe_page(doc):
            print(line)
        for line in describe_header(z):
            print(f"  {line}" if not line.endswith(":") else line)
        print()
        for line in describe_tables(doc, args.grid):
            print(line)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
