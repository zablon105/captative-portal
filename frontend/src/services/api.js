import axios from "axios";

const api = axios.create({ baseURL: "/api" });

// ---- auth storage helpers ----
export const getToken = () => localStorage.getItem("token");
export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};
export const setAuth = ({ token, user }) => {
  if (token) localStorage.setItem("token", token);
  if (user) localStorage.setItem("user", JSON.stringify(user));
};
export const clearAuth = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Token ${token}`;
  return config;
});

// Turn a DRF error response into one readable message
export const errorMessage = (error) => {
  const data = error.response?.data;
  if (!data) return "Network error. Is the backend server running?";
  if (typeof data === "string") return data;
  if (data.detail) return data.detail;
  if (data.message) return data.message;
  const first = Object.values(data)[0];
  return Array.isArray(first) ? first[0] : String(first);
};

// ---- endpoints ----
export const login = (phone, password) =>
  api.post("/accounts/login/", { phone, password }).then((r) => r.data);

export const register = (phone, password, name) =>
  api.post("/accounts/register/", { phone, password, name }).then((r) => r.data);

export const getPackages = () => api.get("/packages/").then((r) => r.data);

export const initiatePayment = (package_id, phone) =>
  api.post("/payments/initiate/", { package_id, phone }).then((r) => r.data);

export const getPaymentStatus = (id) =>
  api.get(`/payments/${id}/status/`).then((r) => r.data);

export const verifyMpesaSms = (sms, package_id, phone) =>
  api.post("/payments/verify-sms/", { sms, package_id, phone }).then((r) => r.data);

export const getCurrentSession = (phone, mac) =>
  api.get("/hotspot/session/", { params: { phone, mac } }).then((r) => r.data);

export const bindSmartTv = (mac_address, code) =>
  api.post("/hotspot/smart-tv/", { mac_address, code }).then((r) => r.data);

export const activateVoucher = (voucher_code, phone) =>
  api.post("/hotspot/voucher/", { voucher_code, phone }).then((r) => r.data);

export const quickReconnect = (query) =>
  api.post("/hotspot/reconnect/", { query }).then((r) => r.data);

export const troubleshootNetwork = (mac) =>
  api.post("/hotspot/troubleshoot/", { mac }).then((r) => r.data);

export default api;
