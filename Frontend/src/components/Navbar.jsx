import React, { useState } from "react";
import { Activity, Plus, Zap, LogOut, User, BellRing, CheckCircle2 } from "lucide-react";
import { monitorAPI } from "../services/api.js";

export default function Navbar({
  user,
  onOpenAddModal,
  onOpenAuthModal,
  onQuickDemo,
  onLogout,
}) {
  const [isSendingAlert, setIsSendingAlert] = useState(false);
  const [alertSuccess, setAlertSuccess] = useState(false);

  const handleTestAlert = async () => {
    if (isSendingAlert) return;
    setIsSendingAlert(true);
    setAlertSuccess(false);
    try {
      await monitorAPI.testAlert(user?.email);
      setAlertSuccess(true);
      setTimeout(() => setAlertSuccess(false), 4000);
    } catch (err) {
      alert("Failed to dispatch test alert: " + (err.message || "Unknown error"));
    } finally {
      setIsSendingAlert(false);
    }
  };

  return (
    <header className="navbar">
      <div className="nav-container">
        <div className="brand">
          <div className="logo-icon">
            <Activity size={22} strokeWidth={2.5} />
          </div>
          <div>
            <div className="brand-title">API Sentinel</div>
          </div>
          <span className="brand-tag">BULLMQ WORKERS</span>
        </div>

        <div className="nav-actions">
          <button className="btn btn-primary" onClick={onOpenAddModal}>
            <Plus size={16} strokeWidth={2.5} />
            Add API URL
          </button>

          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleTestAlert}
                disabled={isSendingAlert}
                title={`Send a test outage alert email to ${user.email}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  borderColor: alertSuccess ? "var(--emerald-500, #10b981)" : undefined,
                }}
              >
                {alertSuccess ? (
                  <>
                    <CheckCircle2 size={14} color="#10b981" />
                    <span>Alert Sent!</span>
                  </>
                ) : (
                  <>
                    <BellRing size={14} color="#f43f5e" />
                    <span>{isSendingAlert ? "Sending..." : "Test Alert"}</span>
                  </>
                )}
              </button>

              <div className="pulse-indicator">
                <span className="pulse-dot"></span>
                <span>{user.name || user.email}</span>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={onLogout}
                title="Log Out"
              >
                <LogOut size={14} />
                Logout
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={onQuickDemo}
                title="Create a quick demo session"
              >
                <Zap size={14} color="#f59e0b" />
                1-Click Demo
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={onOpenAuthModal}
              >
                <User size={14} />
                Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
