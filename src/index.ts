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

app.get("/health", (req, res) => {
  res.json({ status: "ok", env: process.env.DATABASE_PROVIDER || "unknown" });
});

app.get("/templates", async (req, res) => {
  const templates = await prisma.documentTemplate.findMany();
  res.json(templates);
});

app.post("/templates", async (req, res) => {
  const { name, description, schema } = req.body;
  const template = await prisma.documentTemplate.create({
    data: { name, description, schema }
  });
  res.status(201).json(template);
});

app.get("/documents", async (req, res) => {
  const documents = await prisma.documentRecord.findMany();
  res.json(documents);
});

app.post("/documents", async (req, res) => {
  const { templateId, versionId, data, createdById } = req.body;
  const record = await prisma.documentRecord.create({
    data: { templateId, versionId, data, createdById }
  });
  res.status(201).json(record);
});

app.get("/reports", async (req, res) => {
  const reports = await prisma.standaloneReport.findMany();
  res.json(reports);
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
      traceability,
      fileReference
    }
  });

  res.status(201).json(report);
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
