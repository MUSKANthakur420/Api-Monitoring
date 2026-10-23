import React, { useState } from "react";
import { Activity, Plus, Zap, LogOut, User, BellRing, CheckCircle2, AlertTriangle, ExternalLink, X, Mail } from "lucide-react";
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
  const [alertModal, setAlertModal] = useState(null); // { type, previewUrl, message, error, recipient }

  const handleTestAlert = async (type = "down", preferEthereal = false) => {
    if (isSendingAlert) return;
    setIsSendingAlert(true);
    setAlertSuccess(false);

    try {
      const res = await monitorAPI.testAlert(user?.email, type, preferEthereal);
      const data = res?.data || {};

      setAlertSuccess(true);
      setAlertModal({
        success: true,
        type: data.type || "simulated",
        previewUrl: data.previewUrl || null,
        message: res?.message || "Test alert dispatched successfully",
        recipient: user?.email,
        fallbackUsed: data.fallbackUsed || false,
        smtpError: data.smtpError || null,
        alertType: type,
      });

      setTimeout(() => setAlertSuccess(false), 5000);
    } catch (err) {
      setAlertModal({
        success: false,
        error: err.message || "Unknown error dispatching alert",
        recipient: user?.email,
      });
    } finally {
      setIsSendingAlert(false);
    }
  };

  return (
    <>
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
                  onClick={() => handleTestAlert("down", false)}
                  disabled={isSendingAlert}
                  title={`Send a test outage alert to ${user.email}`}
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

      {/* Alert Diagnostics & Preview Modal */}
      {alertModal && (
        <div className="modal-overlay" style={{ zIndex: 100 }}>
          <div className="modal-content" style={{ maxWidth: "560px" }}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {alertModal.success ? (
                  <CheckCircle2 size={20} color="#10b981" />
                ) : (
                  <AlertTriangle size={20} color="#f43f5e" />
                )}
                <h3 style={{ margin: 0, fontSize: "17px" }}>
                  {alertModal.success ? "Alert Notification Dispatched" : "Alert Dispatch Failed"}
                </h3>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setAlertModal(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body" style={{ fontSize: "14px", lineHeight: "1.6" }}>
              {alertModal.success ? (
                <>
                  <div
                    style={{
                      background: alertModal.type === "smtp" ? "rgba(16, 185, 129, 0.1)" : "rgba(59, 130, 246, 0.1)",
                      border: `1px solid ${alertModal.type === "smtp" ? "rgba(16, 185, 129, 0.3)" : "rgba(59, 130, 246, 0.3)"}`,
                      borderRadius: "8px",
                      padding: "14px",
                      marginBottom: "16px",
                    }}
                  >
                    <div style={{ fontWeight: 600, color: alertModal.type === "smtp" ? "#10b981" : "#60a5fa", marginBottom: "4px" }}>
                      {alertModal.type === "smtp"
                        ? "📬 Real SMTP Delivery"
                        : alertModal.type === "ethereal"
                        ? "🧪 Ethereal Test Server (Preview Available)"
                        : "ℹ️ Simulated Logger"}
                    </div>
                    <div style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                      Target Recipient: <strong>{alertModal.recipient}</strong>
                    </div>
                  </div>

                  {alertModal.fallbackUsed && (
                    <div
                      style={{
                        background: "rgba(245, 158, 11, 0.1)",
                        border: "1px solid rgba(245, 158, 11, 0.3)",
                        color: "#fbbf24",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        fontSize: "12.5px",
                        marginBottom: "16px",
                      }}
                    >
                      ⚠️ <strong>SMTP Note:</strong> Real SMTP failed ({alertModal.smtpError}). Automatically fell back to Ethereal mock inbox so you can still view the generated email.
                    </div>
                  )}

                  {alertModal.previewUrl && (
                    <div
                      style={{
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                        borderRadius: "10px",
                        padding: "16px",
                        textAlign: "center",
                        marginBottom: "18px",
                      }}
                    >
                      <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "12px" }}>
                        An exact copy of the formatted HTML outage email was generated on the Ethereal mail server:
                      </div>
                      <a
                        href={alertModal.previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          textDecoration: "none",
                          fontWeight: 600,
                        }}
                      >
                        <ExternalLink size={16} />
                        Open Live HTML Email Preview ↗
                      </a>
                    </div>
                  )}

                  <div
                    style={{
                      background: "rgba(15, 23, 42, 0.6)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      padding: "14px",
                      fontSize: "12.5px",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "6px" }}>
                      💡 Want emails delivered directly to your real Gmail inbox?
                    </div>
                    <ol style={{ margin: 0, paddingLeft: "18px", lineHeight: "1.5" }}>
                      <li>Ensure 2-Step Verification is ON in your Google Account.</li>
                      <li>
                        Create an App Password at{" "}
                        <a
                          href="https://myaccount.google.com/apppasswords"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "#60a5fa" }}
                        >
                          Google App Passwords
                        </a>.
                      </li>
                      <li>
                        Set in <code style={{ color: "#38bdf8" }}>Backend/.env</code> (or Render environment variables):
                        <br />
                        <code style={{ color: "#34d399", fontSize: "11.5px" }}>
                          SMTP_USER=your_email@gmail.com
                          <br />
                          SMTP_PASS=xxxx xxxx xxxx xxxx
                        </code>
                      </li>
                    </ol>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    background: "rgba(244, 63, 94, 0.1)",
                    border: "1px solid rgba(244, 63, 94, 0.3)",
                    color: "var(--rose-400)",
                    padding: "14px",
                    borderRadius: "8px",
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: "6px" }}>Error Details:</div>
                  <div>{alertModal.error}</div>
                </div>
              )}

              <div style={{ marginTop: "20px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleTestAlert("down", false)}
                  disabled={isSendingAlert}
                >
                  <BellRing size={14} color="#f43f5e" />
                  Test Down Alert
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleTestAlert("recovery", false)}
                  disabled={isSendingAlert}
                >
                  <CheckCircle2 size={14} color="#10b981" />
                  Test Recovery Alert
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleTestAlert("down", true)}
                  disabled={isSendingAlert}
                >
                  <Mail size={14} color="#60a5fa" />
                  Preview with Ethereal
                </button>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setAlertModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
