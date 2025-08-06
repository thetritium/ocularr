import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  // Check and validate stored token on mount
  const checkAuth = useCallback(async () => {
    const storedToken = localStorage.getItem('ocularr_token');
    
    if (!storedToken) {
      setLoading(false);
      return;
    }

    try {
      // Set token state immediately to prevent flashing
      setToken(storedToken);
      
      // Validate token with backend
      const response = await authAPI.getMe();
      
      if (response.data && response.data.user) {
        setUser(response.data.user);
      } else {
        // Invalid response structure
        throw new Error('Invalid user data');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      
      // Clear invalid token
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem('ocularr_token');
        setToken(null);
        setUser(null);
      }
      // For network errors, keep the token but don't set user
      // This prevents logout on temporary connection issues
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (identifier, password) => {
    try {
      const response = await authAPI.login(identifier, password);
      const { token: newToken, user: userData } = response.data;
      
      // Save token to localStorage
      localStorage.setItem('ocularr_token', newToken);
      
      // Update state
      setToken(newToken);
      setUser(userData);
      
      return { success: true, user: userData };
    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Login failed. Please try again.' 
      };
    }
  };

  const register = async (userData) => {
    try {
      const response = await authAPI.register(userData);
      const { token: newToken, user: newUser } = response.data;
      
      // Save token to localStorage
      localStorage.setItem('ocularr_token', newToken);
      
      // Update state
      setToken(newToken);
      setUser(newUser);
      
      return { success: true, user: newUser };
    } catch (error) {
      console.error('Registration error:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Registration failed. Please try again.' 
      };
    }
  };

  const logout = useCallback(() => {
    // Clear localStorage
    localStorage.removeItem('ocularr_token');
    
    // Clear state
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((userData) => {
    setUser(prev => ({ ...prev, ...userData }));
  }, []);

  const refreshToken = async () => {
    try {
      const response = await authAPI.refresh();
      const { token: newToken } = response.data;
      
      // Update token
      localStorage.setItem('ocularr_token', newToken);
      setToken(newToken);
      
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
      return false;
    }
  };

  const value = {
    user,
    loading,
    token,
    login,
    register,
    logout,
    updateUser,
    refreshToken,
    checkAuth,
    isAuthenticated: !!user && !!token
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};