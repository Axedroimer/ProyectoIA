const REQUIRED_RAW = ["fecha", "descripcion", "categoria", "monto"];
const REQUIRED_PROCESSED = [...REQUIRED_RAW, "tipo_gasto", "score_financiero"];

const weights = {
  servicios: 1.0,
  transporte: 1.1,
  educacion: 1.1,
  alimentacion: 1.2,
  salud: 1.3,
  ocio: 1.8,
  entretenimiento: 1.9,
  compras_no_esenciales: 2.0,
};

const typeColors = {
  gasto_controlado: "#1f7a58",
  gasto_frecuente: "#1c8a91",
  gasto_elevado: "#c98921",
  gasto_no_esencial_alto: "#c56f2d",
  gasto_inusual: "#2f6fbc",
  gasto_emergencia: "#c84f4f",
  gasto_incremento_recurrente: "#7a5a2a",
};

let sourceRows = [];
let currentRows = [];
let thresholds = {};
let activeFilters = { category: "todos", type: "todos", month: "todos" };
let dataSource = { name: "Sin datos", rows: 0, loadedAt: "", sources: [] };
let donutSlices = [];
let monthPoints = [];

const currency = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  loadDefaultData();
});

function bindEvents() {
  document.getElementById("csvInput").addEventListener("change", handleFileUpload);
  document.getElementById("loadDemoBtn").addEventListener("click", loadDefaultData);
  document.getElementById("clearFocusBtn").addEventListener("click", clearFocus);
  document.getElementById("sidebarClearFilters").addEventListener("click", clearFocus);
  document.getElementById("sidebarCategoryFilter").addEventListener("change", (event) => setFilter("category", event.target.value));
  document.getElementById("sidebarTypeFilter").addEventListener("change", (event) => setFilter("type", event.target.value));
  document.getElementById("sidebarMonthFilter").addEventListener("change", (event) => setFilter("month", event.target.value));
  document.getElementById("typeFilter").addEventListener("change", handleTypeFilterChange);
  document.getElementById("searchInput").addEventListener("input", renderTable);
  document.getElementById("predictionForm").addEventListener("submit", handlePrediction);
  document.getElementById("typeDonut").addEventListener("click", handleDonutClick);
  document.getElementById("typeDonut").addEventListener("mousemove", handleDonutHover);
  document.getElementById("monthlyChart").addEventListener("click", handleMonthlyClick);
  document.getElementById("monthlyChart").addEventListener("mousemove", handleMonthlyHover);
}

async function loadDefaultData() {
  try {
    const response = await fetch("../data/processed/gastos_sprint1_final.csv");
    if (!response.ok) throw new Error("No se pudo cargar el CSV demo.");
    const text = await response.text();
    processCsv(text, "Dataset demo del Sprint 1", { mode: "replace" });
  } catch (error) {
    setValidation(false, "No se pudo cargar la demo automaticamente", "Carga manualmente data/processed/gastos_sprint1_final.csv.");
  }
}

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    processCsv(reader.result, file.name, { mode: "append" });
    event.target.value = "";
  };
  reader.readAsText(file, "utf-8");
}

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let insideQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (current || row.length) {
        row.push(current);
        rows.push(row);
        row = [];
        current = "";
      }
      if (char === "\r" && next === "\n") i += 1;
    } else {
      current += char;
    }
  }

  if (current || row.length) {
    row.push(current);
    rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows.shift().map((header) => cleanHeader(header));
  return rows
    .filter((cells) => cells.some((cell) => cell.trim()))
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header, (cells[index] || "").trim()])));
}

function cleanHeader(header) {
  return header.replace(/^\uFEFF/, "").trim();
}

