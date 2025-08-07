import axios from 'axios';

// Use relative path for API calls - nginx will proxy to backend
// In production builds, REACT_APP_API_URL can be set to full domain
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

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
    return error.message || defaultMessage;
  }
};

// ============================
// CLUB API METHODS
// ============================
export const clubAPI = {
  // Get public clubs with pagination and search
  getPublicClubs: async (params = {}) => {
    return api.get('/clubs/public', { params });
  },

  // Join club by invite code with enhanced error handling
  joinClub: async (inviteCode, password) => {
    const data = { inviteCode };
    if (password) {
      data.password = password;
    }
    
    try {
      const response = await api.post('/clubs/join', data);
      return response;
    } catch (error) {
      // Special handling for join club errors to prevent unwanted logouts
      if (error.response?.status === 401) {
        // Don't trigger automatic logout for join club password errors
        const newError = new Error(error.response.data?.error || 'Authentication failed');
        newError.response = error.response;
        throw newError;
      }
      throw error;
    }
  },

  // Get club by URL slug/name
  getClubByName: async (clubname) => {
    return api.get(`/clubs/by-name/${clubname}`);
  },

  // Get club members
  getMembers: async (clubId) => {
    return api.get(`/clubs/${clubId}/members`);
  },

  // Leave club
  leaveClub: async (clubId) => {
    return api.post(`/clubs/${clubId}/leave`);
  },

  // Get user's clubs
  getUserClubs: async () => {
    return api.get('/clubs');
  },

  // Create new club
  createClub: async (formData) => {
    return api.post('/clubs', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // Get club themes
  getThemes: async (clubId) => {
    return api.get(`/clubs/${clubId}/themes`);
  },

  // Submit theme to club
  submitTheme: async (clubId, themeText) => {
    return api.post(`/clubs/${clubId}/themes`, { themeText });
  },

  // Update club settings
  updateClub: async (clubId, formData) => {
    return api.put(`/clubs/${clubId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }
};

// ============================
// USER API METHODS
// ============================
export const userAPI = {
  // Get profile by username
  getProfileByUsername: async (username) => {
    return api.get(`/users/profile/${username}`);
  },

  // Update user profile
  updateProfile: async (formData) => {
    return api.put('/users/profile', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  // Add movie to favorites
  addFavorite: async (movieData) => {
    return api.post('/users/favorites', movieData);
  },

  // Remove movie from favorites
  removeFavorite: async (tmdbId) => {
    return api.delete(`/users/favorites/${tmdbId}`);
  },

  // Add movie to watchlist
  addToWatchlist: async (movieData) => {
    return api.post('/users/watchlist', movieData);
  },

  // Remove movie from watchlist
  removeFromWatchlist: async (tmdbId) => {
    return api.delete(`/users/watchlist/${tmdbId}`);
  },

  // Mark movie as watched in watchlist
  markAsWatched: async (tmdbId) => {
    return api.put(`/users/watchlist/${tmdbId}/watched`);
  }
};

// ============================
// AUTH API METHODS
// ============================
export const authAPI = {
  // Login user
  login: async (identifier, password) => {
    return api.post('/auth/login', { identifier, password });
  },

  // Register user
  register: async (userData) => {
    return api.post('/auth/register', userData);
  },

  // Get current user
  getCurrentUser: async () => {
    return api.get('/auth/me');
  }
};

// ============================
// CYCLE API METHODS
// ============================
export const cycleAPI = {
  // Get current cycle for club
  getCurrentCycle: async (clubId) => {
    return api.get(`/cycles/${clubId}/current`);
  },

  // Start new cycle
  startCycle: async (clubId) => {
    return api.post(`/cycles/${clubId}/start`);
  },

  // Progress cycle to next phase
  progressPhase: async (cycleId) => {
    return api.put(`/cycles/${cycleId}/phase`);
  },

  // Submit nomination
  submitNomination: async (cycleId, movieData) => {
    return api.post(`/cycles/${cycleId}/nominate`, movieData);
  },

  // Mark movie as watched
  markWatched: async (cycleId, movieId) => {
    return api.put(`/cycles/${cycleId}/watch/${movieId}`);
  },

  // Submit rankings
  submitRankings: async (cycleId, rankings) => {
    return api.post(`/cycles/${cycleId}/submit-rankings`, { rankings });
  }
};

// ============================
// TMDB API METHODS
// ============================
export const tmdbAPI = {
  // Search movies
  searchMovies: async (query, page = 1) => {
    return api.get('/tmdb/search/movie', {
      params: { query, page }
    });
  },

  // Get movie details
  getMovieDetails: async (movieId) => {
    return api.get(`/tmdb/movie/${movieId}`);
  }
};

// Export the base axios instance as default for direct use
export default api;