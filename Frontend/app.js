// API Sentinel Frontend Application

const API_BASE = "/api/v1";

// State
let currentUser = null;
let authToken = localStorage.getItem("api_monitor_token") || null;
let monitorsList = [];
let dashboardSummary = {
  total_monitors: 0,
  up_monitors: 0,
  down_monitors: 0,
  paused_monitors: 0,
  avg_latency: 0,
  overall_uptime: 100,
};
let activeFilter = "all";
let searchQuery = "";
let selectedMonitorMetrics = null;
let autoRefreshTimer = null;
let checkingMonitors = new Set(); // tracks IDs currently being checked

// Helper: HTTP Request with Auth
async function apiRequest(endpoint, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        // Auth expired
        currentUser = null;
        authToken = null;
        localStorage.removeItem("api_monitor_token");
        renderAuthUI();
      }
      throw new Error(data.message || `Request failed with status ${res.status}`);
    }

    return data;
  } catch (err) {
    console.error(`API Error [${endpoint}]:`, err);
    throw err;
  }
}

// Authentication
async function checkAuthSession() {
  if (!authToken) {
    renderAuthUI();
    return;
  }
  try {
    const res = await apiRequest("/users/me");
    currentUser = res.data;
    renderAuthUI();
    loadDashboard();
  } catch {
    currentUser = null;
    authToken = null;
    renderAuthUI();
  }
}

