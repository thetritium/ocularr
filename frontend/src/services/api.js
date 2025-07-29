import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3001/api',
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token to all requests
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage for each request
    const token = localStorage.getItem('ocularr_token');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add timestamp to prevent caching for certain requests
    if (config.method === 'get') {
      config.params = {
        ...config.params,
        _t: Date.now(),
      };
    }
    
    console.log('API Request:', config.method?.toUpperCase(), config.url, 'Token:', !!token); // Debug log
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for global error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.log('API Error:', error.response?.status, error.response?.data); // Debug log
    
    // Handle common error scenarios
    if (error.response?.status === 401) {
      // Unauthorized - redirect to login
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/register') {
        localStorage.removeItem('ocularr_token');
        window.location.href = '/login';
      }
    } else if (error.response?.status === 403) {
      // Forbidden - show error message
      console.error('Access forbidden:', error.response.data?.error);
    } else if (error.response?.status >= 500) {
      // Server error
      console.error('Server error:', error.response.data?.error || 'Internal server error');
    } else if (error.code === 'ECONNABORTED') {
      // Timeout error
      console.error('Request timeout');
    } else if (!error.response) {
      // Network error
      console.error('Network error - please check your connection');
    }

    return Promise.reject(error);
  }
);

// API helper functions
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  me: () => api.get('/auth/me'),
  refresh: () => api.post('/auth/refresh'),
};

export const userAPI = {
  getProfile: (userId) => api.get(userId ? `/users/profile/${userId}` : '/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
  uploadProfilePicture: (file) => {
    const formData = new FormData();
    formData.append('profilePicture', file);
    return api.post('/users/profile/picture', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getWatchlist: () => api.get('/users/watchlist'),
  addToWatchlist: (movie) => api.post('/users/watchlist', movie),
  updateWatchlistItem: (movieId, data) => api.put(`/users/watchlist/${movieId}`, data),
  removeFromWatchlist: (movieId) => api.delete(`/users/watchlist/${movieId}`),
  changePassword: (passwords) => api.put('/users/change-password', passwords),
};

export const clubAPI = {
  getUserClubs: () => api.get('/clubs'),
  getPublicClubs: (params) => api.get('/clubs/public', { params }),
  createClub: (clubData) => {
    if (clubData.clubPicture instanceof File) {
      const formData = new FormData();
      Object.keys(clubData).forEach(key => {
        formData.append(key, clubData[key]);
      });
      return api.post('/clubs', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.post('/clubs', clubData);
  },
  joinClub: (inviteCode, password) => api.post('/clubs/join', { inviteCode, password }),
  getClubDetails: (clubId) => api.get(`/clubs/${clubId}`),
  getClubMembers: (clubId) => api.get(`/clubs/${clubId}/members`),
  updateClub: (clubId, clubData) => {
    if (clubData.clubPicture instanceof File) {
      const formData = new FormData();
      Object.keys(clubData).forEach(key => {
        formData.append(key, clubData[key]);
      });
      return api.put(`/clubs/${clubId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.put(`/clubs/${clubId}`, clubData);
  },
  getClubThemes: (clubId) => api.get(`/clubs/${clubId}/themes`),
  submitTheme: (clubId, themeText) => api.post(`/clubs/${clubId}/themes`, { themeText }),
  updateMemberRole: (clubId, userId, role) => api.put(`/clubs/${clubId}/members/${userId}/role`, { role }),
  removeMember: (clubId, userId) => api.delete(`/clubs/${clubId}/members/${userId}`),
  leaveClub: (clubId) => api.post(`/clubs/${clubId}/leave`),
};

export const cycleAPI = {
  startCycle: (clubId) => api.post(`/cycles/${clubId}/start`),
  getCurrentCycle: (clubId) => api.get(`/cycles/${clubId}/current`),
  updateCyclePhase: (cycleId, action) => api.put(`/cycles/${cycleId}/phase`, { action }),
  submitNomination: (cycleId, movieData) => api.post(`/cycles/${cycleId}/nominate`, movieData),
  updateWatchProgress: (cycleId, movieId, progressData) => api.put(`/cycles/${cycleId}/watch/${movieId}`, progressData),
  submitRankings: (cycleId, rankingsData) => api.post(`/cycles/${cycleId}/submit-rankings`, rankingsData),
  getCycleHistory: (clubId, params) => api.get(`/cycles/${clubId}/history`, { params }),
  getCycleResults: (cycleId) => api.get(`/cycles/${cycleId}/results`),
};

export const tmdbAPI = {
  searchMovies: (query, page = 1) => api.get('/tmdb/search/movie', { params: { query, page } }),
  getMovieDetails: (movieId) => api.get(`/tmdb/movie/${movieId}`),
  getPopularMovies: (page = 1) => api.get('/tmdb/movie/popular', { params: { page } }),
  getGenres: () => api.get('/tmdb/genre/movie/list'),
  getTrendingMovies: (timeWindow = 'week', page = 1) => api.get(`/tmdb/trending/movie/${timeWindow}`, { params: { page } }),
  discoverMovies: (filters) => api.get('/tmdb/discover/movie', { params: filters }),
};

// Utility functions
export const handleApiError = (error, defaultMessage = 'An error occurred') => {
  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  if (error.message) {
    return error.message;
  }
  return defaultMessage;
};

export const isNetworkError = (error) => {
  return !error.response && error.code !== 'ECONNABORTED';
};

export const isTimeoutError = (error) => {
  return error.code === 'ECONNABORTED';
};

export default api;