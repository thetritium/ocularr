import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Auth Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// Main Pages
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';

// Club Pages
import ClubPage from './pages/ClubPage';
import CreateClubPage from './pages/CreateClubPage';
import JoinClubPage from './pages/JoinClubPage';
import PublicClubsPage from './pages/PublicClubsPage';
import ClubSettingsPage from './pages/ClubSettingsPage';

function App() {
  useEffect(() => {
    // CACHE BUSTING ON APP LOAD
    const handleCacheBusting = () => {
      // Clear browser caches
      if ('caches' in window) {
        caches.keys().then(cacheNames => {
          cacheNames.forEach(cacheName => {
            caches.delete(cacheName);
          });
        });
      }

      // Disable back/forward cache (bfcache)
      window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
          window.location.reload();
        }
      });

      // Force reload on focus if app is stale
      const APP_VERSION = '2024.12.19.001'; // UPDATE THIS WHEN YOU DEPLOY
      const checkVersion = () => {
        const stored = sessionStorage.getItem('ocularr_session_version');
        if (stored && stored !== APP_VERSION) {
          console.log('App version changed, forcing reload...');
          sessionStorage.clear();
          window.location.reload(true);
        }
        sessionStorage.setItem('ocularr_session_version', APP_VERSION);
      };

      // Check version on focus
      window.addEventListener('focus', checkVersion);
      checkVersion(); // Check immediately

      // Add timestamp to all fetch requests
      const originalFetch = window.fetch;
      window.fetch = function(url, options = {}) {
        if (typeof url === 'string') {
          const separator = url.includes('?') ? '&' : '?';
          url += `${separator}_t=${Date.now()}`;
        }
        return originalFetch(url, options);
      };
    };

    handleCacheBusting();

    // Cleanup
    return () => {
      window.removeEventListener('pageshow', () => {});
      window.removeEventListener('focus', () => {});
    };
  }, []);

  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              {/* Root redirect */}
              <Route index element={<Navigate to="/dashboard" replace />} />
              
              {/* Dashboard */}
              <Route path="dashboard" element={<DashboardPage />} />

              {/* User Profile */}
              <Route path="profile/:username" element={<ProfilePage />} />

              {/* Club Management Routes (plural) */}
              <Route path="clubs">
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="create" element={<CreateClubPage />} />
                <Route path="join" element={<JoinClubPage />} />
                <Route path="public" element={<PublicClubsPage />} />
              </Route>

              {/* Individual Club Route (singular) */}
              <Route path="club/:clubname" element={<ClubPage />} />
              <Route path="club/:clubname/settings" element={<ClubSettingsPage />} />
            </Route>
          </Route>

          {/* 404 catch all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;