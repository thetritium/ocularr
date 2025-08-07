import axios from 'axios';

// Use relative path for API calls - nginx will proxy to backend
// In production builds, REACT_APP_API_URL can be set to full domain
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    // Add cache busting headers
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
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
    
    // CACHE BUSTING: Add timestamp to all requests
    const timestamp = Date.now();
    const separator = config.url?.includes('?') ? '&' : '?';
    config.url += `${separator}_cb=${timestamp}`;
    
    // Add no-cache headers to every request
    config.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    config.headers['Pragma'] = 'no-cache';
    config.headers['Expires'] = '0';
    config.headers['If-Modified-Since'] = '0';
    
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Handle auth errors and network issues
api.interceptors.response.use(
  response => {
    // Add no-cache headers to response handling
    if (response.headers) {
      response.headers['cache-control'] = 'no-cache, no-store, must-revalidate';
    }
    return response;
  },
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
export const handleApiError = (error) => {
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
        return 'Access denied';
      case 404:
        return 'Not found';
      case 409:
        return message || 'Conflict - resource already exists';
      case 413:
        return 'File too large';
      case 429:
        return 'Too many requests - please wait';
      case 500:
        return 'Server error - please try again';
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
    return error.message || 'An error occurred';
  }
};

// Club API methods
export const clubAPI = {
  getUserClubs: () => api.get('/clubs'),
  getClub: (clubId) => api.get(`/clubs/${clubId}`),
  createClub: (clubData) => {
    return api.post('/clubs', clubData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },
  updateClub: (clubId, clubData) => {
    return api.put(`/clubs/${clubId}`, clubData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },
  deleteClub: (clubId) => api.delete(`/clubs/${clubId}`),
  joinClub: (inviteCode, password = null) => api.post('/clubs/join', { inviteCode, password }),
  leaveClub: (clubId) => api.delete(`/clubs/${clubId}/leave`),
  getPublicClubs: (params) => api.get('/clubs/public', { params }),
  getMembers: (clubId) => api.get(`/clubs/${clubId}/members`),
  updateMemberRole: (clubId, userId, role) => api.put(`/clubs/${clubId}/members/${userId}/role`, { role }),
  removeMember: (clubId, userId) => api.delete(`/clubs/${clubId}/members/${userId}`),
  transferOwnership: (clubId, userId) => api.put(`/clubs/${clubId}/transfer`, { userId }),
  getThemes: (clubId) => api.get(`/clubs/${clubId}/themes`),
  submitTheme: (clubId, theme) => api.post(`/clubs/${clubId}/themes`, { theme }),
  getStats: (clubId, season) => api.get(`/clubs/${clubId}/stats${season ? `?season=${season}` : ''}`)
};

// Cycle API methods
export const cycleAPI = {
  getCurrentCycle: (clubId) => api.get(`/cycles/${clubId}/current`),
  startCycle: (clubId) => api.post(`/cycles/${clubId}/start`),
  progressPhase: (cycleId) => api.put(`/cycles/${cycleId}/phase`),
  nominate: (cycleId, movieData) => api.post(`/cycles/${cycleId}/nominate`, movieData),
  markWatched: (cycleId, movieId) => api.put(`/cycles/${cycleId}/watch/${movieId}`),
  submitGuesses: (cycleId, guesses) => api.post(`/cycles/${cycleId}/guesses`, { guesses }),
  submitRankings: (cycleId, rankings) => api.post(`/cycles/${cycleId}/submit-rankings`, { rankings })
};

// Export the base API instance and all method collections
export default api;
export const authAPI = api;
export const userAPI = api;
export const tmdbAPI = api;