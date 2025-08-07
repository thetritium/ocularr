import axios from 'axios';

// Use relative path for API calls - nginx will proxy to backend
const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000 // 10 second timeout
});

// Add token to requests
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('ocularr_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Handle auth errors and network issues
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Only clear token and redirect on actual auth failures
      localStorage.removeItem('ocularr_token');
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    } else if (error.code === 'ECONNABORTED') {
      console.error('Request timeout - server may be slow or unreachable');
    } else if (!error.response) {
      console.error('Network error - check server connection');
    }
    return Promise.reject(error);
  }
);

// Error handler function with better error messages
export const handleApiError = (error, defaultMessage = 'An error occurred') => {
  if (error.response) {
    // Server responded with error
    const status = error.response.status;
    const message = error.response.data?.error || error.response.data?.message;
    
    switch (status) {
      case 400:
        return message || 'Invalid request';
      case 401:
        return 'Authentication required';
      case 403:
        return message || 'Access denied';
      case 404:
        return message || 'Not found';
      case 409:
        return message || 'Conflict - resource already exists';
      case 413:
        return 'File too large';
      case 429:
        return 'Too many requests - please wait';
      case 500:
        return 'Server error - please try again';
      case 502:
        return 'Server unavailable - please try again';
      default:
        return message || `Error ${status}`;
    }
  } else if (error.request) {
    // Request made but no response
    if (error.code === 'ECONNABORTED') {
      return 'Request timeout - server is taking too long to respond';
    }
    return 'No response from server - check your connection';
  } else {
    // Request setup error
    return error.message || defaultMessage;
  }
};

// Export the main api instance (for your current components that use api.get(), api.post(), etc.)
export default api;

// Also export named API instances for compatibility with components that expect these
export const clubAPI = api;
export const authAPI = api;
export const userAPI = api;
export const cycleAPI = api;
export const tmdbAPI = api;