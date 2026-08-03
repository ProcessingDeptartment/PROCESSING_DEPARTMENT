import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// SQLite has no native Json type, so schema/data/traceability are stored as
// text. These parse them back out on the way to the client.
function parseTemplate(t: any) {
  return { ...t, schema: JSON.parse(t.schema) };
}
function parseVersion(v: any) {
  return { ...v, data: JSON.parse(v.data) };
}
function parseRecord(r: any) {
  return { ...r, data: JSON.parse(r.data) };
}
function parseReport(r: any) {
  return { ...r, traceability: r.traceability ? JSON.parse(r.traceability) : null };
}

app.get("/health", (req, res) => {
  res.json({ status: "ok", env: process.env.DATABASE_PROVIDER || "unknown" });
});

app.get("/templates", async (req, res) => {
  const templates = await prisma.documentTemplate.findMany();
  res.json(templates.map(parseTemplate));
});

app.post("/templates", async (req, res) => {
  const { name, description, schema } = req.body;
  const template = await prisma.documentTemplate.create({
    data: { name, description, schema: JSON.stringify(schema) }
  });
  res.status(201).json(parseTemplate(template));
});

app.get("/documents", async (req, res) => {
  const documents = await prisma.documentRecord.findMany();
  res.json(documents.map(parseRecord));
});

app.post("/documents", async (req, res) => {
  const { templateId, versionId, data, createdById } = req.body;
  const record = await prisma.documentRecord.create({
    data: { templateId, versionId, data: JSON.stringify(data), createdById }
  });
  res.status(201).json(parseRecord(record));
});

app.get("/reports", async (req, res) => {
  const reports = await prisma.standaloneReport.findMany();
  res.json(reports.map(parseReport));
});

app.post("/reports", async (req, res) => {
  const {
    reportType,
    name,
    description,
    status,
    versionNumber,
    changeReason,
    publishedById,
    publishedAt,
    traceability,
    fileReference
  } = req.body;

  const report = await prisma.standaloneReport.create({
    data: {
      reportType,
      name,
      description,
      status,
      versionNumber,
      changeReason,
      publishedById,
      publishedAt: publishedAt ? new Date(publishedAt) : undefined,
      traceability: traceability ? JSON.stringify(traceability) : undefined,
      fileReference
    }
  });

  res.status(201).json(parseReport(report));
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