function processCsv(text, sourceName, options = { mode: "replace" }) {
  const parsed = parseCsv(text);
  const validation = validateRows(parsed);

  if (!validation.valid) {
    setValidation(false, "Estructura no valida", validation.message);
    return;
  }

  const normalizedRows = parsed.map(normalizeSourceRow);
  const isAppend = options.mode === "append" && sourceRows.length > 0;
  sourceRows = isAppend ? [...sourceRows, ...normalizedRows] : normalizedRows;
  currentRows = enrichRows(sourceRows);
  activeFilters = { category: "todos", type: "todos", month: "todos" };
  const sources = isAppend ? [...dataSource.sources, sourceName] : [sourceName];
  dataSource = {
    name: formatSourceName(sources),
    rows: currentRows.length,
    loadedAt: new Date().toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" }),
    sources,
  };
  setValidation(
    true,
    isAppend ? "CSV anexado" : "CSV validado",
    `${sourceName}: ${normalizedRows.length} movimientos ${isAppend ? "anexados" : "cargados"}. Total activo: ${currentRows.length}.`,
  );
  renderAll();
}

function validateRows(rows) {
  if (!rows.length) return { valid: false, message: "El archivo no contiene registros." };

  const headers = Object.keys(rows[0]);
  const hasRaw = REQUIRED_RAW.every((column) => headers.includes(column));
  const hasProcessed = REQUIRED_PROCESSED.every((column) => headers.includes(column));

  if (!hasRaw && !hasProcessed) {
    return {
      valid: false,
      message: `Columnas requeridas: ${REQUIRED_RAW.join(", ")}. Tambien se acepta un CSV procesado con tipo_gasto y score_financiero.`,
    };
  }

  return { valid: true, message: "Estructura compatible." };
}

function normalizeSourceRow(row) {
  return {
    fecha: row.fecha,
    descripcion: row.descripcion,
    categoria: row.categoria,
    monto: row.monto,
    mes: row.mes,
    alerta_incremento: row.alerta_incremento,
  };
}

function enrichRows(rows) {
  const cleaned = rows.map((row) => ({
    fecha: row.fecha,
    descripcion: row.descripcion,
    categoria: row.categoria,
    monto: toNumber(row.monto),
    mes: toNumber(row.mes) || getMonth(row.fecha),
    tipo_gasto: row.tipo_gasto || "",
    score_financiero: toNumber(row.score_financiero),
    alerta_incremento: toNumber(row.alerta_incremento) || 0,
  }));

  const frequency = countBy(cleaned, "categoria");
  const minAmount = Math.min(...cleaned.map((row) => row.monto));
  const maxAmount = Math.max(...cleaned.map((row) => row.monto));
  const freqValues = Object.values(frequency);
  const minFrequency = Math.min(...freqValues);
  const maxFrequency = Math.max(...freqValues);
  thresholds = buildThresholds(cleaned, frequency);

  const previousByDescription = {};

  return cleaned
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
    .map((row) => {
      const frecuencia = frequency[row.categoria] || 0;
      const porcentaje = frecuencia / cleaned.length;
      const previousAmount = previousByDescription[row.descripcion];
      const alerta = previousAmount && row.monto > previousAmount * 1.1 ? 1 : row.alerta_incremento;
      previousByDescription[row.descripcion] = row.monto;

      const enriched = {
        ...row,
        peso_categoria: weights[row.categoria] || 1,
        frecuencia,
        porcentaje_categoria: porcentaje,
        alerta_incremento: alerta,
        monto_normalizado: normalize(row.monto, minAmount, maxAmount),
        frecuencia_normalizada: normalize(frecuencia, minFrequency, maxFrequency),
      };

      enriched.score_financiero =
        row.score_financiero ||
        enriched.monto_normalizado + enriched.peso_categoria + enriched.frecuencia_normalizada + enriched.alerta_incremento;
      enriched.tipo_gasto = row.tipo_gasto || classifyExpense(enriched);
      enriched.requiere_atencion = enriched.tipo_gasto === "gasto_controlado" ? 0 : 1;

      return enriched;
    });
}

function buildThresholds(rows, frequency) {
  return {
    montoAlto: quantile(rows.map((row) => row.monto), 0.75),
    montoMedio: quantile(rows.map((row) => row.monto), 0.6),
    montoBajo: quantile(rows.map((row) => row.monto), 0.35),
    frecuenciaAlta: quantile(Object.values(frequency), 0.75),
  };
}

