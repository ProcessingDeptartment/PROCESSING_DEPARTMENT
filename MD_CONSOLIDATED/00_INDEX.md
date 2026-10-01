# Processing Department: Markdown Index

All project markdown consolidated into this one folder (`MD_CONSOLIDATED`), grouped by topic. Start with `01`.

| File | Topic | Source docs merged |
|---|---|---|
| [01_System-Overview-and-Plan.md](01_System-Overview-and-Plan.md) | System Overview, Plans and Business Rules | 7 |
| [02_Database-and-Relational-Design.md](02_Database-and-Relational-Design.md) | Database and Relational Design (Neon / Postgres) | 7 |
| [03_Traceability-and-Field-Reference.md](03_Traceability-and-Field-Reference.md) | Traceability and Field Reference | 7 |
| [04_ERP-Integration.md](04_ERP-Integration.md) | ERP Integration (Syspro / ERPNext) | 2 |
| [05_Canning-Records-Reports-and-Job-Status.md](05_Canning-Records-Reports-and-Job-Status.md) | Canning Records, Canning Report, Job Status and NRCS | 13 |
| [06_Dry-Processing-Records-REC-7.4.md](06_Dry-Processing-Records-REC-7.4.md) | Dry Processing Records (REC 7.4.x) and Dry Export Pack | 16 |
| [07_UI-UX-Tablet-and-Layout.md](07_UI-UX-Tablet-and-Layout.md) | UI / UX: Tablet, Mobile, Layout and Navigation | 13 |
| [08_REC-7.1-Receiving-Salting-and-Form-Changes.md](08_REC-7.1-Receiving-Salting-and-Form-Changes.md) | REC 7.1 Records and General Form Changes | 6 |
| [09_Authentication-Signoff-and-Passkeys.md](09_Authentication-Signoff-and-Passkeys.md) | Authentication, Sign-off and Passkeys | 6 |

## 01_System-Overview-and-Plan.md

Where the project stands, what is decided, what is open, and the rules the system enforces.

- Processing Department — Front-End Development (`README.md`)
- Processing Department — Consolidated Plan & Open Decisions (`claude/consolidated-plan.md`)
- Processing Department — Next Steps Work Plan (`claude/next-steps-workplan.md`)
- Business rules registry (`claude/business-rules.md`)
- Backend integration — the space left for it (`claude/BACKEND_INTEGRATION.md`)
- Intelligent Agent Role-Out Template — Production Record Design Pattern (`claude/intelligent-agent-role-out-template.md`)
- Render build failure — 2026-09-11 (resolved, transient) (`claude/render-build-failure-2026-09-11.md`)

## 02_Database-and-Relational-Design.md

Relational architecture, schema plans, table typing, live audits and seeding. Database is the vital piece.

- Moving PROCESSING_DEPARTMENT off the generic KeyValue store onto relational Postgres (`Claude outputs/relational-architecture.md`)
- Relational Neon for all records — DB is the source of truth, frontend layout unchanged (`Claude outputs/relational-all-records-plan.md`)
- Relational slice #1 — RecordLink + the four export-batch records (`Claude outputs/relational-export-batch-slice.md`)
- Type the submission tables — build spec for Claude Code (`claude/submission-table-typing-spec.md`)
- Neon Database — Live Audit (2026-09-14): Operations Comparison vs Syspro, Corrected (`claude/neon-db-live-audit.md`)
- Definition-extraction report (`Claude outputs/definition-extraction-report.md`)
- Grading log layout: seeded to Neon (2026-09-29) (`Claude outputs/grading-layout-seed-2026-09-29.md`)

## 03_Traceability-and-Field-Reference.md

How batches are traced, field inventory, identifier questions and work-instruction content.

- Batch traceability (`claude/TRACEABILITY.md`)
- Export Batch Linking — Dry Export Pack Front Page (`Claude outputs/export-batch-linking-spec.md`)
- Processing Department — Complete Field Inventory (Final Live Audit) (`claude/Processing-Department-Field-Inventory.md`)
- Note: "Production code" vs "AG code" — are they the same identifier? (`claude/PRODUCTION_CODE_VS_AG_CODE.md`)
- Note: "Checked by" vs "Checked by (QC)" — label and key variants (`claude/CHECKED_BY_FIELD_VARIANTS.md`)
- Work Instructions — Full Content Extract (`claude/Work-Instructions-Content-Extract.md`)
- Work Instructions Field — Visibility Note (`claude/Work-Instructions-Visibility.md`)

## 04_ERP-Integration.md

Planning and prep for reconciling with the ERP.

- Syspro → ERPNext → Processing Department — Integration Spec (planning, not yet buildable) (`claude/erpnext-integration-spec.md`)
- ERP Reconciliation Prep — Field Types + Job Numbering (the two "do now" items) (`claude/erp-reconciliation-prep.md`)

