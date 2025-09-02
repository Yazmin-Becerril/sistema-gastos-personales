// ------------------ Storage helpers ------------------
const STORAGE_KEY = "gastos_v1";

const loadExpenses = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
};

const saveExpenses = (data) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

// ------------------ Estado ------------------
let expenses = loadExpenses();
let editingId = null; // para editar (opcional)

// ------------------ Utilidades ------------------
const fmtMoney = (n) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const fmtDate = (iso) => {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const monthFromISO = (iso) => iso.slice(0, 7); // YYYY-MM

// ------------------ Render principal ------------------
const tbody = document.getElementById("tbody");
const searchInput = document.getElementById("search");
const monthInput = document.getElementById("month");

const render = () => {
  const q = (searchInput.value || "").toLowerCase().trim();
  const m = (monthInput.value || "").trim();

  const filtered = expenses.filter((e) => {
    const matchesQ =
      !q ||
      e.desc.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q);
    const matchesM = !m || monthFromISO(e.date) === m;
    return matchesQ && matchesM;
  });

  // tabla
  tbody.innerHTML = filtered
    .map(
      (e) => `
      <tr>
        <td>${fmtDate(e.date)}</td>
        <td>${e.desc}</td>
        <td>${e.category}</td>
        <td class="text-end">${fmtMoney(e.amount)}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline-primary me-1" onclick="onEdit('${e.id}')">Editar</button>
          <button class="btn btn-sm btn-outline-danger" onclick="onDelete('${e.id}')">Eliminar</button>
        </td>
      </tr>`
    )
    .join("");

  // KPIs (sobre el mes filtrado si hay, si no sobre todo)
  const base = m ? filtered : expenses;
  const total = base.reduce((s, e) => s + e.amount, 0);
  const count = base.length;
  const avg = count ? total / count : 0;

  document.getElementById("kpiTotal").textContent = fmtMoney(total);
  document.getElementById("kpiCount").textContent = String(count);
  document.getElementById("kpiAvg").textContent = fmtMoney(avg);

  // gráfica por categoría (solo del set filtrado)
  drawChart(filtered);
};

// ------------------ CRUD ------------------
document.getElementById("expenseForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const desc = document.getElementById("desc").value.trim();
  const amount = parseFloat(document.getElementById("amount").value);
  const category = document.getElementById("category").value;
  const date = document.getElementById("date").value;

  if (!desc || !category || !date || isNaN(amount) || amount <= 0) {
    alert("Completa todos los campos correctamente.");
    return;
  }

  if (editingId) {
    expenses = expenses.map((e) =>
      e.id === editingId ? { ...e, desc, amount, category, date } : e
    );
    editingId = null;
  } else {
    expenses.push({
      id: crypto.randomUUID(),
      desc,
      amount,
      category,
      date,
    });
  }

  saveExpenses(expenses);
  ev.target.reset();
  render();
});

window.onDelete = (id) => {
  if (!confirm("¿Eliminar este gasto?")) return;
  expenses = expenses.filter((e) => e.id !== id);
  saveExpenses(expenses);
  render();
};

window.onEdit = (id) => {
  const e = expenses.find((x) => x.id === id);
  if (!e) return;
  document.getElementById("desc").value = e.desc;
  document.getElementById("amount").value = e.amount;
  document.getElementById("category").value = e.category;
  document.getElementById("date").value = e.date;
  editingId = id;
  document.getElementById("desc").focus();
};

// filtros
searchInput.addEventListener("input", render);
monthInput.addEventListener("change", render);

// borrar todo
document.getElementById("btnClear").addEventListener("click", () => {
  if (!confirm("Esto borrará TODOS los gastos. ¿Continuar?")) return;
  expenses = [];
  saveExpenses(expenses);
  render();
});

// exportar
document.getElementById("btnExport").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(expenses, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `gastos_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

// importar
const inputFile = document.getElementById("importFile");
document.getElementById("btnImport").addEventListener("click", () => {
  inputFile.click();
});
inputFile.addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    const txt = await f.text();
    const data = JSON.parse(txt);
    if (!Array.isArray(data)) throw new Error("Formato inválido");
    // normalizar
    expenses = data
      .filter((x) => x && x.desc && x.amount && x.category && x.date)
      .map((x) => ({
        id: x.id || crypto.randomUUID(),
        desc: String(x.desc),
        amount: Number(x.amount),
        category: String(x.category),
        date: String(x.date),
      }));
    saveExpenses(expenses);
    render();
  } catch (err) {
    alert("No se pudo importar el archivo JSON.");
    console.error(err);
  } finally {
    e.target.value = "";
  }
});

// ------------------ Chart ------------------
let chart;
function drawChart(rows) {
  const byCat = {};
  rows.forEach((e) => (byCat[e.category] = (byCat[e.category] || 0) + e.amount));

  const labels = Object.keys(byCat);
  const values = Object.values(byCat);

  const ctx = document.getElementById("chart");
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data: values,
        },
      ],
    },
    options: {
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (c) => `${c.label}: ${fmtMoney(c.parsed)}`,
          },
        },
      },
    },
  });
}

// ------------------ Init ------------------
(() => {
  // Fecha por defecto: hoy
  document.getElementById("date").value = new Date().toISOString().slice(0, 10);
  render();
})();