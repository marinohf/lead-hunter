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

document.getElementById("lead-form").addEventListener("submit", submitLead);
document.getElementById("refresh-btn").addEventListener("click", async () => {
  await loadStats();
  await loadLeads();
});
document.getElementById("search-input").addEventListener("input", loadLeads);
document.getElementById("status-filter").addEventListener("change", loadLeads);

loadStats();
loadLeads();
