import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth
export const login = (username, password) =>
  api.post('/auth/login', { username, password });

export const logout = () =>
  api.post('/auth/logout');

export const getCurrentUser = () =>
  api.get('/auth/me');

export const changePassword = (currentPassword, newPassword) =>
  api.post('/auth/change-password', { currentPassword, newPassword });

// Certificates
export const getCertificates = () =>
  api.get('/certificates');

export const getCertificate = (id) =>
  api.get(`/certificates/${id}`);

export const createCertificate = (data) =>
  api.post('/certificates', data);

export const updateCertificate = (id, data) =>
  api.put(`/certificates/${id}`, data);

export const deleteCertificate = (id) =>
  api.delete(`/certificates/${id}`);

export const testWebhook = (webhook_url) =>
  api.post('/certificates/test-webhook', { webhook_url });

// Results
export const getResults = (filters = {}) =>
  api.get('/results', { params: filters });

export const getLatestResults = () =>
  api.get('/results/latest');

export const getDashboardStats = () =>
  api.get('/dashboard-stats');

// Users
export const getUsers = () =>
  api.get('/users');

export const createUser = (data) =>
  api.post('/users', data);

export const deleteUser = (id) =>
  api.delete(`/users/${id}`);

// Settings
export const getSettings = () =>
  api.get('/settings');

export const updateSetting = (key, value) =>
  api.put(`/settings/${key}`, { value });

export const getEnvironments = () =>
  api.get('/settings/environments');

// Alert Logs (Audit Trail)
export const getAlertLogs = (filters = {}) =>
  api.get('/alerts', { params: filters });

export const getCertificateAlerts = (id, limit = 50) =>
  api.get(`/certificates/${id}/alerts`, { params: { limit } });

export const getAlertStats = () =>
  api.get('/alerts/stats');

// Database Tools (Admin Only)
export const getDatabaseSchema = () =>
  api.get('/database/schema');

export const executeQuery = (sql) =>
  api.post('/database/query', { sql });

export default api;
