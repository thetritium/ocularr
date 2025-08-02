import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import CreateClubPage from './pages/CreateClubPage';
import JoinClubPage from './pages/JoinClubPage';
import ClubPage from './pages/ClubPage';
import PublicClubsPage from './pages/PublicClubsPage';

function App() {
  console.log('App component rendered!');
  
  return (
    <AuthProvider>
      {console.log('Inside AuthProvider render')}
      <Router>
        {console.log('Inside Router render')}
        <Routes>
  {/* Auth routes */}
  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />

  {/* Protected routes */}
  <Route element={<ProtectedRoute />}>
    <Route element={<Layout />}>
      {/* Dashboard */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardPage />} />

      {/* User Profile */}
      <Route path="/profile/:username" element={<ProfilePage />} />

      {/* Club Management Pages (plural) */}
      <Route path="/clubs" element={<DashboardPage />} />
      <Route path="/clubs/create" element={<CreateClubPage />} />
      <Route path="/clubs/join" element={<JoinClubPage />} />
      <Route path="/clubs/public" element={<PublicClubsPage />} />

      {/* Individual Club Page (singular) */}
      <Route path="/club/:clubname" element={<ClubPage />} />
    </Route>
  </Route>

  {/* Catch all */}
  <Route path="*" element={<Navigate to="/dashboard" replace />} />
</Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;