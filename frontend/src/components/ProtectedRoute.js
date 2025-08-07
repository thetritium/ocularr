import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

const ProtectedRoute = () => {
  console.log('ProtectedRoute rendered');
  
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  
  console.log('ProtectedRoute - loading:', loading, 'isAuthenticated:', isAuthenticated);

  // Show loading spinner while checking auth
  if (loading) {
    console.log('ProtectedRoute showing loading spinner');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    console.log('ProtectedRoute redirecting to login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  console.log('ProtectedRoute rendering outlet');
  // Render child routes
  return <Outlet />;
};

export default ProtectedRoute;