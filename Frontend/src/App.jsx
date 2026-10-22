import React, { useState, useEffect, useCallback } from "react";
import Navbar from "./components/Navbar.jsx";
import KpiCards from "./components/KpiCards.jsx";
import MonitorCard from "./components/MonitorCard.jsx";
import AddMonitorModal from "./components/AddMonitorModal.jsx";
import AnalyticsModal from "./components/AnalyticsModal.jsx";
import AuthModal from "./components/AuthModal.jsx";
import { authAPI, monitorAPI, setAuthToken, getAuthToken } from "./services/api.js";
import { Plus, Zap, Search } from "lucide-react";
import { MotionDiv, variants } from "./motion";

export default function App() {
  const [user, setUser] = useState(null);
  const [monitors, setMonitors] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [checkingIds, setCheckingIds] = useState(new Set());

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [selectedAnalytics, setSelectedAnalytics] = useState(null);

  // Load monitors
  const loadMonitors = useCallback(async () => {
    if (!getAuthToken()) return;
    try {
      const res = await monitorAPI.getMonitors();
      setMonitors(res.data || []);
    } catch (err) {
      console.warn("Failed to load monitors:", err.message);
    }
  }, []);

  // Check auth session
  useEffect(() => {
    const checkSession = async () => {
      const token = getAuthToken();
      if (!token) return;

      try {
        const res = await authAPI.getCurrentUser();
        setUser(res.data);
        await loadMonitors();
      } catch {
        setUser(null);
        setAuthToken(null);
      }
    };

    checkSession();
  }, [loadMonitors]);

  // Periodic polling / auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (getAuthToken()) {
        loadMonitors();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [loadMonitors]);

  // Actions
  const handleLogin = async (email, password) => {
    const res = await authAPI.login(email, password);
    setAuthToken(res.data.accessToken);
    setUser(res.data.user);
    await loadMonitors();
  };

  const handleRegister = async (name, email, password) => {
    const res = await authAPI.register(name, email, password);
    setAuthToken(res.data.accessToken);
    setUser(res.data.user);
    await loadMonitors();
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch {}
    setAuthToken(null);
    setUser(null);
    setMonitors([]);
  };

  // 1-Click quick demo session
  const handleQuickDemo = async () => {
    const randomId = Math.floor(Math.random() * 10000);
    const demoEmail = `dev_${randomId}@sentinel.dev`;
    const demoPass = "Test@123456";

    try {
      const res = await authAPI.register("Developer Demo", demoEmail, demoPass);
      setAuthToken(res.data.accessToken);
      setUser(res.data.user);

      // Add default sample endpoints
      const samples = [
        { name: "GitHub API Status", url: "https://api.github.com/zen", intervalSeconds: 60 },
        { name: "Cloudflare DNS Status", url: "https://1.1.1.1", intervalSeconds: 60 },
        { name: "JSONPlaceholder Test API", url: "https://jsonplaceholder.typicode.com/posts/1", intervalSeconds: 60 },
      ];

      for (const s of samples) {
        try {
          await monitorAPI.createMonitor(s.name, s.url, s.intervalSeconds);
        } catch (e) {
          console.warn("Sample add warning:", e.message);
        }
      }

      await loadMonitors();
    } catch (err) {
      alert("Quick demo failed: " + err.message);
    }
  };

  // Add Monitor
  const handleAddMonitor = async (name, url, intervalSeconds) => {
    await monitorAPI.createMonitor(name, url, intervalSeconds);
    await loadMonitors();
  };

  // Trigger Instant Manual Check
  const handleCheckNow = async (id) => {
    if (checkingIds.has(id)) return;
    setCheckingIds((prev) => new Set(prev).add(id));

    try {
      const res = await monitorAPI.triggerCheck(id);
      // Update locally
      setMonitors((prev) =>
        prev.map((m) =>
          m.id === id
            ? {
                ...m,
                last_status: res.data.status,
                last_status_code: res.data.check?.status_code,
                last_response_time: res.data.check?.response_time,
                last_checked_at: res.data.check?.checked_at,
              }
            : m
        )
      );

      // If analytics modal is currently open for this monitor, update its metrics
      if (selectedAnalytics && selectedAnalytics.monitor.id === id) {
        const updatedMetrics = await monitorAPI.getMetrics(id);
        setSelectedAnalytics(updatedMetrics.data);
      }
    } catch (err) {
      alert("Health check failed: " + err.message);
    } finally {
      setCheckingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // View Analytics
  const handleViewAnalytics = async (id) => {
    try {
      const res = await monitorAPI.getMetrics(id, 24);
      setSelectedAnalytics(res.data);
    } catch (err) {
      alert("Failed to load historical analytics: " + err.message);
    }
  };

  // Toggle Active
  const handleToggleActive = async (id) => {
    try {
      const res = await monitorAPI.toggleMonitor(id);
      setMonitors((prev) =>
        prev.map((m) => (m.id === id ? { ...m, is_active: res.data.is_active } : m))
      );
    } catch (err) {
      alert("Failed to toggle monitor: " + err.message);
    }
  };

  // Delete Monitor
  const handleDelete = async (id, name) => {
    if (!confirm(`Delete monitor "${name}" and all historical data?`)) return;
    try {
      await monitorAPI.deleteMonitor(id);
      setMonitors((prev) => prev.filter((m) => m.id !== id));
      if (selectedAnalytics && selectedAnalytics.monitor.id === id) {
        setSelectedAnalytics(null);
      }
    } catch (err) {
      alert("Failed to delete monitor: " + err.message);
    }
  };

  // Filter & Search
  let filteredMonitors = monitors.filter((m) => {
    if (activeFilter === "up") return m.is_active && m.last_status === "up";
    if (activeFilter === "down") return m.is_active && m.last_status === "down";
    if (activeFilter === "paused") return !m.is_active;
    return true;
  });

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filteredMonitors = filteredMonitors.filter(
      (m) => m.name.toLowerCase().includes(q) || m.url.toLowerCase().includes(q)
    );
  }

  return (
    <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Navbar
        user={user}
        onOpenAddModal={() => {
          if (!user) {
            setIsAuthOpen(true);
          } else {
            setIsAddOpen(true);
          }
        }}
        onOpenAuthModal={() => setIsAuthOpen(true)}
        onQuickDemo={handleQuickDemo}
        onLogout={handleLogout}
      />

      <main className="main-container">
        {/* KPI Cards */}
        <KpiCards monitors={monitors} />

        {/* Controls Bar */}
        <section className="controls-bar">
          <div className="filter-tabs">
            <button
              className={`filter-tab ${activeFilter === "all" ? "active" : ""}`}
              onClick={() => setActiveFilter("all")}
            >
              All APIs ({monitors.length})
            </button>
            <button
              className={`filter-tab ${activeFilter === "up" ? "active" : ""}`}
              onClick={() => setActiveFilter("up")}
            >
              🟢 Operational
            </button>
            <button
              className={`filter-tab ${activeFilter === "down" ? "active" : ""}`}
              onClick={() => setActiveFilter("down")}
            >
              🔴 Failing
            </button>
            <button
              className={`filter-tab ${activeFilter === "paused" ? "active" : ""}`}
              onClick={() => setActiveFilter("paused")}
            >
              ⏸️ Paused
            </button>
          </div>

          <div style={{ position: "relative" }}>
            <Search
              size={15}
              color="var(--text-muted)"
              style={{ position: "absolute", left: "12px", top: "11px", pointerEvents: "none" }}
            />
            <input
              type="text"
              className="search-input"
              style={{ paddingLeft: "34px" }}
              placeholder="Search by name or URL..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </section>

        {/* Monitors Grid */}
        <section className="monitors-grid">
          {filteredMonitors.length === 0 ? (
            <div className="empty-state">
              <h3 style={{ fontSize: "18px", marginBottom: "8px" }}>
                {monitors.length === 0 ? "No APIs Monitored Yet" : "No APIs match current filter"}
              </h3>
              <p
                style={{
                  color: "var(--text-secondary)",
                  marginBottom: "20px",
                  maxWidth: "440px",
                  marginInline: "auto",
                }}
              >
                {monitors.length === 0
                  ? "Add your first API URL to start tracking latency, uptime percentage, and automated failure detection alerts!"
                  : `Try switching filter tabs or clearing your search.`}
              </p>
              <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                <button
                  className="btn btn-primary"
                  onClick={() => (user ? setIsAddOpen(true) : setIsAuthOpen(true))}
                >
                  <Plus size={16} />
                  Add New API
                </button>
                {!user && (
                  <button className="btn btn-secondary" onClick={handleQuickDemo}>
                    <Zap size={14} color="#f59e0b" />
                    Load Sample APIs
                  </button>
                )}
              </div>
            </div>
          ) : (
            <MotionDiv
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, staggerChildren: 0.05 }}
            >
              {filteredMonitors.map((m) => (
                <MotionDiv key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <MonitorCard
                    key={m.id}
                    monitor={m}
                    isChecking={checkingIds.has(m.id)}
                    onCheckNow={handleCheckNow}
                    onViewAnalytics={handleViewAnalytics}
                    onToggleActive={handleToggleActive}
                    onDelete={handleDelete}
                  />
                </MotionDiv>
              ))}
            </MotionDiv>
          )}
        </section>
      </main>

      {/* Add Monitor Modal */}
      <AddMonitorModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onAdd={handleAddMonitor}
      />

      {/* Analytics & Performance Modal */}
      <AnalyticsModal
        isOpen={!!selectedAnalytics}
        onClose={() => setSelectedAnalytics(null)}
        data={selectedAnalytics}
        onTriggerCheck={handleCheckNow}
        isChecking={selectedAnalytics && checkingIds.has(selectedAnalytics.monitor.id)}
      />

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onQuickDemo={handleQuickDemo}
      />
    </MotionDiv>
  );
}