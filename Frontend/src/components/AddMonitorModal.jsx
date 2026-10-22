import React, { useState } from "react";
import { X, ShieldCheck } from "lucide-react";

export default function AddMonitorModal({ isOpen, onClose, onAdd }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [interval, setInterval] = useState("60");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || !url.trim()) {
      setError("Please fill in both Name and URL");
      return;
    }

    try {
      setLoading(true);
      await onAdd(name.trim(), url.trim(), Number(interval));
      setName("");
      setUrl("");
      setInterval("60");
      onClose();
    } catch (err) {
      setError(err.message || "Failed to add monitor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Add New API Monitor</h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div
                style={{
                  background: "rgba(244, 63, 94, 0.1)",
                  border: "1px solid rgba(244, 63, 94, 0.3)",
                  color: "var(--rose-400)",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  marginBottom: "16px",
                }}
              >
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">API Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Payment Gateway API, User Service Health"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">API Target URL</label>
              <input
                type="url"
                className="form-input"
                placeholder="https://api.yourdomain.com/health"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
              <div className="form-help">
                <ShieldCheck size={12} style={{ display: "inline", marginRight: "4px" }} />
                SSRF-protected. Only public HTTP/HTTPS endpoints are allowed.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Health Check Frequency</label>
              <select
                className="form-select"
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
              >
                <option value="30">Every 30 seconds</option>
                <option value="60">Every 60 seconds (1 minute)</option>
                <option value="300">Every 5 minutes</option>
                <option value="600">Every 10 minutes</option>
              </select>
              <div className="form-help">
                Background BullMQ worker checks status & measures latency on this schedule.
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Validating & Adding..." : "Start Monitoring"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
