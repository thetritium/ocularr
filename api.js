import axios from 'axios';

// Use environment variable or default to backend port
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

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

// Error handler function
export const handleApiError = (error, defaultMessage = 'An error occurred') => {
  if (error.response) {
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
    if (error.code === 'ECONNABORTED') {
      return 'Request timeout - server is taking too long to respond';
    }
    return 'No response from server - check your connection';
  } else {
    return error.message || defaultMessage;
  }
};

// Auth API methods
const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  getMe: () => api.get('/auth/me'),
};

// User API methods
const userAPI = {
  getProfile: (userId) => api.get(`/users/profile/${userId}`),
  updateProfile: (data) => api.put('/users/profile', data),
  addFavorite: (movieData) => api.post('/users/favorites', movieData),
  removeFavorite: (tmdbId) => api.delete(`/users/favorites/${tmdbId}`),
  addToWatchlist: (movieData) => api.post('/users/watchlist', movieData),
  removeFromWatchlist: (tmdbId) => api.delete(`/users/watchlist/${tmdbId}`),
  markWatched: (tmdbId) => api.put(`/users/watchlist/${tmdbId}/watched`),
};

// Club API methods
const clubAPI = {
  getUserClubs: () => api.get('/clubs'),
  getPublicClubs: (params = {}) => api.get('/clubs/public', { params }),
  getClubById: (clubId) => api.get(`/clubs/${clubId}`),
  getClubByName: (clubname) => api.get(`/clubs/by-name/${clubname}`),
  createClub: (formData) => {
    // Handle both regular data and FormData for file uploads
    const config = {};
    if (formData instanceof FormData) {
      config.headers = { 'Content-Type': 'multipart/form-data' };
    }
    return api.post('/clubs', formData, config);
  },
  joinClub: (inviteCode, password = null) => {
    const data = { inviteCode };
    if (password) data.password = password;
    return api.post('/clubs/join', data);
  },
  updateClub: (clubId, formData) => {
    const config = {};
    if (formData instanceof FormData) {
      config.headers = { 'Content-Type': 'multipart/form-data' };
    }
    return api.put(`/clubs/${clubId}`, formData, config);
  },
  leaveClub: (clubId) => api.post(`/clubs/${clubId}/leave`),
  getMembers: (clubId) => api.get(`/clubs/${clubId}/members`),
  getThemes: (clubId) => api.get(`/clubs/${clubId}/themes`),
  submitTheme: (clubId, themeData) => api.post(`/clubs/${clubId}/themes`, themeData),
  updateMemberRole: (clubId, userId, role) => api.put(`/clubs/${clubId}/members/${userId}/role`, { role }),
  removeMember: (clubId, userId) => api.delete(`/clubs/${clubId}/members/${userId}`),
  getClubStats: (clubId, seasonYear = new Date().getFullYear()) => 
    api.get(`/clubs/${clubId}/stats?seasonYear=${seasonYear}`),
};

// Cycle API methods
const cycleAPI = {
  startCycle: (clubId) => api.post(`/cycles/${clubId}/start`),
  getCurrentCycle: (clubId) => api.get(`/cycles/${clubId}/current`),
  progressPhase: (cycleId, action = 'next') => api.put(`/cycles/${cycleId}/phase`, { action }),
  nominateMovie: (cycleId, movieData) => api.post(`/cycles/${cycleId}/nominate`, movieData),
  updateWatchProgress: (cycleId, movieId, progressData) => 
    api.put(`/cycles/${cycleId}/watch/${movieId}`, progressData),
  submitRankings: (cycleId, rankingsData) => api.post(`/cycles/${cycleId}/submit-rankings`, rankingsData),
  getCycleHistory: (clubId, page = 1, limit = 10) => 
    api.get(`/cycles/${clubId}/history?page=${page}&limit=${limit}`),
  getCycleResults: (cycleId) => api.get(`/cycles/${cycleId}/results`),
};

// TMDB API methods
const tmdbAPI = {
  searchMovies: (query, page = 1) => api.get(`/tmdb/search/movie?query=${encodeURIComponent(query)}&page=${page}`),
  getMovie: (movieId) => api.get(`/tmdb/movie/${movieId}`),
};

// Export the main api instance and all sub-APIs (FIXED - no duplicates)
export default api;
export { clubAPI, authAPI, userAPI, cycleAPI, tmdbAPI };