## 05_Canning-Records-Reports-and-Job-Status.md

Canning production record, canning report, job status/details and NRCS canning roster work.

- Canning Production Record — Design & Layout Instructions (`claude/canning-production-record-design-instructions.md`)
- Canning Production Record — Technical Specification for Implementation (`claude/canning-production-record-technical-spec.md`)
- Canning Report — Correct Layout Spec (source of truth: CPR02170) (`claude/canning-report-layout-spec.md`)
- Canning Report — Improvement Brief for Claude Design (`claude/canning-report-design-improvements-brief.md`)
- Canning Report — Data Improvement Suggestions (based on CPR02170) (`claude/canning-report-data-improvement-suggestions.md`)
- Canning Report — Three Fixes Requested by Michaela (2026-09-17) (`claude/canning-report-fixes-2026-09-17.md`)
- Canning Report / Job Status changes — 2026-09-11 (`Claude outputs/canning-report-and-job-status-changes.md`)
- Job Details Entry — Brief for Claude Design (updated 2026-09-11) (`claude/job-details-modal-design-brief.md`)
- Job Status — Job Details bugs and corrected rule (updated 2026-09-11) (`claude/job-status-bugfix-brief.md`)
- Instruction file for Claude Code (`claude/nrcs-canning-production-codes-roster-instructions.md`)
- Instruction file for Claude Code (`claude/nrcs-canning-batch-search-instructions.md`)
- Instruction file for Claude Code (`claude/nrcs-canning-add-view-verify-gate-instructions.md`)
- Testing checklist — NRCS Canning roster Add → View → Verify flow (`claude/nrcs-canning-roster-verification-testing-checklist.md`)

## 06_Dry-Processing-Records-REC-7.4.md

Dry cooking, drying process, dry monitoring, grading/collection bins, dry export pack and drying report.

- Drying Report — Build Spec for Claude Code (`claude/drying-report-spec.md`)
- REC 7.4.0 Dry Cooking — "Blanching or Cooking" selector (`Claude outputs/dry-cooking-blanching-or-cooking-selector-instructions.md`)
- REC 7.4.0 Dry Cooking — Blanching weight rule, cooking vs blanching, "available to cook" (`Claude outputs/rec-7.4.0-blanching-cooking-weight-rules-instructions.md`)
- REC 7.4.1 Drying Process — Refinement (one job, many daily entries: movements, trolleys, steaming) (`Claude outputs/drying-process-refinement-instructions.md`)
- REC 7.4.1 Drying Process — As Built (`claude/rec-7-4-1-drying-process-as-built.md`)
- REC 7.4.1 Drying Process: rename "Job so far", remove the Steams section (`rec-7.4.1-progress-of-product-rename-and-steam-section-removal-instructions.md`)
- REC 7.4.2 Dry Monitoring: field changes (build summary) (`Claude outputs/rec-7-4-2-dry-monitoring-changes-summary.md`)
- REC 7.4.2 Dry Monitoring: Job info section split (2026-10-01) (`Claude outputs/rec-7-4-2-section-split-work-log.md`)
- REC 7.4.2 Dry Monitoring: Job info section has taken over, and the whole form collapses (instructions for Claude Code) (`rec-7.4.2-job-info-section-split-instructions.md`)
- REC 7.4.3.1 / 7.4.3.2 — Grading Production Log: Collection bins (`docs/REC-7.4.3-collection-bins.md`)
- REC 7.4.3.1 and 7.4.3.2: Totals section starts collapsed (instructions for Claude Code) (`rec-7.4.3-totals-section-start-collapsed-instructions.md`)
- REC 7.4.4 Grading, Boxing & Traceability: replace the input form with a report (instructions for Claude Code) (`rec-7.4.4-replace-form-with-report-instructions.md`)
- Give every monitoring log the same COMPLETED BY block (`Claude outputs/monitoring-logs-completed-by-block-instructions.md`)
- Dry Export Pack Front Page — auto-populated Attachment Checklist (instructions for Claude Code) (`claude/dry-export-pack-attachment-checklist-instructions.md`)
- Dry Export Pack Front Page — Attachment Checklist Rework (`Claude outputs/dry-export-pack-checklist-worklog.md`)
- Dry Export Pack Front Page — rebuild from the paper form (instructions for Claude Code) (`Claude outputs/dry-export-pack-front-page-rebuild-instructions.md`)

## 07_UI-UX-Tablet-and-Layout.md

Tablet optimisation, layout redesign, fonts, menu, collapsible sections and page-level UI changes.

