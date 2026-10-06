const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "leads.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
  }
}

function readLeads() {
  ensureStorage();
  const raw = fs.readFileSync(DATA_FILE, "utf8");

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeLeads(leads) {
  ensureStorage();
  fs.writeFileSync(DATA_FILE, JSON.stringify(leads, null, 2));
}

function sanitizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Lead Hunter is running" });
});

app.get("/api/leads", (req, res) => {
  const { status, search } = req.query;
  let leads = readLeads();

  if (status && status !== "all") {
    leads = leads.filter((lead) => (lead.status || "New") === status);
  }

  if (search) {
    const searchTerm = search.toLowerCase();
    leads = leads.filter((lead) => {
      const haystack = [
        lead.name,
        lead.email,
        lead.company,
        lead.source,
        lead.notes,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(searchTerm);
    });
  }

  res.json(leads);
});

app.get("/api/stats", (req, res) => {
  const leads = readLeads();
  const stats = {
    total: leads.length,
    new: leads.filter((lead) => (lead.status || "New") === "New").length,
    contacted: leads.filter((lead) => lead.status === "Contacted").length,
    qualified: leads.filter((lead) => lead.status === "Qualified").length,
    won: leads.filter((lead) => lead.status === "Won").length,
  };

  res.json(stats);
});

app.post("/api/leads", (req, res) => {
  const { name, email, phone, company, source, notes, status } = req.body;

  const cleanName = sanitizeText(name);
  const cleanEmail = sanitizeText(email);

  if (!cleanName || !cleanEmail) {
    return res.status(400).json({
      error: "Name and email are required fields.",
    });
  }

  const leads = readLeads();
  const newLead = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    name: cleanName,
    email: cleanEmail,
    phone: sanitizeText(phone),
    company: sanitizeText(company),
    source: sanitizeText(source) || "Website",
    notes: sanitizeText(notes),
    status: sanitizeText(status) || "New",
    createdAt: new Date().toISOString(),
  };

  leads.unshift(newLead);
  writeLeads(leads);

  res.status(201).json(newLead);
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Lead Hunter running on http://localhost:${PORT}`);
});
