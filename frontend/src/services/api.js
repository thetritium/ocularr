import axios from 'axios';

// Use environment variable or fallback to relative path
const API_BASE_URL = process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api` : '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: false
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

// Handle auth errors
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Only redirect to login if we're not already on the login page
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login') && !currentPath.includes('/register')) {
        localStorage.removeItem('ocularr_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Error handler function
export const handleApiError = (error, fallbackMessage = 'An error occurred') => {
  if (error.response) {
    return error.response.data.error || error.response.data.message || fallbackMessage;
  } else if (error.request) {
    return 'No response from server. Please check your connection.';
  } else {
    return error.message || fallbackMessage;
  }
};

// Auth API methods
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (identifier, password) => api.post('/auth/login', { 
    username: identifier, // Backend accepts either username or email in the username field
    password 
  }),
  getMe: () => api.get('/auth/me'),
  refresh: () => api.post('/auth/refresh')
};

// User API methods  
export const userAPI = {
  getProfile: (userId) => api.get(`/users/profile/${userId}`),
  getProfileByUsername: (username) => api.get(`/users/profile/by-username/${username}`),
  updateProfile: (data) => {
    if (data instanceof FormData) {
      return api.put('/users/profile', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }
    return api.put('/users/profile', data);
  },
  uploadProfilePicture: (formData) => api.put('/users/profile', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getFavorites: () => api.get('/users/favorites'),
  addFavorite: (movie) => api.post('/users/favorites', movie),
  removeFavorite: (tmdbId) => api.delete(`/users/favorites/${tmdbId}`),
  getWatchlist: () => api.get('/users/watchlist'),
  addToWatchlist: (movie) => api.post('/users/watchlist', movie),
  removeFromWatchlist: (tmdbId) => api.delete(`/users/watchlist/${tmdbId}`),
  markAsWatched: (tmdbId) => api.put(`/users/watchlist/${tmdbId}/watched`),
  getHistory: (userId, params) => api.get(`/users/history/${userId}`, { params })
};

// Club API methods
export const clubAPI = {
  getUserClubs: () => api.get('/clubs'),
  getPublicClubs: (params) => api.get('/clubs/public', { params }),
  getClubById: (id) => api.get(`/clubs/${id}`),
  getClubByName: (clubname) => api.get(`/clubs/by-name/${clubname}`),
  createClub: (formData) => {
    const config = formData instanceof FormData 
      ? { headers: { 'Content-Type': 'multipart/form-data' } }
      : {};
    return api.post('/clubs', formData, config);
  },
  updateClub: (id, formData) => {
    const config = formData instanceof FormData
      ? { headers: { 'Content-Type': 'multipart/form-data' } }
      : {};
    return api.put(`/clubs/${id}`, formData, config);
  },
  joinClub: (inviteCode, password) => {
    const data = { inviteCode };
    if (password) data.password = password;
    return api.post('/clubs/join', data);
  },
  leaveClub: (id) => api.post(`/clubs/${id}/leave`),
  getMembers: (id) => api.get(`/clubs/${id}/members`),
  updateMemberRole: (clubId, userId, role) => api.put(`/clubs/${clubId}/members/${userId}/role`, { role }),
  removeMember: (clubId, userId) => api.delete(`/clubs/${clubId}/members/${userId}`),
  getThemes: (id) => api.get(`/clubs/${id}/themes`),
  addTheme: (id, themeText) => api.post(`/clubs/${id}/themes`, { themeText })
};

// Cycle API methods
export const cycleAPI = {
  startCycle: (clubId) => api.post(`/cycles/${clubId}/start`),
  getCurrentCycle: (clubId) => api.get(`/cycles/${clubId}/current`),
  getCycleDetails: (cycleId) => api.get(`/cycles/${cycleId}`),
  progressPhase: (cycleId, action = 'next') => api.put(`/cycles/${cycleId}/phase`, { action }),
  nominate: (cycleId, movie) => api.post(`/cycles/${cycleId}/nominate`, movie),
  updateWatchProgress: (cycleId, movieId, data = { watched: true }) => api.put(`/cycles/${cycleId}/watch/${movieId}`, data),
  submitRankings: (cycleId, data) => api.post(`/cycles/${cycleId}/submit-rankings`, data),
  getCycleHistory: (clubId, params) => api.get(`/cycles/${clubId}/history`, { params }),
  getCycleResults: (cycleId) => api.get(`/cycles/${cycleId}/results`)
};

// TMDB API methods
export const tmdbAPI = {
  searchMovies: (query) => api.get('/tmdb/search/movie', { params: { query } }),
  getMovieDetails: (id) => api.get(`/tmdb/movie/${id}`)
};

// Export default api instance for backward compatibility
export default api;