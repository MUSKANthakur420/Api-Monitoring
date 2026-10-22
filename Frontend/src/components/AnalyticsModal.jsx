
import React from "react";
import { X, Zap, AlertOctagon, CheckCircle2 } from "lucide-react";

export default function AnalyticsModal({
  isOpen,
  onClose,
  data,
  onTriggerCheck,
  isChecking,
}) {
  if (!isOpen || !data) return null;

  const { monitor, metrics, timeline = [], incidents = [] } = data;

  const uptime = metrics?.uptime_percentage
    ? `${parseFloat(metrics.uptime_percentage).toFixed(2)}%`
    : "100.00%";
  const avgLatency = metrics?.avg_response_time ? `${metrics.avg_response_time} ms` : "0 ms";
  const minLatency = metrics?.min_response_time ? `${metrics.min_response_time} ms` : "0 ms";
  const maxLatency = metrics?.max_response_time ? `${metrics.max_response_time} ms` : "0 ms";
  const totalChecks = metrics?.total_checks || 0;
  const downChecks = metrics?.down_checks || 0;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: "780px" }}>
        <div className="modal-header">
          <h3>Historical Performance & Latency Analytics</h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {/* Header Info */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "20px",
            }}
          >
            <div>
              <h2 style={{ fontSize: "20px", fontWeight: "800" }}>{monitor.name}</h2>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "13px",
                  color: "var(--text-secondary)",
                  marginTop: "4px",
                }}
              >
                {monitor.url}
              </div>
            </div>

            <div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => onTriggerCheck(monitor.id)}
                disabled={isChecking}
              >
                <Zap size={14} color="#f59e0b" />
                {isChecking ? "Checking..." : "Run Health Check"}
              </button>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "12px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                background: "var(--bg-secondary)",
                padding: "14px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>
                24h Uptime
              </div>
              <div style={{ fontSize: "20px", fontWeight: "800", color: "var(--emerald-400)", marginTop: "4px" }}>
                {uptime}
              </div>
            </div>

            <div
              style={{
                background: "var(--bg-secondary)",
                padding: "14px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>
                Average Latency
              </div>
              <div style={{ fontSize: "20px", fontWeight: "800", color: "var(--text-primary)", marginTop: "4px" }}>
                {avgLatency}
              </div>
            </div>

            <div
              style={{
                background: "var(--bg-secondary)",
                padding: "14px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>
                Min / Max Latency
              </div>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-secondary)", marginTop: "8px" }}>
                {minLatency} / {maxLatency}
              </div>
            </div>

            <div
              style={{
                background: "var(--bg-secondary)",
                padding: "14px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase" }}>
                Checks / Failures
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "700",
                  color: downChecks > 0 ? "var(--rose-400)" : "var(--text-primary)",
                  marginTop: "8px",
                }}
              >
                {totalChecks} checks / {downChecks} down
              </div>
            </div>
          </div>

          {/* Heartbeat Status Bar */}
          <div style={{ marginBottom: "24px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "12px",
                color: "var(--text-secondary)",
                marginBottom: "8px",
              }}
            >
              <span>Recent 50 Health Checks (Oldest ➔ Newest)</span>
              <span style={{ color: "var(--emerald-400)", fontWeight: "600" }}>Operational</span>
            </div>

            <div
              style={{
                display: "flex",
                gap: "4px",
                height: "28px",
                background: "var(--bg-secondary)",
                padding: "4px 6px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                alignItems: "center",
              }}
            >
              {timeline.length === 0 ? (
                Array.from({ length: 40 }).map((_, i) => (
                  <div key={i} className="heartbeat-bar empty" />
                ))
              ) : (
                timeline.slice(-45).map((c, i) => (
                  <div
                    key={c.id || i}
                    className={`heartbeat-bar ${c.is_up ? "" : "down"}`}
                    title={`${c.is_up ? "UP" : "DOWN"} - ${c.response_time}ms (${c.status_code || "ERR"}) - ${new Date(
                      c.checked_at
                    ).toLocaleTimeString()}`}
                  />
                ))
              )}
            </div>
          </div>

          {/* Historical Latency SVG Curve */}
          <div style={{ marginBottom: "24px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <span style={{ fontSize: "13px", fontWeight: "700" }}>Historical Latency (ms)</span>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Last 50 data points</span>
            </div>

            <div className="chart-container">
              <LatencySvgChart timeline={timeline} avgLatency={Number(metrics?.avg_response_time) || 0} />
            </div>
          </div>

          {/* Incidents Log */}
          {incidents && incidents.length > 0 && (
            <div style={{ marginBottom: "24px" }}>
              <h4 style={{ fontSize: "14px", fontWeight: "700", color: "var(--rose-400)", marginBottom: "12px" }}>
                <AlertOctagon size={16} style={{ display: "inline", marginRight: "6px" }} />
                Incident Log
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {incidents.map((inc) => (
                  <div
                    key={inc.id}
                    style={{
                      padding: "10px 14px",
                      background: "rgba(244, 63, 94, 0.08)",
                      border: "1px solid rgba(244, 63, 94, 0.2)",
                      borderRadius: "8px",
                      fontSize: "12.5px",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <strong>{inc.type.toUpperCase()}:</strong> {inc.details || "API Down"}
                      {inc.notified_to && (
                        <span style={{ color: "var(--text-muted)" }}> (Alert sent to {inc.notified_to})</span>
                      )}
                    </div>
                    <div style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                      {new Date(inc.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Check Log Table */}
          <div>
            <h4 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "8px" }}>Detailed Check Logs</h4>
            <div
              style={{
                maxHeight: "220px",
                overflowY: "auto",
                border: "1px solid var(--border)",
                borderRadius: "8px",
              }}
            >
              <table className="logs-table">
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
                  {timeline.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
                        No check logs recorded yet.
                      </td>
                    </tr>
                  ) : (
                    timeline
                      .slice(-20)
                      .reverse()
                      .map((c, i) => (
                        <tr key={c.id || i}>
                          <td>
                            <span
                              className={`status-badge ${c.is_up ? "up" : "down"}`}
                              style={{ fontSize: "10px", padding: "2px 6px" }}
                            >
                              {c.is_up ? "UP" : "DOWN"}
                            </span>
                          </td>
                          <td style={{ fontFamily: "var(--font-mono)" }}>{c.status_code || "—"}</td>
                          <td
                            style={{
                              fontFamily: "var(--font-mono)",
                              color: c.response_time > 500 ? "var(--amber-400)" : "var(--text-primary)",
                            }}
                          >
                            {c.response_time || 0} ms
                          </td>
                          <td style={{ fontSize: "11px" }}>{new Date(c.checked_at).toLocaleTimeString()}</td>
                          <td
                            style={{
                              fontSize: "11px",
                              color: c.is_up ? "var(--text-muted)" : "var(--rose-400)",
                            }}
                          >
                            {c.error_message || "OK"}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function LatencySvgChart({ timeline, avgLatency }) {
  if (!timeline || timeline.length < 2) {
    return (
      <div style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)", fontSize: "13px" }}>
        Collecting health check data points... Please trigger a check or wait 1 minute.
      </div>
    );
  }

  const width = 640;
  const height = 150;
  const padding = 24;

  const latencies = timeline.map((t) => Number(t.response_time) || 0);
  const maxLatency = Math.max(...latencies, avgLatency * 1.5, 100);

  const getX = (idx) => padding + (idx / (timeline.length - 1)) * (width - padding * 2);
  const getY = (val) => height - padding - (val / maxLatency) * (height - padding * 2);

  const points = timeline.map((t, idx) => `${getX(idx)},${getY(t.response_time || 0)}`).join(" ");
  const avgY = getY(avgLatency);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
      <line
        x1={padding}
        y1={height - padding}
        x2={width - padding}
        y2={height - padding}
        stroke="#232d42"
        strokeWidth="1"
      />
      <line
        x1={padding}
        y1={padding}
        x2={width - padding}
        y2={padding}
        stroke="#232d42"
        strokeWidth="1"
        strokeDasharray="3,3"
      />

      <line
        x1={padding}
        y1={avgY}
        x2={width - padding}
        y2={avgY}
        stroke="#3b82f6"
        strokeWidth="1"
        strokeDasharray="4,4"
        opacity="0.6"
      />
      <text x={width - padding + 4} y={avgY + 4} fill="#3b82f6" fontSize="9" fontFamily="monospace">
        Avg: {Math.round(avgLatency)}ms
      </text>

      <text x={padding} y={padding - 6} fill="#64748b" fontSize="9" fontFamily="monospace">
        {Math.round(maxLatency)}ms
      </text>

      <defs>
        <linearGradient id="reactLatencyGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
        </linearGradient>
      </defs>

      <polygon
        points={`${points} ${getX(timeline.length - 1)},${height - padding} ${getX(0)},${height - padding}`}
        fill="url(#reactLatencyGradient)"
      />

      <polyline
        points={points}
        fill="none"
        stroke="#10b981"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {timeline.map((t, idx) => {
        const cx = getX(idx);
        const cy = getY(t.response_time || 0);
        const color = t.is_up ? "#10b981" : "#f43f5e";
        return (
          <circle key={idx} cx={cx} cy={cy} r={t.is_up ? 3 : 5} fill={color} stroke="#0f172a" strokeWidth="1.5">
            <title>
              {t.response_time}ms ({t.status_code || "DOWN"}) at {new Date(t.checked_at).toLocaleTimeString()}
            </title>
          </circle>
        );
      })}
    </svg>
  );
}
