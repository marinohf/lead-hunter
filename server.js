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

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Lead Hunter is running" });
});

app.get("/api/leads", (req, res) => {
  const leads = readLeads();
  res.json(leads);
});

app.post("/api/leads", (req, res) => {
  const { name, email, phone, company, source, notes, status } = req.body;

  if (!name || !email) {
    return res.status(400).json({
      error: "Name and email are required fields.",
    });
  }

  const leads = readLeads();
  const newLead = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    name: name.trim(),
    email: email.trim(),
    phone: phone ? phone.trim() : "",
    company: company ? company.trim() : "",
    source: source || "Website",
    notes: notes ? notes.trim() : "",
    status: status || "New",
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
