-- Migration: add_document_references
CREATE TABLE document_references (
  id            SERIAL PRIMARY KEY,
  source_type   TEXT NOT NULL,
  source_key    TEXT NOT NULL,
  source_title  TEXT,
  target_type   TEXT NOT NULL,
  target_key    TEXT NOT NULL,
  target_label  TEXT,
  context_text  TEXT,
  needs_review  BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX uq_doc_ref
  ON document_references (source_type, source_key, target_type, target_key);

CREATE INDEX idx_doc_ref_source ON document_references (source_type, source_key);
CREATE INDEX idx_doc_ref_target ON document_references (target_type, target_key);
CREATE INDEX idx_doc_ref_review ON document_references (needs_review) WHERE needs_review = true;
