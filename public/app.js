let whatsappConfigured = false;

async function initConfig() {
  try {
    const response = await fetch("/api/config");
    const config = await response.json();
    whatsappConfigured = config.whatsappConfigured;
  } catch (error) {
    console.error("Failed to load config:", error);
  }
}

async function loadStats() {
  try {
    const response = await fetch("/api/stats");
    const stats = await response.json();

    document.getElementById("total-count").textContent = stats.total || 0;
    document.getElementById("new-count").textContent = stats.new || 0;
    document.getElementById("contacted-count").textContent = stats.contacted || 0;
    document.getElementById("qualified-count").textContent = stats.qualified || 0;
    document.getElementById("won-count").textContent = stats.won || 0;
  } catch (error) {
    console.error("Failed to load stats:", error);
  }
}

async function loadLeads() {
  try {
    const search = document.getElementById("search-input").value.trim();
    const status = document.getElementById("status-filter").value;

    const query = new URLSearchParams();
    if (search) query.set("search", search);
    if (status && status !== "all") query.set("status", status);

    const response = await fetch(`/api/leads?${query.toString()}`);
    const leads = await response.json();
    renderLeads(leads);
  } catch (error) {
    console.error("Failed to load leads:", error);
  }
}

function statusClass(status) {
  const normalized = (status || "New").toLowerCase().replace(/\s+/g, "-");
  return `status-${normalized}`;
}

function renderLeads(leads) {
  const tbody = document.getElementById("lead-table-body");

  if (!leads.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No hay leads aún. ¡Agrega uno para comenzar!</td></tr>';
    return;
  }

  tbody.innerHTML = leads
    .map(
      (lead) => `
        <tr>
          <td><strong>${lead.name}</strong></td>
          <td>${lead.email}</td>
          <td>${lead.company || "—"}</td>
          <td>${lead.source}</td>
          <td><span class="status-pill ${statusClass(lead.status || "New")}">${lead.status || "New"}</span></td>
          <td>
            <div class="actions">
              <button class="action-btn" onclick="openLeadModal('${lead.id}')">Ver</button>
              ${lead.phone && whatsappConfigured ? `<button class="action-btn whatsapp" onclick="sendWhatsApp('${lead.id}')">📱</button>` : ""}
            </div>
          </td>
        </tr>
      `
    )
    .join("");
}

async function openLeadModal(leadId) {
  try {
    const response = await fetch(`/api/leads/${leadId}`);
    const lead = await response.json();
    renderLeadModal(lead);
  } catch (error) {
    console.error("Failed to load lead:", error);
  }
}

function renderLeadModal(lead) {
  const modalBody = document.getElementById("modal-body");
  const createdDate = new Date(lead.createdAt).toLocaleDateString("es-ES");
  const whatsappStatus = lead.whatsappSent
    ? `✅ Enviado el ${new Date(lead.whatsappSentAt).toLocaleDateString("es-ES")}`
    : "No enviado";

  modalBody.innerHTML = `
    <div class="lead-detail">
      <div>
        <h2>${lead.name}</h2>
        <p class="card-description">${lead.company || "Sin empresa"}</p>
      </div>

      <div class="detail-row">
        <span class="detail-label">Email</span>
        <span class="detail-value">${lead.email}</span>
      </div>

      ${lead.phone ? `
      <div class="detail-row">
        <span class="detail-label">Teléfono</span>
        <span class="detail-value">${lead.phone}</span>
      </div>
      ` : ""}

      <div class="detail-row">
        <span class="detail-label">Estado</span>
        <span class="status-pill ${statusClass(lead.status || "New")}" style="width: fit-content;">${lead.status || "New"}</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">Fuente</span>
        <span class="detail-value">${lead.source}</span>
      </div>

      ${lead.notes ? `
      <div class="detail-row">
        <span class="detail-label">Notas</span>
        <span class="detail-value">${lead.notes}</span>
      </div>
      ` : ""}

      <div class="detail-row">
        <span class="detail-label">Fecha de captura</span>
        <span class="detail-value">${createdDate}</span>
      </div>

      ${whatsappConfigured ? `
      <div class="detail-row">
        <span class="detail-label">WhatsApp</span>
        <span class="detail-value">${whatsappStatus}</span>
      </div>
      ` : ""}

      <div class="modal-actions">
        <select id="status-update" class="status-update-select">
          <option value="New" ${lead.status === "New" ? "selected" : ""}>Nuevo</option>
          <option value="Contacted" ${lead.status === "Contacted" ? "selected" : ""}>Contactado</option>
          <option value="Qualified" ${lead.status === "Qualified" ? "selected" : ""}>Calificado</option>
          <option value="Won" ${lead.status === "Won" ? "selected" : ""}>Ganado</option>
          <option value="Lost" ${lead.status === "Lost" ? "selected" : ""}>Perdido</option>
        </select>
        <button class="primary-btn" style="margin: 0; padding: 10px 16px;" onclick="updateLeadStatus('${lead.id}')">Actualizar</button>
      </div>

      ${lead.phone && whatsappConfigured && !lead.whatsappSent ? `
      <div style="margin-top: 16px;">
        <button class="primary-btn" onclick="sendWhatsApp('${lead.id}')" style="background: linear-gradient(135deg, #34d399 0%, #10b981 100%);">Enviar por WhatsApp</button>
      </div>
      ` : ""}
    </div>
  `;

  document.getElementById("lead-modal").classList.remove("hidden");
}

async function updateLeadStatus(leadId) {
  const status = document.querySelector(".status-update-select").value;

  try {
    const response = await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (response.ok) {
      await loadStats();
      await loadLeads();
      closeModal();
    }
  } catch (error) {
    console.error("Failed to update lead:", error);
  }
}

async function sendWhatsApp(leadId) {
  try {
    const response = await fetch(`/api/leads/${leadId}/send-whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (response.ok) {
      alert("✅ Mensaje enviado por WhatsApp correctamente!");
      await loadLeads();
      const modal = document.getElementById("lead-modal");
      if (!modal.classList.contains("hidden")) {
        closeModal();
        await new Promise((r) => setTimeout(r, 300));
      }
    } else {
      const error = await response.json();
      alert(`❌ Error: ${error.error}`);
    }
  } catch (error) {
    console.error("Failed to send WhatsApp:", error);
    alert("❌ No se pudo enviar el mensaje. Verifica tu configuración de WhatsApp.");
  }
}

function closeModal() {
  document.getElementById("lead-modal").classList.add("hidden");
}

async function submitLead(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const payload = {
    name: document.getElementById("name").value,
    email: document.getElementById("email").value,
    phone: document.getElementById("phone").value,
    company: document.getElementById("company").value,
    source: document.getElementById("source").value,
    status: document.getElementById("status").value,
    notes: document.getElementById("notes").value,
  };

  try {
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Invalid lead payload");
    }

    form.reset();
    await loadStats();
    await loadLeads();
  } catch (error) {
    console.error("Failed to save lead:", error);
    alert(error.message || "No se pudo guardar el lead. Revisa los datos e intenta nuevamente.");
  }
}

// Event listeners
document.getElementById("lead-form").addEventListener("submit", submitLead);
document.getElementById("refresh-btn").addEventListener("click", async () => {
  await loadStats();
  await loadLeads();
});
document.getElementById("search-input").addEventListener("input", loadLeads);
document.getElementById("status-filter").addEventListener("change", loadLeads);

document.querySelector(".modal-close").addEventListener("click", closeModal);
document.getElementById("lead-modal").addEventListener("click", (e) => {
  if (e.target.id === "lead-modal") closeModal();
});

// Initialize
initConfig();
loadStats();
loadLeads();
