async function loadLeads() {
  try {
    const response = await fetch("/api/leads");
    const leads = await response.json();
    renderLeads(leads);
  } catch (error) {
    console.error("Failed to load leads:", error);
  }
}

function statusClass(status) {
  const normalized = status.toLowerCase().replace(/\s+/g, "-");
  return `status-${normalized}`;
}

function renderLeads(leads) {
  const tbody = document.getElementById("lead-table-body");

  if (!leads.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No hay leads aún.</td></tr>';
    return;
  }

  tbody.innerHTML = leads
    .map(
      (lead) => `
        <tr>
          <td>${lead.name}</td>
          <td>${lead.email}</td>
          <td>${lead.company || "—"}</td>
          <td>${lead.source}</td>
          <td><span class="status-pill ${statusClass(lead.status || "New")}">${lead.status || "New"}</span></td>
        </tr>
      `
    )
    .join("");
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
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("Invalid lead payload");
    }

    form.reset();
    await loadLeads();
  } catch (error) {
    console.error("Failed to save lead:", error);
    alert("No se pudo guardar el lead. Revisa los datos e intenta nuevamente.");
  }
}

document.getElementById("lead-form").addEventListener("submit", submitLead);
document.getElementById("refresh-btn").addEventListener("click", loadLeads);

loadLeads();
