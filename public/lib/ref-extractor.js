// ref-extractor.js — extract record/spec/cert cross-references from SOP/procedure plain text.
// Returns an array of { targetType, targetKey, matchText, contextText }.
// Plain ES module: works in <script type="module"> and in Node (import).

const REC_RE   = /\bREC\s*(\d+(?:\.\d+)*[a-z]?)\b/gi;
const SANS_RE  = /\bSANS\s*(\d+(?::\d+)?)\b/gi;
const ISO_RE   = /\bISO(?:\/TS\s*)?(\d+(?:[:\-]\d+)*(?:[:\-]\d+)?)\b/gi;
const VC_RE    = /\bVC\s*(\d+(?::\d+)?)\b/gi;
const FSSC_RE  = /\bFSSC\s*22000(?:\s*[Vv]\d+)?\b/gi;
const HACCP_RE = /\bHACCP\b/g;
const PRO_RE   = /\bPRO\s*(\d+(?:\.\d+)*)\b/gi;

export function extractReferences(text) {
  if (!text) return [];
  const refs = [];
  const seen = new Set();

  function add(targetType, targetKey, match, index) {
    const key = `${targetType}:${targetKey}`;
    if (seen.has(key)) return;
    seen.add(key);
    const start = Math.max(0, index - 60);
    const end   = Math.min(text.length, index + match.length + 60);
    const ctx   = (start > 0 ? '\u2026' : '') +
                  text.slice(start, end).replace(/\s+/g, ' ').trim() +
                  (end < text.length ? '\u2026' : '');
    refs.push({ targetType, targetKey, matchText: match, contextText: ctx.slice(0, 200) });
  }

  for (const m of text.matchAll(REC_RE)) {
    const key = 'REC-' + m[1].replace(/\s/g, '').toUpperCase();
    add('record', key, m[0], m.index);
  }
  for (const m of text.matchAll(SANS_RE)) {
    add('spec', 'SANS-' + m[1], m[0], m.index);
  }
  for (const m of text.matchAll(ISO_RE)) {
    add('spec', 'ISO-' + m[1].replace(/[\s\/]/g, '-'), m[0], m.index);
  }
  for (const m of text.matchAll(VC_RE)) {
    add('spec', 'VC-' + m[1], m[0], m.index);
  }
  for (const m of text.matchAll(FSSC_RE)) {
    add('certification', 'FSSC-22000', m[0], m.index);
  }
  for (const m of text.matchAll(HACCP_RE)) {
    add('certification', 'HACCP-SANS10330', m[0], m.index);
  }
  for (const m of text.matchAll(PRO_RE)) {
    add('procedure', 'PRO-' + m[1], m[0], m.index);
  }

  return refs;
}
