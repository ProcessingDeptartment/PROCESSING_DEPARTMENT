// Calls the Claude API to analyse which record forms are affected by a certification update.
// Returns { affected: [...], not_affected: [...] } (see MD/certification-version-update-instructions.md §5).

const Anthropic = require('@anthropic-ai/sdk');

async function assembleAllRecordSummaries(prisma) {
  const defs = await prisma.recordDefinition.findMany({
    include: {
      sections: { orderBy: { position: 'asc' } },
      fields:   { orderBy: { position: 'asc' } },
    },
  });

  return defs.map((def) => {
    const sectionTitles = def.sections
      .filter((s) => s.title)
      .map((s) => s.title);

    const fieldLabels = def.fields
      .filter((f) => f.label)
      .map((f) => f.label);

    return {
      recordKey:     def.recordKey,
      title:         def.title || def.recordKey,
      docCode:       def.docCode || null,
      sectionTitles,
      fieldLabels,
    };
  });
}

async function analyseAffectedRecords(prisma, { certId, certLabel, prevVersion, newVersion, notes }) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const records = await assembleAllRecordSummaries(prisma);

  const recordsSummary = records.map((r) => {
    const code = r.docCode ? `${r.docCode} — ` : '';
    const secs = r.sectionTitles.length ? `\n  Sections: ${r.sectionTitles.join(', ')}` : '';
    const flds = r.fieldLabels.length   ? `\n  Fields: ${r.fieldLabels.join(', ')}`   : '';
    return `${r.recordKey} — ${code}${r.title}${secs}${flds}`;
  }).join('\n\n');

  const prompt = `You are a food safety compliance assistant for a South African abalone processing facility.

A certification has been updated:
- Standard: ${certLabel}
- ID: ${certId}
- Previous version: ${prevVersion ?? 'unknown'}
- New version: ${newVersion}
- What changed: ${notes ?? 'Not specified'}

Below are all active record forms. For each, determine whether it is affected by an update to this standard.
A record is affected if its fields, measurements, limits, labelling or procedures fall within the scope of this standard.

Return ONLY valid JSON — an object with two arrays:
"affected" and "not_affected".
Each item: { "recordKey": string, "recordTitle": string, "reason": string (one sentence) }

Records:
${recordsSummary}`;

  const message = await client.messages.create({
    model:      'claude-opus-4-5',
    max_tokens: 4096,
    messages:   [{ role: 'user', content: prompt }],
  });

  const raw = message.content[0].text;
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Agent returned no JSON: ' + raw.slice(0, 200));
  return JSON.parse(match[0]);
}

module.exports = { analyseAffectedRecords, assembleAllRecordSummaries };
