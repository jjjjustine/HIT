/* ════════════════════════════════════════════════════════════════
   IoT Sensor Dashboard — script.js
   Real data from Supabase `readings` table.
   Features: live cards, trend arrows, Chart.js dual-axis,
   sortable/filterable/paginated table, CSV export, time range,
   abnormal value alerts, auto-refresh every 10 s.
   ════════════════════════════════════════════════════════════════ */

"use strict";

// ── Config ───────────────────────────────────────────────────────
const supabaseUrl      = "https://qzmsxpuefsfkiebcocmq.supabase.co";
const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6bXN4cHVlZnNma2llYmNvY21xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MzI0NTAsImV4cCI6MjA4OTQwODQ1MH0.qwU_C-rVhPusL88r50rixugIi5ljppYFdg8xehv75CQ";
const TABLE             = "readings";
const REFRESH_MS        = 10_000;
const MAX_CHART_PTS     = 80;
const PAGE_SIZE         = 20;

// Abnormal thresholds
const ALERT = { tempHigh: 38, tempLow: 5, humHigh: 90, humLow: 10 };

// ── Supabase ─────────────────────────────────────────────────────
const { createClient } = supabase;
const db = createClient(supabaseUrl, apiKey);

// ── DOM ──────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const D = {
  sidebarDot:       $("sidebarDot"),
  liveChip:         $("liveChip"),
  liveChipLabel:    $("liveChipLabel"),
  lastSync:         $("lastSync"),
  // Cards
  currTemp:         $("currTemp"),
  currHum:          $("currHum"),
  trendTemp:        $("trendTemp"),
  trendHum:         $("trendHum"),
  deltaTemp:        $("deltaTemp"),
  deltaHum:         $("deltaHum"),
  avgTemp:          $("avgTemp"),
  avgHum:           $("avgHum"),
  tempMinMax:       $("tempMinMax"),
  humMinMax:        $("humMinMax"),
  tempReadingCount: $("tempReadingCount"),
  humReadingCount:  $("humReadingCount"),
  // Alert
  alertStripe:      $("alertStripe"),
  alertMsg:         $("alertMsg"),
  alertClose:       $("alertClose"),
  // Chart
  chartSubtitle:    $("chartSubtitle"),
  togTemp:          $("togTemp"),
  togHum:           $("togHum"),
  // Table
  tableBody:        $("tableBody"),
  tableSubtitle:    $("tableSubtitle"),
  tableCount:       $("tableCount"),
  pager:            $("pager"),
  searchInput:      $("searchInput"),
  // Controls
  btnRefresh:       $("btnRefresh"),
  btnClear:         $("btnClear"),
  btnExport:        $("btnExport"),
  timeRange:        $("timeRange"),
  hamburger:        $("hamburger"),
};

// ── State ────────────────────────────────────────────────────────
const S = {
  data:        [],
  filtered:    [],
  range:       "6h",
  sortCol:     "timestamp",
  sortDir:     "desc",
  page:        1,
  cleared:     false,
  timer:       null,
};

// ── Chart Setup ──────────────────────────────────────────────────
const chartCtx = document.getElementById("mainChart").getContext("2d");
const mainChart = new Chart(chartCtx, {
  type: "line",
  data: {
    labels: [],
    datasets: [
      {
        label: "Temperature (°C)",
        data: [],
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59,130,246,.07)",
        borderWidth: 2.2,
        pointRadius: 2.8,
        pointHoverRadius: 5,
        pointBackgroundColor: "#3b82f6",
        pointBorderColor: "#fff",
        pointBorderWidth: 1.5,
        tension: 0.42,
        fill: true,
        yAxisID: "yT",
      },
      {
        label: "Humidity (%)",
        data: [],
        borderColor: "#06b6d4",
        backgroundColor: "rgba(6,182,212,.07)",
        borderWidth: 2.2,
        pointRadius: 2.8,
        pointHoverRadius: 5,
        pointBackgroundColor: "#06b6d4",
        pointBorderColor: "#fff",
        pointBorderWidth: 1.5,
        tension: 0.42,
        fill: true,
        yAxisID: "yH",
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 350 },
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0d1420",
        titleColor: "#64748b",
        bodyColor: "#f1f5f9",
        padding: 12,
        cornerRadius: 9,
        titleFont: { family: "'IBM Plex Mono', monospace", size: 10 },
        bodyFont:  { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: "600" },
        borderColor: "rgba(255,255,255,.08)",
        borderWidth: 1,
        callbacks: {
          title: (items) => fmtFull(items[0].label),
          label: (item) => {
            const u = item.datasetIndex === 0 ? "°C" : "%";
            return `  ${item.dataset.label.split(" ")[0]}: ${Number(item.raw).toFixed(1)}${u}`;
          },
        },
      },
    },
    scales: {
      x: {
        type: "time",
        time: {
          tooltipFormat: "yyyy-MM-dd HH:mm:ss",
          displayFormats: { minute: "HH:mm", hour: "HH:mm", day: "MMM d" },
        },
        ticks: {
          maxTicksLimit: 8,
          maxRotation: 0,
          font: { family: "'IBM Plex Mono', monospace", size: 10 },
          color: "#94a3b8",
        },
        grid: { color: "#f1f5f9", tickLength: 0 },
        border: { display: false },
      },
      yT: {
        type: "linear",
        position: "left",
        title: {
          display: true,
          text: "°C",
          color: "#3b82f6",
          font: { family: "'IBM Plex Mono', monospace", size: 10, weight: "500" },
        },
        ticks: {
          font: { family: "'IBM Plex Mono', monospace", size: 10 },
          color: "#3b82f6",
          callback: (v) => v.toFixed(0),
        },
        grid: { color: "#f1f5f9" },
        border: { display: false },
      },
      yH: {
        type: "linear",
        position: "right",
        title: {
          display: true,
          text: "%",
          color: "#06b6d4",
          font: { family: "'IBM Plex Mono', monospace", size: 10, weight: "500" },
        },
        ticks: {
          font: { family: "'IBM Plex Mono', monospace", size: 10 },
          color: "#06b6d4",
          callback: (v) => v.toFixed(0),
        },
        grid: { display: false },
        border: { display: false },
      },
    },
  },
});

