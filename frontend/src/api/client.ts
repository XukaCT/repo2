import axios from 'axios';

const apiClient = axios.create({
  // Frappe's universal API entry point
  baseURL: '/api/method/',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  // Crucial for Frappe's cookie-based session auth
  withCredentials: true
});

// Interceptor to attach the Frappe CSRF token securely
apiClient.interceptors.request.use((config) => {
    if (config.method !== 'get' && typeof window !== 'undefined' && (window as any).csrf_token) {
        config.headers['X-Frappe-CSRF-Token'] = (window as any).csrf_token;
    }
    return config;
});

export default apiClient;