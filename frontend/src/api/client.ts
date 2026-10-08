import axios from 'axios';

// Tell TypeScript about Frappe's global window object
declare global {
  interface Window {
    frappe?: {
      csrf_token?: string;
    };
  }
}

export const apiClient = axios.create({
  baseURL: '/',
  withCredentials: true, 
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

// Intercept every request and inject the Frappe CSRF token
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    // Check both common locations Frappe uses to store the token
    const token = (window as any).frappe?.csrf_token || (window as any).csrf_token;
    
    if (token) {
      config.headers['X-Frappe-CSRF-Token'] = token;
    } else if (config.method !== 'get') {
      console.warn("⚠️ React could not find the Frappe CSRF token. This POST request will likely fail!");
    }
  }
  return config;
});