// ── Helpers ──────────────────────────────────────────────────────
function fmtFull(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-PH", {
    month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
}

function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

function rangeStart(r) {
  const h = { "1h": 1, "6h": 6, "24h": 24, "7d": 168 };
  return new Date(Date.now() - (h[r] ?? 6) * 3_600_000).toISOString();
}

function setConnectionState(state) {
  // state: 'live' | 'loading' | 'error'
  D.sidebarDot.className      = `sidebar__device-dot ${state}`;
  D.liveChip.className        = `live-chip ${state}`;
  const labels = { live: "Live", loading: "Syncing…", error: "Offline" };
  D.liveChipLabel.textContent = labels[state] ?? state;
}

function stampSync() {
  D.lastSync.textContent = new Date().toLocaleTimeString("en-PH", { hour12: false });
}

// ── Fetch ────────────────────────────────────────────────────────
async function fetchData() {
  setConnectionState("loading");
  try {
    const { data, error } = await db
      .from(TABLE)
      .select("created_at, temperature, humidity")
      .gte("created_at", rangeStart(S.range))
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;
    S.data = data ?? [];

    if (!S.cleared) renderAll();

    setConnectionState("live");
    stampSync();
  } catch (err) {
    console.error("[Dashboard]", err);
    setConnectionState("error");
  }
}

// ── Render All ───────────────────────────────────────────────────
function renderAll() {
  renderCards();
  renderChart();
  applyFilter();
  renderAlerts();
}

// ── Cards ────────────────────────────────────────────────────────
function renderCards() {
  const d = S.data;
  if (!d.length) return;

  const latest = d[0];
  const prev   = d[1];

  // Current values
  D.currTemp.textContent = latest.temperature != null ? Number(latest.temperature).toFixed(1) : "—";
  D.currHum.textContent  = latest.humidity    != null ? Number(latest.humidity).toFixed(1)    : "—";

  // Trend vs previous
  if (prev && prev.temperature != null && latest.temperature != null) {
    const diff = latest.temperature - prev.temperature;
    const sign = diff > 0 ? "+" : "";
    D.trendTemp.textContent = diff > 0 ? "▲" : diff < 0 ? "▼" : "—";
    D.trendTemp.className   = `mcard__trend ${diff > 0 ? "up" : diff < 0 ? "down" : ""}`;
    D.deltaTemp.textContent = sign + diff.toFixed(2) + "°C";
  }
  if (prev && prev.humidity != null && latest.humidity != null) {
    const diff = latest.humidity - prev.humidity;
    const sign = diff > 0 ? "+" : "";
    D.trendHum.textContent = diff > 0 ? "▲" : diff < 0 ? "▼" : "—";
    D.trendHum.className   = `mcard__trend ${diff > 0 ? "up" : diff < 0 ? "down" : ""}`;
    D.deltaHum.textContent = sign + diff.toFixed(2) + "%";
  }

  // Averages
  const temps = d.map(r => r.temperature).filter(v => v != null);
  const hums  = d.map(r => r.humidity).filter(v => v != null);

  const aT = avg(temps), aH = avg(hums);
  D.avgTemp.textContent = aT != null ? aT.toFixed(1) : "—";
  D.avgHum.textContent  = aH != null ? aH.toFixed(1) : "—";

  const tMin = Math.min(...temps), tMax = Math.max(...temps);
  const hMin = Math.min(...hums),  hMax = Math.max(...hums);
  D.tempMinMax.textContent      = `min / max: ${tMin.toFixed(1)} / ${tMax.toFixed(1)}`;
  D.humMinMax.textContent       = `min / max: ${hMin.toFixed(0)} / ${hMax.toFixed(0)}`;
  D.tempReadingCount.textContent = `${temps.length} readings`;
  D.humReadingCount.textContent  = `${hums.length} readings`;
}

