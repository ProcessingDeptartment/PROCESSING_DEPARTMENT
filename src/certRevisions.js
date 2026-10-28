// Certification version-update tracking (MD/certification-version-update-instructions.md).
//
// Flow:
//   POST /api/cert-revisions          → run agent, store draft, return proposal
//   POST /api/cert-revisions/:id/confirm → admin confirms list, create CertRecordReview rows
//   GET  /api/cert-revisions/pending-for-record/:recordKey
//   PATCH /api/cert-revisions/record-review/:reviewId  → QA sign-off
//   GET  /api/cert-revisions/history/:certId
//   GET  /api/cert-revisions          → list all revisions (admin dashboard)

const path = require('path');
const fs   = require('fs');
const { execFile } = require('child_process');
const { analyseAffectedRecords } = require('./services/certAnalysisAgent');

const CERTS_JSON_PATH = path.join(__dirname, '..', 'certifications', 'certifications.json');

function readCertsJson() {
  try { return JSON.parse(fs.readFileSync(CERTS_JSON_PATH, 'utf8')); } catch { return null; }
}

function writeCertsJson(data) {
  fs.writeFileSync(CERTS_JSON_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function git(args, cwd) {
  return new Promise((resolve) => {
    execFile('git', args, { cwd }, (err, stdout, stderr) => {
      if (err) console.error('git', args.join(' '), 'failed:', stderr || err.message);
      resolve(!err);
    });
  });
}

async function commitCertsJson(message) {
  try {
    const repoRoot = path.join(__dirname, '..');
    await git(['add', CERTS_JSON_PATH], repoRoot);
    await git(['commit', '-m', message], repoRoot);
    await git(['push'], repoRoot);
  } catch (e) {
    console.error('certifications.json git commit/push failed:', e.message);
  }
}

function mount(app, prisma) {
  // List all revisions (admin dashboard)
  app.get('/api/cert-revisions', async (req, res) => {
    try {
      const revisions = await prisma.certRevision.findMany({
        orderBy: { createdAt: 'desc' },
        include: { recordReviews: true },
      });
      res.json(revisions);
    } catch (e) {
      console.error('GET cert-revisions failed', e);
      res.status(500).json([]);
    }
  });

  // POST /api/cert-revisions — log revision + run agent analysis (returns draft + proposal)
  app.post('/api/cert-revisions', async (req, res) => {
    try {
      const { certId, prevVersion, newVersion, detectedBy, notes, sourceFile } = req.body || {};
      if (!certId || !newVersion || !detectedBy) {
        return res.status(400).json({ ok: false, error: 'certId, newVersion and detectedBy are required' });
      }

      const certs = readCertsJson();
      const certEntry = certs ? certs.certifications.find((c) => c.id === certId) : null;
      const certLabel = certEntry ? certEntry.name : certId;

      // Run the agent
      let agentResult;
      try {
        agentResult = await analyseAffectedRecords(prisma, { certId, certLabel, prevVersion, newVersion, notes });
      } catch (e) {
        console.error('Agent analysis failed', e);
        return res.status(502).json({ ok: false, error: 'Agent analysis failed: ' + e.message });
      }

      // Store draft revision (no CertRecordReview rows yet)
      const revision = await prisma.certRevision.create({
        data: {
          certId, certLabel,
          prevVersion: prevVersion || null,
          newVersion,
          detectedBy,
          sourceFile: sourceFile || null,
          notes: notes || null,
          agentSuggestion: JSON.stringify(agentResult),
          reviewStatus: 'draft',
        },
      });

      res.json({
        draftRevisionId: revision.id,
        affected:     (agentResult.affected     || []).map((r) => ({ recordKey: r.recordKey, recordTitle: r.recordTitle, agentReason: r.reason })),
        not_affected: (agentResult.not_affected || []).map((r) => ({ recordKey: r.recordKey, recordTitle: r.recordTitle, agentReason: r.reason })),
      });
    } catch (e) {
      console.error('POST cert-revisions failed', e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // POST /api/cert-revisions/:draftId/confirm — admin confirms the list
  app.post('/api/cert-revisions/:draftId/confirm', async (req, res) => {
    try {
      const { draftId } = req.params;
      const { confirmedRecords } = req.body || {};

      if (!Array.isArray(confirmedRecords)) {
        return res.status(400).json({ ok: false, error: 'confirmedRecords must be an array' });
      }

      const revision = await prisma.certRevision.findUnique({ where: { id: draftId } });
      if (!revision) return res.status(404).json({ ok: false, error: 'Draft revision not found' });
      if (revision.reviewStatus !== 'draft') {
        return res.status(409).json({ ok: false, error: 'Revision already confirmed' });
      }

      // Create CertRecordReview rows + update revision status in one transaction
      await prisma.$transaction(async (tx) => {
        await tx.certRevision.update({
          where: { id: draftId },
          data:  { reviewStatus: 'pending' },
        });
        await tx.certRecordReview.createMany({
          data: confirmedRecords.map((r) => ({
            certRevisionId: draftId,
            recordKey:      r.recordKey,
            recordLabel:    r.recordLabel || r.recordTitle || null,
            agentReason:    r.agentReason || null,
          })),
        });
      });

      // Update certifications.json
      const certs = readCertsJson();
      if (certs) {
        const idx = certs.certifications.findIndex((c) => c.id === revision.certId);
        if (idx !== -1) {
          if (!certs.certifications[idx].revisions) certs.certifications[idx].revisions = [];
          certs.certifications[idx].revisions.push({
            version:      revision.newVersion,
            revisionId:   draftId,
            detectedDate: revision.detectedDate,
            detectedBy:   revision.detectedBy,
            notes:        revision.notes || null,
          });
          certs.certifications[idx].currentVersion  = revision.newVersion;
          certs.certifications[idx].activeRevisionId = draftId;
          writeCertsJson(certs);
          await commitCertsJson(
            `cert: log ${revision.certLabel} update to ${revision.newVersion}\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`
          );
        }
      }

      res.json({ ok: true, revisionId: draftId, affectedCount: confirmedRecords.length });
    } catch (e) {
      console.error('POST cert-revisions confirm failed', e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // GET /api/cert-revisions/pending-for-record/:recordKey — called by form banner check
  app.get('/api/cert-revisions/pending-for-record/:recordKey', async (req, res) => {
    try {
      const { recordKey } = req.params;
      const reviews = await prisma.certRecordReview.findMany({
        where: { recordKey, status: 'pending' },
        include: { certRevision: true },
      });
      if (!reviews.length) return res.json([]);
      const result = reviews.map((r) => ({
        reviewId:    r.id,
        certId:      r.certRevision.certId,
        certLabel:   r.certRevision.certLabel,
        newVersion:  r.certRevision.newVersion,
        detectedDate: r.certRevision.detectedDate,
        notes:       r.certRevision.notes,
        agentReason: r.agentReason,
      }));
      res.json(result);
    } catch (e) {
      console.error('GET pending-for-record failed', e);
      res.status(500).json([]);
    }
  });

  // PATCH /api/cert-revisions/record-review/:reviewId — QA/Admin sign-off
  app.patch('/api/cert-revisions/record-review/:reviewId', async (req, res) => {
    try {
      const { reviewId } = req.params;
      const { status, reviewedBy, reviewNote, passkey } = req.body || {};

      if (!['reviewed-no-change', 'updated'].includes(status)) {
        return res.status(400).json({ ok: false, error: 'status must be reviewed-no-change or updated' });
      }
      if (!reviewedBy) return res.status(400).json({ ok: false, error: 'reviewedBy is required' });

      const review = await prisma.certRecordReview.update({
        where: { id: reviewId },
        data:  { status, reviewedBy, reviewNote: reviewNote || null, passkey: passkey || null, reviewedAt: new Date() },
      });

      // Check if all reviews for this revision are now resolved
      const remaining = await prisma.certRecordReview.count({
        where: { certRevisionId: review.certRevisionId, status: 'pending' },
      });

      if (remaining === 0) {
        await prisma.certRevision.update({
          where: { id: review.certRevisionId },
          data:  { reviewStatus: 'complete', reviewCompletedAt: new Date() },
        });
        // Clear activeRevisionId in certifications.json
        const revision = await prisma.certRevision.findUnique({ where: { id: review.certRevisionId } });
        const certs = readCertsJson();
        if (certs && revision) {
          const idx = certs.certifications.findIndex((c) => c.id === revision.certId);
          if (idx !== -1 && certs.certifications[idx].activeRevisionId === review.certRevisionId) {
            delete certs.certifications[idx].activeRevisionId;
            writeCertsJson(certs);
            await commitCertsJson(
              `cert: ${revision.certLabel} v${revision.newVersion} review complete\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`
            );
          }
        }
        return res.json({ ok: true, revisionComplete: true });
      }

      res.json({ ok: true, revisionComplete: false, remaining });
    } catch (e) {
      console.error('PATCH record-review failed', e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  // GET /api/cert-revisions/history/:certId — all revisions for one cert, newest first
  app.get('/api/cert-revisions/history/:certId', async (req, res) => {
    try {
      const revisions = await prisma.certRevision.findMany({
        where:   { certId: req.params.certId },
        orderBy: { createdAt: 'desc' },
        include: { recordReviews: true },
      });
      res.json(revisions);
    } catch (e) {
      console.error('GET cert-revisions history failed', e);
      res.status(500).json([]);
    }
  });
}

module.exports = { mount };