async function loginUser(email, password) {
  const res = await apiRequest("/users/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  authToken = res.data.accessToken;
  currentUser = res.data.user;
  localStorage.setItem("api_monitor_token", authToken);
  closeModal("authModal");
  renderAuthUI();
  loadDashboard();
}

async function registerUser(name, email, password) {
  const res = await apiRequest("/users/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
  authToken = res.data.accessToken;
  currentUser = res.data.user;
  localStorage.setItem("api_monitor_token", authToken);
  closeModal("authModal");
  renderAuthUI();
  loadDashboard();
}

function logoutUser() {
  if (authToken) {
    apiRequest("/users/logout", { method: "POST" }).catch(() => {});
  }
  currentUser = null;
  authToken = null;
  localStorage.removeItem("api_monitor_token");
  monitorsList = [];
  renderAuthUI();
  renderMonitors();
  renderKPIs();
}

// Demo quick-start account helper
async function demoQuickStart() {
  const demoEmail = `dev_${Math.floor(Math.random() * 10000)}@sentinel.dev`;
  const demoPass = "Test@123456";
  try {
    await registerUser("Developer Demo", demoEmail, demoPass);
    // Add sample popular APIs to get started immediately!
    await addSampleMonitors();
  } catch (err) {
    alert("Quick-start failed: " + err.message);
  }
}

async function addSampleMonitors() {
  const samples = [
    { name: "GitHub API Health", url: "https://api.github.com/zen", intervalSeconds: 60 },
    { name: "Cloudflare DNS Status", url: "https://1.1.1.1", intervalSeconds: 60 },
    { name: "JSONPlaceholder API", url: "https://jsonplaceholder.typicode.com/posts/1", intervalSeconds: 60 },
  ];
  for (const s of samples) {
    try {
      await apiRequest("/monitors", {
        method: "POST",
        body: JSON.stringify(s),
      });
    } catch (e) {
      console.warn("Sample add err:", e);
    }
  }
  await loadDashboard();
}

// Data Fetching
async function loadDashboard() {
  if (!authToken) return;

  try {
    const [monitorsRes, summaryRes] = await Promise.all([
      apiRequest("/monitors"),
      apiRequest("/monitors/summary").catch(() => ({ data: {} })),
    ]);

    monitorsList = monitorsRes.data || [];
    if (summaryRes.data) {
      dashboardSummary = summaryRes.data;
    }

    renderKPIs();
    renderMonitors();
  } catch (err) {
    console.error("Failed to load dashboard data:", err);
  }
}

// Manual Check Trigger
async function triggerManualCheck(monitorId) {
  if (checkingMonitors.has(monitorId)) return;
  checkingMonitors.add(monitorId);
  renderMonitors();

  try {
    const res = await apiRequest(`/monitors/${monitorId}/check`, {
      method: "POST",
    });

    // Update in local list
    const idx = monitorsList.findIndex((m) => m.id === monitorId);
    if (idx !== -1 && res.data?.check) {
      const check = res.data.check;
      monitorsList[idx].last_status = res.data.status;
      monitorsList[idx].last_status_code = check.status_code;
      monitorsList[idx].last_response_time = check.response_time;
      monitorsList[idx].last_checked_at = check.checked_at;
    }

    // If analytics modal is open for this monitor, refresh it
    if (selectedMonitorMetrics && selectedMonitorMetrics.monitor.id === monitorId) {
      await viewMonitorAnalytics(monitorId);
    }
  } catch (err) {
    alert("Health check failed: " + err.message);
  } finally {
    checkingMonitors.delete(monitorId);
    renderMonitors();
    renderKPIs();
  }
}

// Toggle Pause/Resume
async function toggleMonitorActive(monitorId) {
  try {
    const res = await apiRequest(`/monitors/${monitorId}/toggle`, {
      method: "PATCH",
    });
    const idx = monitorsList.findIndex((m) => m.id === monitorId);
    if (idx !== -1) {
      monitorsList[idx].is_active = res.data.is_active;
    }
    renderMonitors();
    renderKPIs();
  } catch (err) {
    alert("Failed to toggle monitor: " + err.message);
  }
}

// Delete Monitor
async function deleteMonitor(monitorId, name) {
  if (!confirm(`Are you sure you want to delete monitor "${name}"? All historical logs will be removed.`)) {
    return;
  }
  try {
    await apiRequest(`/monitors/${monitorId}`, { method: "DELETE" });
    monitorsList = monitorsList.filter((m) => m.id !== monitorId);
    renderMonitors();
    renderKPIs();
  } catch (err) {
    alert("Failed to delete monitor: " + err.message);
  }
}

// View Analytics & Historical Performance
async function viewMonitorAnalytics(monitorId) {
  try {
    const res = await apiRequest(`/monitors/${monitorId}/metrics?hours=24`);
    selectedMonitorMetrics = res.data;
    renderAnalyticsModal();
    openModal("analyticsModal");
  } catch (err) {
    alert("Failed to load historical analytics: " + err.message);
  }
}

// Create New Monitor
async function handleCreateMonitor(e) {
  e.preventDefault();
  const name = document.getElementById("monitorName").value.trim();
  const url = document.getElementById("monitorUrl").value.trim();
  const intervalSeconds = document.getElementById("monitorInterval").value;

  if (!name || !url) {
    alert("Please fill in both Name and URL");
    return;
  }

  const submitBtn = document.getElementById("createMonitorSubmitBtn");
  submitBtn.disabled = true;
  submitBtn.innerText = "Validating & Adding...";

  try {
    await apiRequest("/monitors", {
      method: "POST",
      body: JSON.stringify({ name, url, intervalSeconds }),
    });

    closeModal("addMonitorModal");
    document.getElementById("addMonitorForm").reset();
    await loadDashboard();
  } catch (err) {
    alert("Error creating monitor: " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = "Start Monitoring";
  }
}

// UI Rendering Functions
function renderAuthUI() {
  const container = document.getElementById("authActionsContainer");
  if (!container) return;

  if (currentUser) {
    container.innerHTML = `
      <div class="pulse-indicator">
        <span class="pulse-dot"></span>
        <span>${currentUser.name || currentUser.email}</span>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="logoutUser()">Log Out</button>
    `;
  } else {
    container.innerHTML = `
      <button class="btn btn-secondary btn-sm" onclick="demoQuickStart()">⚡ 1-Click Demo</button>
      <button class="btn btn-primary btn-sm" onclick="openModal('authModal')">Sign In</button>
    `;
  }
}

function renderKPIs() {
  const total = monitorsList.length;
  const up = monitorsList.filter((m) => m.is_active && m.last_status === "up").length;
  const down = monitorsList.filter((m) => m.is_active && m.last_status === "down").length;
  
  // Calculate average response time among monitors that have response time
  const monitorsWithLatency = monitorsList.filter((m) => m.last_response_time > 0);
  const avgLatency = monitorsWithLatency.length > 0
    ? Math.round(monitorsWithLatency.reduce((acc, m) => acc + Number(m.last_response_time), 0) / monitorsWithLatency.length)
    : 0;

  // Average uptime across monitors
  const avgUptime = total > 0
    ? (monitorsList.reduce((acc, m) => acc + (parseFloat(m.uptime_percentage) || 100), 0) / total).toFixed(1)
    : "100.0";

  document.getElementById("kpiTotal").innerText = total;
  document.getElementById("kpiUp").innerText = up;
  document.getElementById("kpiDown").innerText = down;
  document.getElementById("kpiLatency").innerText = avgLatency ? `${avgLatency} ms` : "—";
  document.getElementById("kpiUptime").innerText = `${avgUptime}%`;
}

function renderMonitors() {
  const container = document.getElementById("monitorsContainer");
  if (!container) return;

  let filtered = monitorsList.filter((m) => {
    if (activeFilter === "up") return m.is_active && m.last_status === "up";
    if (activeFilter === "down") return m.is_active && m.last_status === "down";
    if (activeFilter === "paused") return !m.is_active;
    return true;
  });

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(
      (m) => m.name.toLowerCase().includes(q) || m.url.toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    if (monitorsList.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg class="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
          <h3 style="font-size: 18px; margin-bottom: 8px;">No APIs Monitored Yet</h3>
          <p style="color: var(--text-secondary); margin-bottom: 20px; max-width: 440px; margin-left: auto; margin-right: auto;">
            Add your first API URL to start tracking latency, uptime percentage, and automated failure detection alerts!
          </p>
          <div style="display: flex; gap: 12px; justify-content: center;">
            <button class="btn btn-primary" onclick="openModal('addMonitorModal')">+ Add New API</button>
            <button class="btn btn-secondary" onclick="demoQuickStart()">⚡ Load Sample APIs</button>
          </div>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="empty-state">
          <p style="color: var(--text-secondary);">No monitors match the selected filter "${activeFilter}".</p>
        </div>
      `;
    }
    return;
  }

  container.innerHTML = filtered
    .map((m) => {
      const isChecking = checkingMonitors.has(m.id);
      const statusClass = !m.is_active ? "paused" : (m.last_status || "pending");
      const statusText = !m.is_active ? "PAUSED" : (m.last_status || "PENDING").toUpperCase();

      const latencyMs = m.last_response_time ? `${m.last_response_time} ms` : "Pending";
      const uptime = m.uptime_percentage ? `${parseFloat(m.uptime_percentage).toFixed(1)}%` : "100%";
      const lastCheck = m.last_checked_at ? formatRelativeTime(m.last_checked_at) : "Never checked";

      return `
        <div class="monitor-card">
          <div>
            <span class="status-badge ${statusClass}">
              <span class="pulse-dot" style="${!m.is_active ? 'background:#64748b; box-shadow:none;' : (statusClass === 'down' ? 'background:#f43f5e; box-shadow:0 0 8px #f43f5e;' : '')}"></span>
              ${statusText}
            </span>
          </div>

          <div class="monitor-info">
            <div class="monitor-name">
              <span>${escapeHtml(m.name)}</span>
              <span style="font-size: 11px; padding: 2px 6px; background: #1c253b; color: var(--text-muted); border-radius: 4px;">Every ${m.interval_seconds || 60}s</span>
            </div>
            <div class="monitor-url" title="${escapeHtml(m.url)}">${escapeHtml(m.url)}</div>
          </div>

          <div class="monitor-metrics-pill">
            <div class="metric-box">
              <span class="label">Latency</span>
              <span class="value" style="${m.last_response_time > 800 ? 'color: var(--rose-400)' : (m.last_response_time > 300 ? 'color: var(--amber-400)' : 'color: var(--emerald-400)')}">
                ${latencyMs}
              </span>
            </div>
            <div class="metric-box">
              <span class="label">24h Uptime</span>
              <span class="value">${uptime}</span>
            </div>
            <div class="metric-box">
              <span class="label">Last Check</span>
              <span class="value" style="font-size: 12px; font-weight: normal; color: var(--text-secondary);">${lastCheck}</span>
            </div>
          </div>

          <div class="action-group">
            <button class="btn btn-secondary btn-sm" onclick="triggerManualCheck(${m.id})" ${isChecking ? "disabled" : ""} title="Run Instant Check">
              ${isChecking ? "Checking..." : "⚡ Check Now"}
            </button>
            <button class="btn btn-secondary btn-sm" onclick="viewMonitorAnalytics(${m.id})" title="View Historical Performance & Charts">
              📊 Analytics
            </button>
            <button class="btn btn-secondary btn-sm" onclick="toggleMonitorActive(${m.id})" title="${m.is_active ? 'Pause Monitoring' : 'Resume Monitoring'}">
              ${m.is_active ? "⏸️" : "▶️"}
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteMonitor(${m.id}, '${escapeHtml(m.name)}')" title="Delete Monitor">
              🗑️
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

// Render Historical Performance Analytics Modal
function renderAnalyticsModal() {
  if (!selectedMonitorMetrics) return;

  const { monitor, metrics, timeline, incidents } = selectedMonitorMetrics;
  const modalBody = document.getElementById("analyticsModalBody");
  if (!modalBody) return;

  const uptime = metrics?.uptime_percentage ? `${parseFloat(metrics.uptime_percentage).toFixed(2)}%` : "100.00%";
  const avgLatency = metrics?.avg_response_time ? `${metrics.avg_response_time} ms` : "0 ms";
  const minLatency = metrics?.min_response_time ? `${metrics.min_response_time} ms` : "0 ms";
  const maxLatency = metrics?.max_response_time ? `${metrics.max_response_time} ms` : "0 ms";
  const totalChecks = metrics?.total_checks || 0;
  const downChecks = metrics?.down_checks || 0;

  // Generate SVG Time-Series Chart
  const svgChart = renderLatencySVGChart(timeline || [], Number(metrics?.avg_response_time) || 0);

  // Generate 50-check Heartbeat Bar
  const heartbeatBars = renderHeartbeatBars(timeline || []);

  modalBody.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
      <div>
        <h2 style="font-size: 20px; font-weight: 800;">${escapeHtml(monitor.name)}</h2>
        <div style="font-family: var(--font-mono); font-size: 13px; color: var(--text-secondary); margin-top: 4px;">
          ${escapeHtml(monitor.url)}
        </div>
      </div>
      <div>
        <button class="btn btn-primary btn-sm" onclick="triggerManualCheck(${monitor.id})">
          ⚡ Run Health Check
        </button>
      </div>
    </div>

    <!-- Quick Stats Grid -->
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px;">
      <div style="background: var(--bg-secondary); padding: 14px; border-radius: 10px; border: 1px solid var(--border);">
        <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">24h Uptime</div>
        <div style="font-size: 20px; font-weight: 800; color: var(--emerald-400); margin-top: 4px;">${uptime}</div>
      </div>
      <div style="background: var(--bg-secondary); padding: 14px; border-radius: 10px; border: 1px solid var(--border);">
        <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Average Latency</div>
        <div style="font-size: 20px; font-weight: 800; color: var(--text-primary); margin-top: 4px;">${avgLatency}</div>
      </div>
      <div style="background: var(--bg-secondary); padding: 14px; border-radius: 10px; border: 1px solid var(--border);">
        <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Min / Max Latency</div>
        <div style="font-size: 15px; font-weight: 700; color: var(--text-secondary); margin-top: 8px;">${minLatency} / ${maxLatency}</div>
      </div>
      <div style="background: var(--bg-secondary); padding: 14px; border-radius: 10px; border: 1px solid var(--border);">
        <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase;">Checks / Incidents</div>
        <div style="font-size: 15px; font-weight: 700; color: ${downChecks > 0 ? 'var(--rose-400)' : 'var(--text-primary)'}; margin-top: 8px;">${totalChecks} checks / ${downChecks} down</div>
      </div>
    </div>

    <!-- Heartbeat Bar -->
    <div style="margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">
        <span>Recent 50 Health Checks (Oldest ➔ Newest)</span>
        <span style="color: var(--emerald-400); font-weight: 600;">Operational</span>
      </div>
      <div style="display: flex; gap: 4px; height: 28px; background: var(--bg-secondary); padding: 4px 6px; border-radius: 8px; border: 1px solid var(--border); align-items: center;">
        ${heartbeatBars}
      </div>
    </div>

    <!-- Historical Latency Curve -->
    <div style="margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 13px; font-weight: 700;">Historical Latency (ms)</span>
        <span style="font-size: 12px; color: var(--text-muted);">Last 50 data points</span>
      </div>
      <div class="chart-container">
        ${svgChart}
      </div>
    </div>

    <!-- Recent Incident / Outage Log -->
    ${
      incidents && incidents.length > 0
        ? `
        <div style="margin-bottom: 24px;">
          <h4 style="font-size: 14px; font-weight: 700; color: var(--rose-400); margin-bottom: 12px;">🚨 Incident Log</h4>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${incidents
              .map(
                (inc) => `
              <div style="padding: 10px 14px; background: rgba(244, 63, 94, 0.08); border: 1px solid rgba(244, 63, 94, 0.2); border-radius: 8px; font-size: 12.5px; display: flex; justify-content: space-between;">
                <div>
                  <strong>${inc.type.toUpperCase()}:</strong> ${escapeHtml(inc.details || "API Down")}
                  ${inc.notified_to ? `<span style="color: var(--text-muted);"> (Alert sent to ${escapeHtml(inc.notified_to)})</span>` : ""}
                </div>
                <div style="color: var(--text-muted); font-family: var(--font-mono);">${formatRelativeTime(inc.created_at)}</div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `
        : ""
    }

    <!-- Recent Check Logs Table -->
    <div>
      <h4 style="font-size: 14px; font-weight: 700; margin-bottom: 8px;">Detailed Check Log</h4>
      <div style="max-height: 220px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px;">
        <table class="logs-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>HTTP Code</th>
              <th>Latency</th>
              <th>Timestamp</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            ${(timeline || [])
              .slice(-20)
              .reverse()
              .map(
                (c) => `
              <tr>
                <td>
                  <span class="status-badge ${c.is_up ? 'up' : 'down'}" style="font-size: 10px; padding: 2px 6px;">
                    ${c.is_up ? 'UP' : 'DOWN'}
                  </span>
                </td>
                <td style="font-family: var(--font-mono);">${c.status_code || '—'}</td>
                <td style="font-family: var(--font-mono); color: ${c.response_time > 500 ? 'var(--amber-400)' : 'var(--text-primary)'};">${c.response_time || 0} ms</td>
                <td style="font-size: 11px;">${new Date(c.checked_at).toLocaleTimeString()}</td>
                <td style="font-size: 11px; color: ${c.is_up ? 'var(--text-muted)' : 'var(--rose-400)'};">${escapeHtml(c.error_message || 'OK')}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Generate SVG Line Chart
function renderLatencySVGChart(timeline, avgLatency) {
  if (!timeline || timeline.length < 2) {
    return `<div style="text-align: center; padding: 32px; color: var(--text-muted); font-size: 13px;">Collecting health check data points... Please trigger a check or wait 1 minute.</div>`;
  }

  const width = 560;
  const height = 140;
  const padding = 20;

  const latencies = timeline.map((t) => Number(t.response_time) || 0);
  const maxLatency = Math.max(...latencies, avgLatency * 1.5, 100);

  const getX = (idx) => padding + (idx / (timeline.length - 1)) * (width - padding * 2);
  const getY = (val) => height - padding - (val / maxLatency) * (height - padding * 2);

  // Generate SVG path points
  const points = timeline.map((t, idx) => `${getX(idx)},${getY(t.response_time || 0)}`).join(" ");

  // Average line Y coordinate
  const avgY = getY(avgLatency);

  return `
    <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: auto; overflow: visible;">
      <!-- Grid lines -->
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#232d42" stroke-width="1"/>
      <line x1="${padding}" y1="${padding}" x2="${width - padding}" y2="${padding}" stroke="#232d42" stroke-width="1" stroke-dasharray="3,3"/>
      
      <!-- Average Latency Benchmark Line -->
      <line x1="${padding}" y1="${avgY}" x2="${width - padding}" y2="${avgY}" stroke="#3b82f6" stroke-width="1" stroke-dasharray="4,4" opacity="0.6"/>
      <text x="${width - padding + 4}" y="${avgY + 4}" fill="#3b82f6" font-size="9" font-family="monospace">Avg: ${Math.round(avgLatency)}ms</text>
      
      <!-- Max latency label -->
      <text x="${padding}" y="${padding - 6}" fill="#64748b" font-size="9" font-family="monospace">${Math.round(maxLatency)}ms</text>

      <!-- Smooth Area Gradient Fill -->
      <defs>
        <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#10b981" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#10b981" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
      
      <!-- Polygon area under curve -->
      <polygon points="${points} ${getX(timeline.length - 1)},${height - padding} ${getX(0)},${height - padding}" fill="url(#latencyGradient)" />

      <!-- Polyline curve -->
      <polyline points="${points}" fill="none" stroke="#10b981" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>

      <!-- Individual Points with hover -->
      ${timeline
        .map((t, idx) => {
          const cx = getX(idx);
          const cy = getY(t.response_time || 0);
          const color = t.is_up ? "#10b981" : "#f43f5e";
          return `
            <circle cx="${cx}" cy="${cy}" r="${t.is_up ? 3 : 5}" fill="${color}" stroke="#0f172a" stroke-width="1.5">
              <title>${t.response_time}ms (${t.status_code || "DOWN"}) at ${new Date(t.checked_at).toLocaleTimeString()}</title>
            </circle>
          `;
        })
        .join("")}
    </svg>
  `;
}

// Generate Heartbeat Bar Blocks
function renderHeartbeatBars(timeline) {
  if (!timeline || timeline.length === 0) {
    return Array.from({ length: 40 })
      .map(() => `<div class="heartbeat-bar empty" style="flex: 1;"></div>`)
      .join("");
  }

  return timeline
    .slice(-45)
    .map((c) => {
      const cls = c.is_up ? "" : "down";
      const title = `${c.is_up ? 'UP' : 'DOWN'} - ${c.response_time}ms (${c.status_code || 'Error'}) - ${new Date(c.checked_at).toLocaleTimeString()}`;
      return `<div class="heartbeat-bar ${cls}" style="flex: 1;" title="${title}"></div>`;
    })
    .join("");
}

// Modal Control Helpers
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = "flex";
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = "none";
}

// Utility: format relative time
function formatRelativeTime(dateStr) {
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diffSec < 10) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

// Utility: escape HTML
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Event Listeners on Load
window.addEventListener("DOMContentLoaded", () => {
  // Form submission
  const addForm = document.getElementById("addMonitorForm");
  if (addForm) addForm.addEventListener("submit", handleCreateMonitor);

  // Filter tabs
  document.querySelectorAll(".filter-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".filter-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      activeFilter = tab.getAttribute("data-filter");
      renderMonitors();
    });
  });

  // Search input
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      renderMonitors();
    });
  }

  // Auth form submissions
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("authEmail").value;
      const pass = document.getElementById("authPassword").value;
      try {
        await loginUser(email, pass);
      } catch (err) {
        alert("Login failed: " + err.message);
      }
    });
  }

  const registerBtn = document.getElementById("switchToRegisterBtn");
  if (registerBtn) {
    registerBtn.addEventListener("click", async () => {
      const name = prompt("Enter your Name:");
      if (!name) return;
      const email = document.getElementById("authEmail").value;
      const pass = document.getElementById("authPassword").value;
      if (!email || !pass) {
        alert("Please enter email and password first");
        return;
      }
      try {
        await registerUser(name, email, pass);
      } catch (err) {
        alert("Registration failed: " + err.message);
      }
    });
  }

  // Initial auth session check
  checkAuthSession();

  // Auto-refresh dashboard data every 15 seconds
  autoRefreshTimer = setInterval(() => {
    if (authToken) {
      loadDashboard();
    }
  }, 15000);
});
