import React from "react";
import { Zap, BarChart3, Pause, Play, Trash2, Clock, CheckCircle2, AlertCircle } from "lucide-react";

export default function MonitorCard({
  monitor,
  isChecking,
  onCheckNow,
  onViewAnalytics,
  onToggleActive,
  onDelete,
}) {
  const statusClass = !monitor.is_active
    ? "paused"
    : monitor.last_status || "pending";
  const statusText = !monitor.is_active
    ? "PAUSED"
    : (monitor.last_status || "PENDING").toUpperCase();

  const latency = monitor.last_response_time
    ? `${monitor.last_response_time} ms`
    : "Pending";
  const uptime = monitor.uptime_percentage
    ? `${parseFloat(monitor.uptime_percentage).toFixed(1)}%`
    : "100%";
  const lastCheck = monitor.last_checked_at
    ? formatRelativeTime(monitor.last_checked_at)
    : "Never checked";

  const latencyColor =
    Number(monitor.last_response_time) > 800
      ? "var(--rose-400)"
      : Number(monitor.last_response_time) > 300
      ? "var(--amber-400)"
      : "var(--emerald-400)";

  return (
    <div className="monitor-card">
      <div>
        <span className={`status-badge ${statusClass}`}>
          <span
            className="pulse-dot"
            style={{
              backgroundColor:
                !monitor.is_active
                  ? "#64748b"
                  : statusClass === "down"
                  ? "#f43f5e"
                  : "#10b981",
              boxShadow:
                !monitor.is_active
                  ? "none"
                  : statusClass === "down"
                  ? "0 0 8px #f43f5e"
                  : "0 0 8px #10b981",
            }}
          />
          {statusText}
        </span>
      </div>

      <div className="monitor-info">
        <div className="monitor-name">
          <span>{monitor.name}</span>
          <span
            style={{
              fontSize: "11px",
              padding: "2px 6px",
              background: "#1c253b",
              color: "var(--text-muted)",
              borderRadius: "4px",
            }}
          >
            Every {monitor.interval_seconds || 60}s
          </span>
        </div>
        <div className="monitor-url" title={monitor.url}>
          {monitor.url}
        </div>
      </div>

      <div className="monitor-metrics-pill">
        <div className="metric-box">
          <span className="label">Latency</span>
          <span className="value" style={{ color: latencyColor }}>
            {latency}
          </span>
        </div>
        <div className="metric-box">
          <span className="label">24h Uptime</span>
          <span className="value">{uptime}</span>
        </div>
        <div className="metric-box">
          <span className="label">Last Check</span>
          <span
            className="value"
            style={{
              fontSize: "12px",
              fontWeight: "normal",
              color: "var(--text-secondary)",
            }}
          >
            {lastCheck}
          </span>
        </div>
      </div>

      <div className="action-group">
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onCheckNow(monitor.id)}
          disabled={isChecking}
          title="Run instant health check"
        >
          <Zap size={14} color="#f59e0b" />
          {isChecking ? "Checking..." : "Check Now"}
        </button>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onViewAnalytics(monitor.id)}
          title="View historical performance & charts"
        >
          <BarChart3 size={14} />
          Analytics
        </button>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onToggleActive(monitor.id)}
          title={monitor.is_active ? "Pause monitoring" : "Resume monitoring"}
        >
          {monitor.is_active ? <Pause size={14} /> : <Play size={14} />}
        </button>

        <button
          className="btn btn-danger btn-sm"
          onClick={() => onDelete(monitor.id, monitor.name)}
          title="Delete monitor"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

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
