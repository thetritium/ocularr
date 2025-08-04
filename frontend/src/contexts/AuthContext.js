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
  console.log('AuthProvider component rendered');
  
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('ocularr_token'));

  // Check if user is authenticated on app load
  useEffect(() => {
    console.log('AuthProvider useEffect running');
    
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('ocularr_token');
      
      if (storedToken) {
        try {
          console.log('Checking auth with token:', storedToken.substring(0, 20) + '...');
          
          const response = await api.get('/auth/me');
          console.log('Auth check successful:', response.data);
          
          setUser(response.data.user);
          setToken(storedToken);
        } catch (error) {
          console.error('Auth check failed:', error.response?.data || error.message);
          
          // Only clear token if it's definitely invalid
          if (error.response?.status === 401 || error.response?.status === 403) {
            console.log('Token appears invalid, clearing...');
            localStorage.removeItem('ocularr_token');
            setToken(null);
            setUser(null);
          } else {
            console.log('Network/server error, keeping token');
            setToken(storedToken);
          }
        }
      } else {
        console.log('No token found in localStorage');
      }
      
      console.log('Setting loading to false');
      setLoading(false);
    };

    checkAuth();
  }, []); // Only run once on mount

  const login = async (username, password) => {
    try {
      const response = await api.post('/auth/login', { username, password });
      const { token: newToken, user: userData } = response.data;
      
      console.log('Login response:', response.data);
      console.log('Setting token:', newToken);
      
      // Save token and update state
      localStorage.setItem('ocularr_token', newToken);
      setToken(newToken);
      setUser(userData);
      
      // Verify it was saved
      const savedToken = localStorage.getItem('ocularr_token');
      console.log('Token saved to localStorage:', savedToken);
      console.log('Token state updated:', newToken === savedToken);
      
      return { success: true, user: userData };
    } catch (error) {
      console.error('Login error:', error);
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
      
      console.log('Register response:', response.data);
      console.log('Setting token:', newToken);
      
      // Save token and update state
      localStorage.setItem('ocularr_token', newToken);
      setToken(newToken);
      setUser(newUser);
      
      // Verify it was saved
      const savedToken = localStorage.getItem('ocularr_token');
      console.log('Token saved to localStorage:', savedToken);
      
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
    console.log('Logging out...');
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
    token // Expose token for debugging
  };

  console.log('AuthProvider rendering with loading:', loading, 'user:', !!user);

  return (
    <AuthContext.Provider value={value}>
      {console.log('AuthProvider rendering children, loading:', loading)}
      {children}
    </AuthContext.Provider>
  );
};