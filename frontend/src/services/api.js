import axios from 'axios';

// Use relative path for API calls - nginx will proxy to backend
const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('ocularr_token'); // FIX: Use correct token name
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Handle auth errors
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('ocularr_token'); // FIX: Use correct token name
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Error handler function
export const handleApiError = (error) => {
  if (error.response) {
    // Server responded with error
    return error.response.data.error || 'An error occurred';
  } else if (error.request) {
    // Request made but no response
    return 'No response from server';
  } else {
    // Request setup error
    return error.message || 'An error occurred';
  }
};

// Export all the things your app expects
export default api;
export const clubAPI = api;
export const authAPI = api;
export const userAPI = api;
export const cycleAPI = api;
export const tmdbAPI = api;