const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "leads.json");
const CAMPAIGNS_FILE = path.join(DATA_DIR, "prospecting-campaigns.json");
const DISCOVERED_FILE = path.join(DATA_DIR, "discovered-leads.json");
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Inicializar almacenamiento con verificación de permisos
function ensureStorage() {
  try {
    // Crear directorio si no existe
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o755 });
      console.log(`✅ Data directory created: ${DATA_DIR}`);
    }

    // Crear archivo de leads si no existe
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), { mode: 0o644 });
      console.log(`✅ Leads file created: ${DATA_FILE}`);
    }

    // Crear archivo de campañas si no existe
    if (!fs.existsSync(CAMPAIGNS_FILE)) {
      fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify([], null, 2), { mode: 0o644 });
      console.log(`✅ Campaigns file created: ${CAMPAIGNS_FILE}`);
    }

    // Crear archivo de leads descubiertos si no existe
    if (!fs.existsSync(DISCOVERED_FILE)) {
      fs.writeFileSync(DISCOVERED_FILE, JSON.stringify([], null, 2), { mode: 0o644 });
      console.log(`✅ Discovered leads file created: ${DISCOVERED_FILE}`);
    }
  } catch (error) {
    console.error(`❌ Error ensuring storage:`, error.message);
  }
}

function readJson(filePath, fallback = []) {
  try {
    ensureStorage();
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    console.error(`❌ Error reading ${filePath}:`, error.message);
    return fallback;
  }
}

function writeJson(filePath, data) {
  try {
    ensureStorage();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o644 });
    console.log(`✅ Data saved to ${path.basename(filePath)}`);
  } catch (error) {
    console.error(`❌ Error writing to ${filePath}:`, error.message);
  }
}

function readLeads() {
  return readJson(DATA_FILE, []);
}

function writeLeads(leads) {
  writeJson(DATA_FILE, leads);
}

function readCampaigns() {
  return readJson(CAMPAIGNS_FILE, []);
}

function writeCampaigns(campaigns) {
  writeJson(CAMPAIGNS_FILE, campaigns);
}

function readDiscoveredLeads() {
  return readJson(DISCOVERED_FILE, []);
}

function writeDiscoveredLeads(leads) {
  writeJson(DISCOVERED_FILE, leads);
}

function sanitizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhoneNumber(phone) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  return digits;
}

function slugify(value) {
  return sanitizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "lead-hunter";
}

function getLocationFromText(text, overrideLocation) {
  if (sanitizeText(overrideLocation)) return sanitizeText(overrideLocation);

  const locationMap = [
    "Alicante",
    "Santander",
    "Madrid",
    "Valencia",
    "Barcelona",
    "Sevilla",
    "Murcia",
    "Bilbao",
    "Zaragoza",
    "Málaga",
    "Alicante province",
    "Comunidad Valenciana",
    "Cantabria",
  ];

  const lower = text.toLowerCase();
  const found = locationMap.find((location) => lower.includes(location.toLowerCase()));
  return found || "España";
}

function detectCompanyType(text) {
  const lower = text.toLowerCase();

  if (/(abogado|abogados|bufete|despacho|legal|asesoria juridica|asesoría jurídica)/.test(lower)) {
    return "Bufetes de abogados";
  }

  if (/(taller|mecanico|mecánico|reparacion|reparación|automoción|automocion)/.test(lower)) {
    return "Taller mecánico";
  }

  if (/(ingeniero informatico|ingenieros informaticos|desarrollador|programador|software|startup)/.test(lower)) {
    return "Ingeniería informática";
  }

  if (/(inmobiliaria|inmobiliario|venta|alquiler|propiedad)/.test(lower)) {
    return "Inmobiliaria";
  }

  if (/(clinica|clínica|hospital|centro médico|salud)/.test(lower)) {
    return "Centro sanitario";
  }

  if (/(restaurante|cafeteria|hotel|hostel|turismo)/.test(lower)) {
    return "Negocio local";
  }

  return "Empresa local";
}

function detectSource(text, fallbackSource) {
  const lower = text.toLowerCase();

  if (/(linkedin|linkedin profile|perfil de linkedin|persona en linkedin)/.test(lower)) {
    return "LinkedIn";
  }

  if (/(google maps|maps|valoraciones|reviews)/.test(lower)) {
    return "Google Maps";
  }

  if (/(web|website|página web|sitio web|google search)/.test(lower)) {
    return "Web Search";
  }

  if (fallbackSource) return fallbackSource;
  return "Google Maps";
}

