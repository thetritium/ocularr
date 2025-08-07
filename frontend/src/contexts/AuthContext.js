import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';

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
  const [token, setToken] = useState(localStorage.getItem('ocularr_token'));

  // Check if user is authenticated on app load
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('ocularr_token');
      
      if (storedToken) {
        try {
          const response = await api.get('/auth/me');
          setUser(response.data.user);
          setToken(storedToken);
        } catch (error) {
          console.error('Auth check failed:', error.response?.data || error.message);
          
          // Only clear token if it's definitely invalid (401/403)
          if (error.response?.status === 401 || error.response?.status === 403) {
            localStorage.removeItem('ocularr_token');
            setToken(null);
            setUser(null);
          } else {
            // Keep token for network errors - user might be offline
            setToken(storedToken);
          }
        }
      }
      
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (username, password) => {
    try {
      // DEBUG: Log what we're receiving and sending
      console.log('🔍 Login Debug - Received parameters:', {
        username: username,
        usernameType: typeof username,
        usernameLength: username?.length,
        password: password ? '[PROVIDED]' : '[MISSING]',
        passwordType: typeof password,
        passwordLength: password?.length
      });

      // Trim whitespace and ensure we have values
      const trimmedUsername = username?.trim();
      const trimmedPassword = password?.trim();

      console.log('🔍 Login Debug - After trimming:', {
        trimmedUsername: trimmedUsername,
        trimmedPassword: trimmedPassword ? '[PROVIDED]' : '[MISSING]'
      });

      if (!trimmedUsername || !trimmedPassword) {
        console.error('❌ Login Debug - Missing required fields after trimming');
        return { 
          success: false, 
          error: 'Username and password are required' 
        };
      }

      const requestData = { 
        username: trimmedUsername, 
        password: trimmedPassword 
      };

      console.log('🚀 Login Debug - Sending request:', {
        url: '/auth/login',
        data: { 
          username: requestData.username,
          password: '[HIDDEN]'
        }
      });

      const response = await api.post('/auth/login', requestData);
      const { token: newToken, user: userData } = response.data;
      
      console.log('✅ Login Debug - Success response received');
      
      // Save token and update state
      localStorage.setItem('ocularr_token', newToken);
      setToken(newToken);
      setUser(userData);
      
      return { success: true, user: userData };
    } catch (error) {
      console.error('❌ Login Debug - Error occurred:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        requestData: error.config?.data
      });
      
      return { 
        success: false, 
        error: error.response?.data?.error || 'Login failed' 
      };
    }
  };

  const register = async (userData) => {
    try {
      const response = await api.post('/auth/register', userData);
      const { token: newToken, user: newUser } = response.data;
      
      // Save token and update state
      localStorage.setItem('ocularr_token', newToken);
      setToken(newToken);
      setUser(newUser);
      
      return { success: true, user: newUser };
    } catch (error) {
      console.error('Registration error:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Registration failed' 
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('ocularr_token');
    setToken(null);
    setUser(null);
  };

  const updateUser = (userData) => {
    setUser(prev => ({ ...prev, ...userData }));
  };

  const refreshToken = async () => {
    try {
      const response = await api.post('/auth/refresh');
      const { token: newToken } = response.data;
      
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
    login,
    register,
    logout,
    updateUser,
    refreshToken,
    isAuthenticated: !!user && !!token,
    token
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