function classifyExpense(row) {
  const nonEssential = ["ocio", "entretenimiento", "compras_no_esenciales"];

  if (row.categoria === "salud" && row.monto >= thresholds.montoAlto) return "gasto_emergencia";
  if (row.alerta_incremento === 1) return "gasto_incremento_recurrente";
  if (row.porcentaje_categoria < 0.15 && row.monto >= thresholds.montoAlto) return "gasto_inusual";
  if (nonEssential.includes(row.categoria) && row.monto >= thresholds.montoMedio) return "gasto_no_esencial_alto";
  if (row.monto >= thresholds.montoAlto) return "gasto_elevado";
  if (row.frecuencia >= thresholds.frecuenciaAlta && row.monto <= thresholds.montoBajo) return "gasto_frecuente";
  return "gasto_controlado";
}

function handleTypeFilterChange(event) {
  setFilter("type", event.target.value);
}

function setFocus(kind, value) {
  setFilter(kind, value);
}

function setFilter(kind, value) {
  const filterKey = normalizeFilterKind(kind);
  if (!filterKey) return;
  activeFilters = { ...activeFilters, [filterKey]: String(value) };
  renderAll();
}

function clearFocus() {
  activeFilters = { category: "todos", type: "todos", month: "todos" };
  renderAll();
}

function getFocusedRows(excludeKind = "") {
  const excluded = normalizeFilterKind(excludeKind);
  return currentRows.filter((row) => {
    const matchCategory = excluded === "category" || activeFilters.category === "todos" || row.categoria === activeFilters.category;
    const matchType = excluded === "type" || activeFilters.type === "todos" || row.tipo_gasto === activeFilters.type;
    const matchMonth = excluded === "month" || activeFilters.month === "todos" || String(row.mes) === String(activeFilters.month);
    return matchCategory && matchType && matchMonth;
  });
}

function isFocus(kind, value) {
  const filterKey = normalizeFilterKind(kind);
  return filterKey ? activeFilters[filterKey] === String(value) : false;
}

function formatFocusLabel() {
  const parts = [];
  if (activeFilters.category !== "todos") parts.push(`Categoria: ${activeFilters.category}`);
  if (activeFilters.type !== "todos") parts.push(`Tipo: ${formatType(activeFilters.type)}`);
  if (activeFilters.month !== "todos") parts.push(`Mes: ${monthLabel(activeFilters.month)}`);
  if (parts.length) return parts.join(" + ");
  return dataSource.loadedAt ? `Vista general - ${dataSource.rows} movimientos` : "Vista general";
}

function hasActiveFilters() {
  return activeFilters.category !== "todos" || activeFilters.type !== "todos" || activeFilters.month !== "todos";
}

function normalizeFilterKind(kind) {
  if (kind === "category" || kind === "categoria") return "category";
  if (kind === "type" || kind === "tipo") return "type";
  if (kind === "month" || kind === "mes") return "month";
  return "";
}

function handleDonutClick(event) {
  const slice = getDonutSliceFromEvent(event);
  if (slice) setFocus("type", slice.type);
}

function handleDonutHover(event) {
  event.currentTarget.style.cursor = getDonutSliceFromEvent(event) ? "pointer" : "default";
}

function handleMonthlyClick(event) {
  const point = getMonthPointFromEvent(event);
  if (point) setFocus("month", point.month);
}

function handleMonthlyHover(event) {
  event.currentTarget.style.cursor = getMonthPointFromEvent(event) ? "pointer" : "default";
}

function getDonutSliceFromEvent(event) {
  const canvas = event.currentTarget;
  const point = getCanvasPoint(event, canvas);
  const dx = point.x - 110;
  const dy = point.y - 110;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance < 54 || distance > 92) return null;

  let angle = Math.atan2(dy, dx);
  if (angle < -Math.PI / 2) angle += Math.PI * 2;
  return donutSlices.find((slice) => angle >= slice.start && angle <= slice.end) || null;
}