function detectResultCount(text, fallbackCount = 10) {
  const match = sanitizeText(text).match(/\b(\d{1,2})\b/);
  if (match) return Math.min(25, Math.max(1, Number(match[1])));
  return fallbackCount;
}

function generateProspectingResults(objective, sourceType, location, maxResults, minScore) {
  const text = sanitizeText(objective).toLowerCase();
  const companyType = detectCompanyType(text);
  const finalSource = detectSource(text, sourceType);
  const city = getLocationFromText(text, location);
  const count = Number(maxResults) || detectResultCount(text, 10);
  const minimumScore = Number(minScore) || 65;
  const hasWebsiteConstraint = /(sin web|sin pagina|sin página|sin website|sin sitio web|sin pagina web)/.test(text);
  const isHiringSearch = /(contratando|buscando|busca|buscan|está contratando|estan contratando|hiring)/.test(text);
  const isRatingSearch = /(valoraciones|valoracion|google maps|reviews|top 10|más valoraciones)/.test(text);
  const isPersonSearch = /(linkedin|perfil|persona|persona de|empleado|contratando|buscando ingeniero)/.test(text);

  const companyTemplates = {
    "Bufetes de abogados": [
      "Arenal Legal",
      "García & Ruiz Advocacia",
      "Montalbán Legal Group",
      "Asesoría Juridica Costa",
      "López Abogados",
      "Nadal & Asociados",
      "Vargas Legal",
      "Costa Sol Legal",
    ],
    "Taller mecánico": [
      "Mecánica Costa Sur",
      "Automoción San Miguel",
      "Taller del Norte",
      "Mecánica Rápida",
      "Grupo AutoReparación",
      "Garage Provincial",
      "Motores & Co",
      "Taller Integral",
    ],
    "Ingeniería informática": [
      "Nexa Digital",
      "Ingeniería Tecnova",
      "Core Stack Labs",
      "Talento Tech",
      "Data Systems Group",
      "Byteworks",
      "IT Growth Partners",
      "DevHub Systems",
    ],
    "Inmobiliaria": [
      "Punto Inmobiliario",
      "Viviendas Costa Sur",
      "Grupo Urbán",
      "Sol Naciente Inmuebles",
      "Aldea Real Estate",
      "Esfera Inmobiliaria",
      "Portal Norte",
      "Viviendas Verdes",
    ],
    "Centro sanitario": [
      "Clínica del Mar",
      "Centro Salud Vital",
      "Sanitas Local",
      "Especialidades Plus",
      "Consultorio Médico",
      "Salud y Vida",
      "Centro Médico Norte",
      "Hospital Local",
    ],
    "Negocio local": [
      "Local & Co",
      "Centro Comercial de Barrio",
      "Servicios del Centro",
      "Grupo Local 24",
      "Soluciones del Pueblo",
      "Empresa de Zona",
      "Negocios del Sur",
      "Actividad Local",
    ],
    "Empresa local": [
      "Grupo Sur",
      "Nexo Local",
      "Servicios del Valle",
      "Partner Business",
      "Estrategia Local",
      "Núcleo Empresarial",
      "Compañía Local",
      "Empresa del Norte",
    ],
  };

  const contactNames = [
    "María",
    "José",
    "Lucía",
    "Daniel",
    "Laura",
    "Miguel",
    "Sofía",
    "Pablo",
    "Ana",
    "Carlos",
    "Sara",
    "Alberto",
  ];

  const surnames = [
    "Torres",
    "Sánchez",
    "Ramírez",
    "García",
    "Martínez",
    "Navarro",
    "López",
    "Castro",
    "Molina",
    "Pérez",
    "Herrera",
    "Ortega",
  ];

  const companyPool = companyTemplates[companyType] || companyTemplates["Empresa local"];

  return Array.from({ length: count }, (_, index) => {
    const companyName = companyPool[index % companyPool.length];
    const contactName = `${contactNames[(index + 2) % contactNames.length]} ${surnames[(index + 1) % surnames.length]}`;
    const scoreBase = 65 + (hasWebsiteConstraint ? 8 : 0) + (isHiringSearch ? 12 : 0) + (isRatingSearch ? 10 : 0) + (isPersonSearch ? 4 : 0);
    const score = Math.min(99, scoreBase + (index % 4) * 4 + (finalSource === "LinkedIn" ? 5 : 0));

    if (score < minimumScore) {
      return null;
    }

    const cleanedCompany = `${companyName} ${city}`;
    const website = hasWebsiteConstraint ? "" : `https://${slugify(cleanedCompany)}.es`;

    return {
      id: `lead-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      name: isPersonSearch ? contactName : `${companyName}`,
      company: isPersonSearch ? `${companyName}` : cleanedCompany,
      contactName: isPersonSearch ? contactName : "Equipo comercial",
      city,
      region: city,
      source: finalSource,
      sourceType: finalSource,
      leadType: isPersonSearch ? "Persona" : "Empresa",
      website,
      hasWebsite: Boolean(website),
      email: `${slugify(contactName)}@${slugify(companyName)}.com`,
      phone: "+34 600 000 " + String(100 + index).padStart(3, "0"),
      type: companyType,
      score,
      fit: `${companyType} · ${city} · ${hasWebsiteConstraint ? "Sin web" : "Con web"}`,
      reason: `${companyType} en ${city} con fit relevante para la búsqueda: ${objective}`,
      status: "Prospectado",
      pipelineStage: "New",
      createdAt: new Date().toISOString(),
      tags: [
        city,
        companyType,
        hasWebsiteConstraint ? "sin-web" : "web-activa",
        isHiringSearch ? "contratando" : "lead-activo",
      ],
    };
  }).filter(Boolean);
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

// Rutas API

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
      const haystack = [lead.name, lead.email, lead.company, lead.source, lead.notes].join(" ").toLowerCase();
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
    return res.status(400).json({ error: "Name and email are required fields." });
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

app.get("/api/prospecting/campaigns", (req, res) => {
  res.json(readCampaigns());
});

app.get("/api/prospecting/leads", (req, res) => {
  res.json(readDiscoveredLeads());
});

app.post("/api/prospecting/run", (req, res) => {
  const { objective, location, source, maxResults, minScore } = req.body;
  const cleanObjective = sanitizeText(objective);

  if (!cleanObjective) {
    return res.status(400).json({ error: "Debes describir el tipo de lead que quieres encontrar." });
  }

  const campaign = {
    id: `campaign-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: cleanObjective.slice(0, 60),
    objective: cleanObjective,
    source: sanitizeText(source) || "Google Maps",
    location: sanitizeText(location) || getLocationFromText(cleanObjective),
    maxResults: Number(maxResults) || detectResultCount(cleanObjective, 10),
    minScore: Number(minScore) || 65,
    createdAt: new Date().toISOString(),
  };

  const results = generateProspectingResults(
    cleanObjective,
    sanitizeText(source) || "Google Maps",
    sanitizeText(location) || getLocationFromText(cleanObjective),
    Number(maxResults) || detectResultCount(cleanObjective, 10),
    Number(minScore) || 65
  );

  const campaigns = readCampaigns();
  campaigns.unshift(campaign);
  writeCampaigns(campaigns);

  const discoveredLeads = readDiscoveredLeads();
  const newestResults = results.map((lead) => ({ ...lead, campaignId: campaign.id }));
  discoveredLeads.unshift(...newestResults);
  writeDiscoveredLeads(discoveredLeads);

  res.status(201).json({ campaign, results: newestResults });
});

app.post("/api/prospecting/:id/approve", (req, res) => {
  const discoveredLeads = readDiscoveredLeads();
  const lead = discoveredLeads.find((item) => item.id === req.params.id);

  if (!lead) {
    return res.status(404).json({ error: "Prospecto no encontrado" });
  }

  const mainLeads = readLeads();
  const newLead = {
    id: `lead-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: lead.name || lead.contactName || "Lead descubierto",
    email: lead.email || `${slugify(lead.contactName || lead.name || "lead")}@lead-hunter.local`,
    phone: lead.phone || "",
    company: lead.company || lead.name || "Empresa sin nombre",
    source: `${lead.sourceType || "Prospecting"} / Auto-búsqueda`,
    notes: `${lead.reason || "Lead descubierto por prospección automática"}. ${lead.city ? `Ciudad: ${lead.city}.` : ""} ${lead.website ? `Web: ${lead.website}.` : ""}`,
    status: "New",
    createdAt: new Date().toISOString(),
    whatsappSent: false,
  };

  mainLeads.unshift(newLead);
  writeLeads(mainLeads);

  lead.importedToPipeline = true;
  lead.status = "Approved";
  writeDiscoveredLeads(discoveredLeads);

  res.status(201).json(newLead);
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Inicializar almacenamiento al arrancar
ensureStorage();

app.listen(PORT, () => {
  console.log(`\n🎯 Lead Hunter running on http://localhost:${PORT}\n`);
  console.log(`📁 Data directory: ${DATA_DIR}\n`);
});

module.exports = app;