// ── Chart ────────────────────────────────────────────────────────
function renderChart() {
  const slice = [...S.data].reverse().slice(-MAX_CHART_PTS);
  mainChart.data.labels            = slice.map(r => r.created_at);
  mainChart.data.datasets[0].data = slice.map(r => r.temperature);
  mainChart.data.datasets[1].data = slice.map(r => r.humidity);
  mainChart.update("active");

  const rangeLabel = { "1h": "Last 1 h", "6h": "Last 6 h", "24h": "Last 24 h", "7d": "Last 7 d" };
  D.chartSubtitle.textContent = `${slice.length} data points · ${rangeLabel[S.range] ?? ""}`;
}

// ── Table ────────────────────────────────────────────────────────
function applyFilter() {
  const q = (D.searchInput.value || "").trim().toLowerCase();
  let rows = [...S.data];

  if (q) {
    rows = rows.filter(r =>
      fmtFull(r.created_at).toLowerCase().includes(q) ||
      String(r.temperature).includes(q) ||
      String(r.humidity).includes(q)
    );
  }

  rows.sort((a, b) => {
    let av = a[S.sortCol], bv = b[S.sortCol];
    if (S.sortCol === "timestamp") { av = new Date(av); bv = new Date(bv); }
    else { av = Number(av); bv = Number(bv); }
    return S.sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  });

  S.filtered = rows;
  S.page = 1;
  renderTable();
}

function renderTable() {
  const rows  = S.filtered;
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pg    = Math.min(S.page, pages);
  const start = (pg - 1) * PAGE_SIZE;
  const slice = rows.slice(start, start + PAGE_SIZE);

  D.tableCount.textContent    = `${total} record${total !== 1 ? "s" : ""}`;
  D.tableSubtitle.textContent = `Showing ${Math.min(start + 1, total)}–${Math.min(start + PAGE_SIZE, total)} of ${total}`;

  if (!slice.length) {
    D.tableBody.innerHTML = `<tr class="rtable__empty"><td colspan="3">No matching records.</td></tr>`;
    D.pager.innerHTML = "";
    return;
  }

  D.tableBody.innerHTML = slice.map(r => {
    const warn = r.temperature > ALERT.tempHigh || r.temperature < ALERT.tempLow;
    return `<tr${warn ? ' class="row--warn"' : ""}>
      <td>${fmtFull(r.created_at)}</td>
      <td>${r.temperature != null ? Number(r.temperature).toFixed(2) : "—"}</td>
      <td>${r.humidity    != null ? Number(r.humidity).toFixed(2)    : "—"}</td>
    </tr>`;
  }).join("");

  buildPager(pg, pages);
}

function buildPager(cur, total) {
  if (total <= 1) { D.pager.innerHTML = ""; return; }

  const max = 5, half = Math.floor(max / 2);
  let lo = Math.max(1, cur - half);
  let hi = Math.min(total, lo + max - 1);
  lo = Math.max(1, hi - max + 1);
  const nums = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

  D.pager.innerHTML =
    `<button class="pager-btn" data-p="${cur - 1}" ${cur === 1 ? "disabled" : ""}>‹</button>` +
    nums.map(p => `<button class="pager-btn${p === cur ? " active" : ""}" data-p="${p}">${p}</button>`).join("") +
    `<button class="pager-btn" data-p="${cur + 1}" ${cur === total ? "disabled" : ""}>›</button>`;
}

// ── Alerts ───────────────────────────────────────────────────────
function renderAlerts() {
  if (!S.data.length) { D.alertStripe.hidden = true; return; }
  const r = S.data[0];
  const msgs = [];
  if (r.temperature > ALERT.tempHigh) msgs.push(`High temperature: ${Number(r.temperature).toFixed(1)}°C`);
  if (r.temperature < ALERT.tempLow)  msgs.push(`Low temperature: ${Number(r.temperature).toFixed(1)}°C`);
  if (r.humidity    > ALERT.humHigh)  msgs.push(`High humidity: ${Number(r.humidity).toFixed(0)}%`);
  if (r.humidity    < ALERT.humLow)   msgs.push(`Low humidity: ${Number(r.humidity).toFixed(0)}%`);

  if (msgs.length) {
    D.alertMsg.textContent  = msgs.join("  ·  ");
    D.alertStripe.hidden = false;
  } else {
    D.alertStripe.hidden = true;
  }
}