function getMonthPointFromEvent(event) {
  const canvas = event.currentTarget;
  const point = getCanvasPoint(event, canvas);
  return (
    monthPoints.find((monthPoint) => {
      const dx = point.x - monthPoint.x;
      const dy = point.y - monthPoint.y;
      return Math.sqrt(dx * dx + dy * dy) <= monthPoint.radius;
    }) || null
  );
}

function getCanvasPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function renderAll() {
  renderKpis();
  renderSystemInsights();
  renderMilestones();
  renderCategoryChart();
  renderTypeDonut();
  renderMonthlyChart();
  renderFilters();
  renderTable();
  renderPredictionPlaceholder();
}

function renderKpis() {
  const rows = getFocusedRows();
  const total = rows.length;
  const totalAmount = sum(rows, "monto");
  const attention = rows.filter((row) => row.requiere_atencion === 1).length;
  const avgScore = total ? sum(rows, "score_financiero") / total : 0;

  setText("kpiTotal", total.toString());
  setText("kpiMonto", currency.format(totalAmount));
  setText("kpiAtencion", total ? `${Math.round((attention / total) * 100)}%` : "0%");
  setText("kpiScore", avgScore.toFixed(2));
}

function renderSystemInsights() {
  const rows = getFocusedRows();
  const topCategory = topBySum(rows, "categoria", "monto");
  const mainType = topByCount(rows, "tipo_gasto");
  const attention = rows.length ? Math.round((rows.filter((row) => row.requiere_atencion === 1).length / rows.length) * 100) : 0;
  const totalAmount = sum(rows, "monto");
  const latest = latestRow(rows);
  const clearButton = document.getElementById("clearFocusBtn");

  setText("systemSource", dataSource.name);
  setText("systemScope", formatFocusLabel());
  setText("systemTopCategory", topCategory ? `${topCategory.key} (${compactMoney(topCategory.value)})` : "Sin datos");
  setText("systemMainType", mainType ? `${formatType(mainType.key)} (${mainType.value})` : "Sin datos");
  setText("systemAttention", `${attention}%`);

  clearButton.disabled = !hasActiveFilters();
  clearButton.textContent = hasActiveFilters() ? "Limpiar filtros" : "Vista general";

  document.getElementById("systemNarrative").textContent = buildSystemNarrative(rows, topCategory, mainType, attention, totalAmount, latest);
}

function renderMilestones() {
  const list = document.getElementById("milestones");
  const rows = getFocusedRows();
  const milestones = [...rows]
    .filter((row) => row.tipo_gasto !== "gasto_controlado")
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha) || b.score_financiero - a.score_financiero)
    .slice(0, 8);

  document.getElementById("hitosCount").textContent = `${milestones.length} hitos`;
  list.innerHTML = milestones.length
    ? milestones
        .map(
          (row) => `
            <div class="milestone">
              <strong>${escapeHtml(row.descripcion)} &middot; ${currency.format(row.monto)}</strong>
              <span>${row.fecha} &middot; ${row.categoria} &middot; ${formatType(row.tipo_gasto)} &middot; score ${row.score_financiero.toFixed(2)}</span>
            </div>
          `,
        )
        .join("")
    : `<div class="milestone"><strong>Sin hitos</strong><span>Carga un CSV para ver movimientos destacados.</span></div>`;
}

function renderCategoryChart() {
  const chart = document.getElementById("categoryChart");
  const totals = groupSum(getFocusedRows("category"), "categoria", "monto");
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, value]) => value), 1);

  chart.innerHTML = entries
    .map(([category, value]) => {
      const width = Math.max(3, (value / max) * 100);
      return `
        <button class="bar-row chart-control ${isFocus("category", category) ? "active" : ""}" type="button" data-category="${escapeAttr(category)}">
          <span>${category}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
          <strong>${compactMoney(value)}</strong>
        </button>
      `;
    })
    .join("");

  chart.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => setFocus("category", button.dataset.category));
  });
}

