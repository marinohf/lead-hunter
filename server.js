const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "leads.json");
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;

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

function normalizePhoneNumber(phone) {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");
  // Remove leading 1 if 11 digits (US format)
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  return digits;
}

async function sendWhatsAppMessage(phone, name, company) {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    console.log("WhatsApp integration not configured");
    return false;
  }

  try {
    const cleanPhone = normalizePhoneNumber(phone);
    const message = `Hola ${name}${company ? ` de ${company}` : ""}! 👋\n\nNos interesa conectar con ustedes. ¿Podemos agendar una llamada esta semana?\n\nSaludos,\nLead Hunter Team`;

    await axios.post(
      `https://graph.instagram.com/v18.0/${WHATSAPP_PHONE_ID}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "text",
        text: {
          preview_url: false,
          body: message,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    return true;
  } catch (error) {
    console.error("WhatsApp send error:", error.response?.data || error.message);
    return false;
  }
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Lead Hunter is running" });
});

app.get("/api/config", (req, res) => {
  res.json({
    whatsappConfigured: Boolean(WHATSAPP_TOKEN && WHATSAPP_PHONE_ID),
  });
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

app.get("/api/leads/:id", (req, res) => {
  const leads = readLeads();
  const lead = leads.find((l) => l.id === req.params.id);

  if (!lead) {
    return res.status(404).json({ error: "Lead not found" });
  }

  res.json(lead);
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
    whatsappSent: false,
  };

  leads.unshift(newLead);
  writeLeads(leads);

  res.status(201).json(newLead);
});

app.post("/api/leads/:id/send-whatsapp", async (req, res) => {
  const leads = readLeads();
  const lead = leads.find((l) => l.id === req.params.id);

  if (!lead) {
    return res.status(404).json({ error: "Lead not found" });
  }

  if (!lead.phone) {
    return res.status(400).json({ error: "Lead has no phone number" });
  }

  const success = await sendWhatsAppMessage(lead.phone, lead.name, lead.company);

  if (success) {
    lead.whatsappSent = true;
    lead.whatsappSentAt = new Date().toISOString();
    writeLeads(leads);
    res.json({ success: true, message: "WhatsApp message sent" });
  } else {
    res.status(500).json({ error: "Failed to send WhatsApp message" });
  }
});

app.patch("/api/leads/:id", (req, res) => {
  const { status, notes } = req.body;
  const leads = readLeads();
  const lead = leads.find((l) => l.id === req.params.id);

  if (!lead) {
    return res.status(404).json({ error: "Lead not found" });
  }

  if (status) lead.status = sanitizeText(status);
  if (notes !== undefined) lead.notes = sanitizeText(notes);
  lead.updatedAt = new Date().toISOString();

  writeLeads(leads);
  res.json(lead);
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Lead Hunter running on http://localhost:${PORT}`);
});