- Processing Department — Tablet UI Optimisation Brief (`Claude outputs/tablet-ui-optimisation-brief.md`)
- Tablet UI Implementation Instructions (for Claude Code) (`claude/tablet-ui-implementation-instructions.md`)
- Tablet UI v2 — as built (`claude/tablet-ui-v2-as-built.md`)
- Processing Department — Tablet Record-Entry Redesign Instructions for Claude Code (`claude/layout-redesign-instructions.md`)
- Record Pages — Field Alignment & Layout Fix (Instructions for Claude Code) (`claude/record-page-field-alignment-fix-instructions.md`)
- Replace the Left Sidebar with a Top-Right Hamburger Dropdown — Every Record, All UI (`Claude outputs/hamburger-dropdown-menu-instructions.md`)
- Home Page — Remove the "Production — this month" Summary (`home-remove-this-month-summary-instructions.md`)
- Record Pages — Collapsible Sections, Auto-Focus Job No., Auto-Collapse Job Info (Instructions for Claude Code) (`Claude outputs/record-sections-collapse-and-job-autofocus-instructions.md`)
- Record collapse / Job-info auto-collapse / job auto-focus — work log (2026-10-01) (`claude/record-collapse-autofocus-worklog.md`)
- Mobile & Tablet Font Responsiveness — Work Done (`claude/mobile-tablet-font-responsiveness.md`)
- Instruction: Mobile & Tablet Font Responsiveness (`Claude outputs/mobile-responsive-fonts-instruction.md`)
- Time fields → clock selector (`Claude outputs/time-fields-clock-selector.md`)
- Instructions: Move "Edit Template" off record pages into an index section (`claude/EDIT_TEMPLATE_RELOCATION.md`)

## 08_REC-7.1-Receiving-Salting-and-Form-Changes.md

REC 7.1 / 7.1.3 field changes, draft-source warning and product description split.

- Instructions: REC 7.1 field changes + "Edit Template" relocation (`claude/REC_EDITS_INSTRUCTIONS.md`)
- Instructions: REC 7.1 (Incubator Cans Log) field changes (`claude/REC_7.1_FIELD_CHANGES.md`)
- REC 7.1.3 — Salting and Tumbling: change notes (`Claude outputs/REC-7.1.3-changes.md`)
- Work log — REC 7.1.3 changes + page load performance (`claude/REC7.1.3andloadperformanceworklog.md`)
- Draft-source warning on job-scoped record forms (`claude/2026-09-07-draft-source-job-warning.md`)
- Split Product Description into Medium + Drained Weight Dropdowns (`claude/product-description-field-split-instructions.md`)

## 09_Authentication-Signoff-and-Passkeys.md

Sign-off/login fixes, Completed-by migration and the passkey implementation package.

- Sign-off / login gate fixes — 2026-09-22 (`claude/SIGNOFF-LOGIN-FIX-2026-09-22.md`)
- Finish the Sign-off → "Completed by" migration (`SIGNOFF_MIGRATION_TODO.md`)
- Passkey Signature Authentication - Implementation Package (`PASSKEY_IMPLEMENTATION_PACKAGE/README.md`)
- Passkey Authentication for Signature Verification (`PASSKEY_IMPLEMENTATION_PACKAGE/PASSKEY_AUTHENTICATION.md`)
- Implementation Guide: Passkey Authentication (`PASSKEY_IMPLEMENTATION_PACKAGE/IMPLEMENTATION_GUIDE.md`)
- ✅ Delivery Checklist: Passkey Authentication Package (`PASSKEY_IMPLEMENTATION_PACKAGE/DELIVERY_CHECKLIST.md`)

## Duplicates not repeated

These were byte-identical (or an older edit) of a file that is included, so they were left out of the merged files:

- `claude/nrcs-canning-add-view-verify-gate-instructions.md` — identical copy: Claude outputs/CLAUDE_CODE_INSTRUCTIONS-nrcs-canning-add-view-verify-gate.md
- `Claude outputs/CLAUDE_CODE_INSTRUCTIONS-nrcs-canning-add-view-verify-gate.md` — identical copy of claude/nrcs-canning-add-view-verify-gate-instructions.md
- `Claude outputs/CLAUDE_CODE_INSTRUCTIONS-nrcs-canning-production-codes-roster.md` — identical copy of claude/nrcs-canning-production-codes-roster-instructions.md
- `claude/20260907draftsourcejobwarning.md` — identical copy of claude/2026-09-07-draft-source-job-warning.md
- `Claude outputs/REC-7.1.3-and-load-performance-worklog.md` — identical copy of claude/REC7.1.3andloadperformanceworklog.md
- `claude/mobiletabletfontresponsiveness.md` — identical copy of claude/mobile-tablet-font-responsiveness.md
- `Claude outputs/home-remove-this-month-summary-instructions.md` — older version (2026-10-01 earlier edit) of the root home-remove-this-month-summary-instructions.md, which is kept

## Not included

- `node_modules/**` markdown (READMEs/changelogs of third-party packages, about 130 files) is not project documentation.
- Documents that exist only in the claude.ai Project (not in this folder) are not here.

## Originals

The original files have NOT been deleted or moved; they remain where they were. Once you have checked the consolidated files you can archive the old ones.