function renderTypeDonut() {
  const canvas = document.getElementById("typeDonut");
  const legend = document.getElementById("typeLegend");
  const ctx = canvas.getContext("2d");
  const counts = countBy(getFocusedRows("type"), "tipo_gasto");
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((acc, [, value]) => acc + value, 0);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!total) {
    donutSlices = [];
    legend.innerHTML = "";
    return;
  }

  let start = -Math.PI / 2;
  donutSlices = [];
  entries.forEach(([type, value]) => {
    const angle = (value / total) * Math.PI * 2;
    const end = start + angle;
    donutSlices.push({ type, value, start, end });
    ctx.beginPath();
    ctx.moveTo(110, 110);
    ctx.arc(110, 110, 92, start, end);
    ctx.closePath();
    ctx.globalAlpha = activeFilters.type !== "todos" && activeFilters.type !== type ? 0.28 : 1;
    ctx.fillStyle = typeColors[type] || "#637068";
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#fffdf7";
    ctx.lineWidth = isFocus("type", type) ? 5 : 2;
    ctx.stroke();
    start = end;
  });

  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(110, 110, 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  ctx.fillStyle = "#17201b";
  ctx.font = "700 20px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText(total, 110, 114);

  legend.innerHTML = entries
    .map(
      ([type, value]) => `
        <button class="legend-item ${isFocus("type", type) ? "active" : ""}" type="button" data-type="${escapeAttr(type)}">
          <span class="legend-color" style="background:${typeColors[type] || "#637068"}"></span>
          <span>${formatType(type)} &middot; ${value}</span>
        </button>
      `,
    )
    .join("");

  legend.querySelectorAll("[data-type]").forEach((button) => {
    button.addEventListener("click", () => setFocus("type", button.dataset.type));
  });
}