// ── Clear Dashboard ──────────────────────────────────────────────
function clearDashboard() {
  S.cleared = true;
  ["currTemp","currHum","avgTemp","avgHum"].forEach(id => $(id).textContent = "—");
  D.trendTemp.textContent = ""; D.trendHum.textContent = "";
  D.deltaTemp.textContent = "—"; D.deltaHum.textContent = "—";
  D.tempMinMax.textContent = "min / max: — / —";
  D.humMinMax.textContent  = "min / max: — / —";
  D.tempReadingCount.textContent = "— readings";
  D.humReadingCount.textContent  = "— readings";
  D.alertStripe.hidden = true;

  mainChart.data.labels            = [];
  mainChart.data.datasets[0].data = [];
  mainChart.data.datasets[1].data = [];
  mainChart.update();

  D.tableBody.innerHTML = `<tr class="rtable__empty"><td colspan="3">Dashboard cleared — press Refresh to reload.</td></tr>`;
  D.tableCount.textContent = "0 records";
  D.pager.innerHTML = "";
  D.chartSubtitle.textContent = "—";
  setConnectionState("loading");
}

// ── CSV Export ───────────────────────────────────────────────────
function exportCSV() {
  if (!S.data.length) { alert("No data to export."); return; }
  const header = "Timestamp,Temperature,Humidity";
  const rows = S.data.map(r =>
    `"${r.created_at ?? ""}",${r.temperature ?? ""},${r.humidity ?? ""}`
  );
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), {
    href: url,
    download: `readings_${new Date().toISOString().slice(0,19).replace(/:/g,"-")}.csv`,
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Event Wiring ─────────────────────────────────────────────────

// Refresh
D.btnRefresh.addEventListener("click", () => { S.cleared = false; fetchData(); });

// Clear
D.btnClear.addEventListener("click", clearDashboard);

// Export
D.btnExport.addEventListener("click", exportCSV);

// Alert close
D.alertClose.addEventListener("click", () => { D.alertStripe.hidden = true; });

// Search
D.searchInput.addEventListener("input", applyFilter);

// Time range
D.timeRange.addEventListener("click", (e) => {
  const btn = e.target.closest(".rtab");
  if (!btn) return;
  const r = btn.dataset.range;
  if (!r || r === S.range) return;
  D.timeRange.querySelectorAll(".rtab").forEach(b => b.classList.remove("rtab--on"));
  btn.classList.add("rtab--on");
  S.range   = r;
  S.cleared = false;
  fetchData();
});

// Sort
document.querySelectorAll(".th-sort").forEach(th => {
  th.addEventListener("click", () => {
    const col = th.dataset.col;
    S.sortDir = (S.sortCol === col && S.sortDir === "desc") ? "asc" : "desc";
    S.sortCol = col;
    // Update arrows
    document.querySelectorAll(".th-sort__icon").forEach(i => i.classList.remove("asc", "desc"));
    const icon = th.querySelector(".th-sort__icon");
    if (icon) icon.classList.add(S.sortDir);
    applyFilter();
  });
});

// Pagination
D.pager.addEventListener("click", (e) => {
  const btn = e.target.closest(".pager-btn");
  if (!btn || btn.disabled) return;
  const p = Number(btn.dataset.p);
  if (!isNaN(p) && p > 0) { S.page = p; renderTable(); }
});

// Chart dataset toggles
[D.togTemp, D.togHum].forEach(btn => {
  btn.addEventListener("click", () => {
    const idx    = Number(btn.dataset.idx);
    const meta   = mainChart.getDatasetMeta(idx);
    meta.hidden  = !meta.hidden;
    mainChart.update();
    btn.classList.toggle("legend-btn--on",  !meta.hidden);
    btn.classList.toggle("legend-btn--off", meta.hidden);
  });
});

// Mobile hamburger
D.hamburger.addEventListener("click", () => {
  document.querySelector(".sidebar").classList.toggle("open");
});

// ── Auto-refresh + Init ──────────────────────────────────────────
function startAutoRefresh() {
  clearInterval(S.timer);
  S.timer = setInterval(() => { if (!S.cleared) fetchData(); }, REFRESH_MS);
}

(function init() {
  fetchData();
  startAutoRefresh();
})();