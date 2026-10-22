const API_BASE = "/api/v1";

export const getAuthToken = () => localStorage.getItem("api_monitor_token");
export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem("api_monitor_token", token);
  } else {
    localStorage.removeItem("api_monitor_token");
  }
};

export const apiRequest = async (endpoint, options = {}) => {
  const token = getAuthToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text || `Request failed with status ${res.status}` };
  }

  if (!res.ok) {
    if (res.status === 401) {
      setAuthToken(null);
    }
    throw new Error(data.message || `Request failed (${res.status})`);
  }

  return data;
};

export const authAPI = {
  getCurrentUser: () => apiRequest("/users/me"),
  login: (email, password) =>
    apiRequest("/users/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (name, email, password) =>
    apiRequest("/users/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),
  logout: () => apiRequest("/users/logout", { method: "POST" }),
};

export const monitorAPI = {
  getMonitors: () => apiRequest("/monitors"),
  getSummary: () => apiRequest("/monitors/summary"),
  createMonitor: (name, url, intervalSeconds = 60) =>
    apiRequest("/monitors", {
      method: "POST",
      body: JSON.stringify({ name, url, intervalSeconds }),
    }),
  toggleMonitor: (id) =>
    apiRequest(`/monitors/${id}/toggle`, {
      method: "PATCH",
    }),
  deleteMonitor: (id) =>
    apiRequest(`/monitors/${id}`, {
      method: "DELETE",
    }),
  triggerCheck: (id) =>
    apiRequest(`/monitors/${id}/check`, {
      method: "POST",
    }),
  getMetrics: (id, hours = 24) =>
    apiRequest(`/monitors/${id}/metrics?hours=${hours}`),
  getHistory: (id, limit = 50) =>
    apiRequest(`/monitors/${id}/history?limit=${limit}`),
  testAlert: (email, type = "down") =>
    apiRequest("/monitors/test-alert", {
      method: "POST",
      body: JSON.stringify({ email, type }),
    }),
  getAlertConfig: () => apiRequest("/monitors/alert-config"),
};
