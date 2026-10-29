// Local keyword-based cert analysis — no external API, no cost.
//
// Strategy: extract keywords from the cert's notes + scope, then score each record
// by how many of those keywords appear in its title, section titles, and field labels.
// Records with at least one keyword match are flagged as affected.

async function assembleAllRecordSummaries(prisma) {
  const defs = await prisma.recordDefinition.findMany({
    include: {
      sections: { orderBy: { position: 'asc' } },
      fields:   { orderBy: { position: 'asc' } },
    },
  });
  return defs.map((def) => ({
    recordKey:     def.recordKey,
    title:         def.title || def.recordKey,
    docCode:       def.docCode || null,
    sectionTitles: def.sections.filter((s) => s.title).map((s) => s.title),
    fieldLabels:   def.fields.filter((f) => f.label).map((f) => f.label),
  }));
}

// Extract meaningful keywords from free text (3+ char words, deduplicated, lowercased).
function extractKeywords(text) {
  if (!text) return [];
  return [...new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s/-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
  )];
}

const STOP_WORDS = new Set([
  'the','and','for','that','this','with','from','are','has','have','been','will',
  'its','not','per','all','any','each','new','was','were','can','may','must',
  'shall','should','used','use','uses','via','etc','inc','ref','see','also',
  'clause','section','annex','part','table','item','items','note','notes',
  'requirements','requirement','standard','standards','specification','specifications',
  'applicable','application','applies','apply','general','specific','including',
  'revised','update','updated','change','changes','changed','edition','version',
]);

// Score how well a record matches a keyword set.
// Returns { score, matchedKeywords, matchedIn }.
function scoreRecord(record, keywords) {
  const haystack = [
    record.title,
    record.docCode || '',
    ...record.sectionTitles,
    ...record.fieldLabels,
  ].join(' ').toLowerCase();

  const matched = keywords.filter((kw) => haystack.includes(kw));
  const matchedIn = [];
  if (matched.length) {
    if (keywords.some((kw) => record.title.toLowerCase().includes(kw))) matchedIn.push('title');
    if (keywords.some((kw) => record.sectionTitles.join(' ').toLowerCase().includes(kw))) matchedIn.push('sections');
    if (keywords.some((kw) => record.fieldLabels.join(' ').toLowerCase().includes(kw))) matchedIn.push('fields');
  }
  return { score: matched.length, matchedKeywords: matched, matchedIn };
}

function buildReason(record, result, certLabel) {
  if (!result.score) {
    return `No fields or sections in ${record.title} relate to the scope of ${certLabel}.`;
  }
  const where = result.matchedIn.length ? result.matchedIn.join(' and ') : 'content';
  const kws = result.matchedKeywords.slice(0, 4).join(', ');
  return `${record.title} contains ${where} referencing: ${kws} — within the scope of ${certLabel}.`;
}

async function analyseAffectedRecords(prisma, { certId, certLabel, prevVersion, newVersion, notes }) {
  const records = await assembleAllRecordSummaries(prisma);

  // Build keyword set from the cert's notes (what changed) plus the certLabel itself
  const keywords = extractKeywords((notes || '') + ' ' + certLabel);

  if (!keywords.length) {
    // Fallback: no keywords extractable — mark everything as needs-review
    return {
      affected: records.map((r) => ({
        recordKey:   r.recordKey,
        recordTitle: r.title,
        reason:      `Could not extract scope keywords — manual review recommended for ${certLabel}.`,
      })),
      not_affected: [],
    };
  }

  const affected = [];
  const not_affected = [];

  for (const record of records) {
    const result = scoreRecord(record, keywords);
    const entry = {
      recordKey:   record.recordKey,
      recordTitle: record.title,
      reason:      buildReason(record, result, certLabel),
    };
    if (result.score > 0) {
      affected.push(entry);
    } else {
      not_affected.push(entry);
    }
  }

  // Sort affected by score descending (most-matching first)
  affected.sort((a, b) => {
    const sa = scoreRecord(records.find((r) => r.recordKey === a.recordKey), keywords).score;
    const sb = scoreRecord(records.find((r) => r.recordKey === b.recordKey), keywords).score;
    return sb - sa;
  });

  return { affected, not_affected };
}

module.exports = { analyseAffectedRecords, assembleAllRecordSummaries };
