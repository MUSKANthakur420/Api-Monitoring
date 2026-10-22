import React from "react";
import { Server, CheckCircle2, AlertTriangle, Clock, ShieldCheck } from "lucide-react";

export default function KpiCards({ monitors = [] }) {
  const total = monitors.length;
  const up = monitors.filter((m) => m.is_active && m.last_status === "up").length;
  const down = monitors.filter((m) => m.is_active && m.last_status === "down").length;

  const monitorsWithLatency = monitors.filter((m) => Number(m.last_response_time) > 0);
  const avgLatency =
    monitorsWithLatency.length > 0
      ? Math.round(
          monitorsWithLatency.reduce((acc, m) => acc + Number(m.last_response_time), 0) /
            monitorsWithLatency.length
        )
      : 0;

  const avgUptime =
    total > 0
      ? (
          monitors.reduce((acc, m) => acc + (parseFloat(m.uptime_percentage) || 100), 0) /
          total
        ).toFixed(1)
      : "100.0";

  return (
    <section className="kpi-grid">
      <div className="kpi-card">
        <div className="kpi-title">
          <span>TOTAL MONITORS</span>
          <Server size={18} color="#94a3b8" />
        </div>
        <div className="kpi-value">{total}</div>
        <div className="kpi-subtitle">Configured API endpoints</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-title">
          <span>OPERATIONAL (UP)</span>
          <CheckCircle2 size={18} color="#10b981" />
        </div>
        <div className="kpi-value" style={{ color: "var(--emerald-400)" }}>
          {up}
        </div>
        <div className="kpi-subtitle">Passing automated health checks</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-title">
          <span>FAILURES (DOWN)</span>
          <AlertTriangle size={18} color="#f43f5e" />
        </div>
        <div className="kpi-value" style={{ color: "var(--rose-400)" }}>
          {down}
        </div>
        <div className="kpi-subtitle">Email alert sent on failure detection</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-title">
          <span>AVG RESPONSE TIME</span>
          <Clock size={18} color="#94a3b8" />
        </div>
        <div className="kpi-value">{avgLatency ? `${avgLatency} ms` : "—"}</div>
        <div className="kpi-subtitle">Global average latency</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-title">
          <span>OVERALL UPTIME</span>
          <ShieldCheck size={18} color="#10b981" />
        </div>
        <div className="kpi-value" style={{ color: "var(--emerald-400)" }}>
          {avgUptime}%
        </div>
        <div className="kpi-subtitle">Last 24 hours uptime</div>
      </div>
    </section>
  );
}
