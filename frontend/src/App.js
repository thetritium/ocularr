import React from 'react';
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

function App() {
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