function renderMonthlyChart() {
  const canvas = document.getElementById("monthlyChart");
  const legend = document.getElementById("monthLegend");
  const ctx = canvas.getContext("2d");
  const monthly = groupSum(getFocusedRows("month"), "mes", "monto");
  const entries = Object.entries(monthly)
    .map(([month, value]) => [Number(month), value])
    .sort((a, b) => a[0] - b[0]);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  legend.innerHTML = "";
  monthPoints = [];
  if (!entries.length) return;

  const padding = 44;
  const max = Math.max(...entries.map(([, value]) => value), 1);
  const min = Math.min(...entries.map(([, value]) => value), 0);
  const width = canvas.width - padding * 2;
  const height = canvas.height - padding * 2;

  ctx.strokeStyle = "#ddd6c2";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = padding + (height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(canvas.width - padding, y);
    ctx.stroke();
  }

  ctx.beginPath();
  entries.forEach(([month, value], index) => {
    const x = padding + (entries.length === 1 ? width / 2 : (width / (entries.length - 1)) * index);
    const y = padding + height - ((value - min) / Math.max(max - min, 1)) * height;
    monthPoints.push({ month, value, x, y, radius: 13 });
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "#1f7a58";
  ctx.lineWidth = 4;
  ctx.stroke();

  entries.forEach(([month, value], index) => {
    const x = padding + (entries.length === 1 ? width / 2 : (width / (entries.length - 1)) * index);
    const y = padding + height - ((value - min) / Math.max(max - min, 1)) * height;
    const active = isFocus("month", month);
    ctx.fillStyle = active ? "#f0c46b" : "#fffdf7";
    ctx.beginPath();
    ctx.arc(x, y, active ? 9 : 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1f7a58";
    ctx.lineWidth = active ? 5 : 3;
    ctx.stroke();
    ctx.fillStyle = "#637068";
    ctx.font = "12px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText(`M${month}`, x, canvas.height - 14);
    ctx.fillText(compactMoney(value), x, y - 12);
  });

  legend.innerHTML = entries
    .map(
      ([month, value]) => `
        <button class="${isFocus("month", month) ? "active" : ""}" type="button" data-month="${month}">
          ${monthLabel(month)} &middot; ${compactMoney(value)}
        </button>
      `,
    )
    .join("");

  legend.querySelectorAll("[data-month]").forEach((button) => {
    button.addEventListener("click", () => setFocus("month", button.dataset.month));
  });
}

function renderFilters() {
  const select = document.getElementById("typeFilter");
  const selected = activeFilters.type;
  const types = Object.keys(countBy(currentRows, "tipo_gasto")).sort();
  select.innerHTML = `<option value="todos">Todos los tipos</option>${types
    .map((type) => `<option value="${type}">${formatType(type)}</option>`)
    .join("")}`;
  select.value = types.includes(selected) ? selected : "todos";

  const categories = Object.keys(countBy(currentRows, "categoria")).sort();
  const months = Object.keys(countBy(currentRows, "mes"))
    .map(Number)
    .sort((a, b) => a - b);

  setSelectOptions("sidebarCategoryFilter", "Todas", categories.map((category) => [category, category]), activeFilters.category);
  setSelectOptions("sidebarTypeFilter", "Todos", types.map((type) => [type, formatType(type)]), activeFilters.type);
  setSelectOptions("sidebarMonthFilter", "Todos", months.map((month) => [String(month), monthLabel(month)]), activeFilters.month);

  const sidebarClear = document.getElementById("sidebarClearFilters");
  sidebarClear.disabled = !hasActiveFilters();
  document.getElementById("sidebarFilterSummary").textContent = hasActiveFilters()
    ? `${formatFocusLabel()} - ${getFocusedRows().length} movimientos filtrados.`
    : "Vista general del dataset activo.";
}

function renderTable() {
  const body = document.getElementById("movementTable");
  const query = document.getElementById("searchInput").value.toLowerCase();
  const rows = getFocusedRows()
    .filter((row) => `${row.descripcion} ${row.categoria} ${row.tipo_gasto}`.toLowerCase().includes(query))
    .slice(-140)
    .reverse();

  body.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td>${row.fecha}</td>
          <td>${escapeHtml(row.descripcion)}</td>
          <td>${row.categoria}</td>
          <td>${currency.format(row.monto)}</td>
          <td>${row.score_financiero.toFixed(2)}</td>
          <td><span class="type-badge">${formatType(row.tipo_gasto)}</span></td>
        </tr>
      `,
    )
    .join("");
}

function handlePrediction(event) {
  event.preventDefault();
  if (!currentRows.length) return;

  const category = document.getElementById("newCategory").value;
  const amount = toNumber(document.getElementById("newAmount").value);
  const alert = toNumber(document.getElementById("newIncrease").value);
  const frequency = countBy(currentRows, "categoria")[category] || 1;
  const minAmount = Math.min(...currentRows.map((row) => row.monto));
  const maxAmount = Math.max(...currentRows.map((row) => row.monto));
  const frequencies = Object.values(countBy(currentRows, "categoria"));
  const minFrequency = Math.min(...frequencies);
  const maxFrequency = Math.max(...frequencies);

  const row = {
    categoria: category,
    monto: amount,
    frecuencia: frequency,
    porcentaje_categoria: frequency / currentRows.length,
    alerta_incremento: alert,
    peso_categoria: weights[category] || 1,
    monto_normalizado: normalize(amount, minAmount, maxAmount),
    frecuencia_normalizada: normalize(frequency, minFrequency, maxFrequency),
  };
  row.score_financiero = row.monto_normalizado + row.peso_categoria + row.frecuencia_normalizada + row.alerta_incremento;
  row.tipo_gasto = classifyExpense(row);

  document.getElementById("predictionResult").innerHTML = `
    <strong>${formatType(row.tipo_gasto)}</strong>
    <p>Score financiero: ${row.score_financiero.toFixed(2)} &middot; Monto: ${currency.format(row.monto)}</p>
  `;
}

function renderPredictionPlaceholder() {
  document.getElementById("predictionResult").innerHTML = currentRows.length
    ? "<strong>Listo para evaluar</strong><p>Ingresa un gasto nuevo y calcula su tipo financiero.</p>"
    : "<strong>Sin datos</strong><p>Carga un CSV para activar el simulador.</p>";
}

function buildSystemNarrative(rows, topCategory, mainType, attention, totalAmount, latest) {
  if (!currentRows.length) return "Carga un CSV para que el sistema construya una lectura financiera dinamica.";
  if (!rows.length) return "La seleccion actual no contiene movimientos. Limpia el filtro o carga otro CSV para continuar.";

  const scope = hasActiveFilters() ? `En ${formatFocusLabel().toLowerCase()}` : "En la vista general";
  const categoryText = topCategory ? `la categoria con mas peso monetario es ${topCategory.key} con ${currency.format(topCategory.value)}` : "no hay categoria dominante";
  const typeText = mainType ? `el tipo mas repetido es ${formatType(mainType.key)} con ${mainType.value} movimientos` : "no hay tipo dominante";
  const latestText = latest ? `El movimiento mas reciente fue ${latest.descripcion} por ${currency.format(latest.monto)}.` : "";

  return `${scope}, el sistema analiza ${rows.length} movimientos por ${currency.format(totalAmount)}; ${categoryText}, ${typeText} y ${attention}% requiere atencion. ${latestText}`;
}

function setValidation(valid, title, detail) {
  const box = document.getElementById("validationBox");
  box.classList.toggle("invalid", !valid);
  box.innerHTML = `<span class="validation-title">${title}</span><span class="validation-detail">${detail}</span>`;
}

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function toNumber(value) {
  if (typeof value === "number") return value;
  const text = String(value || "0").trim();
  if (text.includes(",")) return Number(text.replace(/\./g, "").replace(",", "."));
  return Number(text);
}

function getMonth(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getMonth() + 1;
}

function normalize(value, min, max) {
  if (max === min) return 0;
  return (value - min) / (max - min);
}

function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  if (sorted[base + 1] === undefined) return sorted[base] || 0;
  return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] || "sin_dato";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function groupSum(rows, key, valueKey) {
  return rows.reduce((acc, row) => {
    const value = row[key] || "sin_dato";
    acc[value] = (acc[value] || 0) + row[valueKey];
    return acc;
  }, {});
}

function topBySum(rows, key, valueKey) {
  const entries = Object.entries(groupSum(rows, key, valueKey));
  if (!entries.length) return null;
  const [topKey, topValue] = entries.sort((a, b) => b[1] - a[1])[0];
  return { key: topKey, value: topValue };
}

function topByCount(rows, key) {
  const entries = Object.entries(countBy(rows, key));
  if (!entries.length) return null;
  const [topKey, topValue] = entries.sort((a, b) => b[1] - a[1])[0];
  return { key: topKey, value: topValue };
}

function setSelectOptions(id, allLabel, entries, selectedValue) {
  const select = document.getElementById(id);
  select.innerHTML = `<option value="todos">${allLabel}</option>${entries
    .map(([value, label]) => `<option value="${escapeAttr(value)}">${escapeHtml(label)}</option>`)
    .join("")}`;
  select.value = entries.some(([value]) => String(value) === String(selectedValue)) ? selectedValue : "todos";
}

function latestRow(rows) {
  return [...rows].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0] || null;
}

function sum(rows, key) {
  return rows.reduce((acc, row) => acc + (row[key] || 0), 0);
}

function compactMoney(value) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return currency.format(value);
}

function formatType(type) {
  return String(type || "sin_tipo").replaceAll("_", " ");
}

function monthLabel(month) {
  const labels = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  return labels[Number(month)] || `Mes ${month}`;
}

function formatSourceName(sources) {
  if (!sources.length) return "Sin datos";
  if (sources.length === 1) return sources[0];
  return `${sources[0]} + ${sources.length - 1} anexo${sources.length > 2 ? "s" : ""}`;
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
