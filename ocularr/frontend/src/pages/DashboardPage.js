import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { clubAPI, handleApiError } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

const DashboardPage = () => {
  const { user } = useAuth();
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUserClubs();
  }, []);

  const fetchUserClubs = async () => {
    try {
      setLoading(true);
      const response = await clubAPI.getUserClubs();
      setClubs(response.data.clubs || []);
    } catch (error) {
      console.error('Failed to fetch clubs:', error);
      setError(handleApiError(error, 'Failed to load your clubs'));
    } finally {
      setLoading(false);
    }
  };

  const getPhaseColor = (phase) => {
    const colors = {
      nomination: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      watching: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      ranking: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      results: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      idle: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    };
    return colors[phase] || colors.idle;
  };

  const getPhaseIcon = (phase) => {
    const icons = {
      nomination: '📝',
      watching: '👀',
      ranking: '🎯',
      results: '🏆',
      idle: '😴'
    };
    return icons[phase] || icons.idle;
  };

  const getRoleIcon = (role) => {
    const icons = {
      producer: '👑',
      director: '🎬',
      critic: '🍿'
    };
    return icons[role] || icons.critic;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <LoadingSpinner size="lg" text="Loading your dashboard..." />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">
          Welcome back, {user?.displayName || user?.username}! 👋
        </h1>
        <p className="text-gray-400">
          Manage your movie clubs and participate in exciting film cycles
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Link
          to="/create-club"
          className="card-hover p-6 text-center group"
        >
          <div className="text-3xl mb-3 group-hover:animate-bounce-subtle">🎬</div>
          <h3 className="font-semibold text-gray-100 mb-1">Create Club</h3>
          <p className="text-sm text-gray-400">Start your own movie club</p>
        </Link>

        <Link
          to="/join-club"
          className="card-hover p-6 text-center group"
        >
          <div className="text-3xl mb-3 group-hover:animate-bounce-subtle">➕</div>
          <h3 className="font-semibold text-gray-100 mb-1">Join Club</h3>
          <p className="text-sm text-gray-400">Use an invite code</p>
        </Link>

        <Link
          to="/public-clubs"
          className="card-hover p-6 text-center group"
        >
          <div className="text-3xl mb-3 group-hover:animate-bounce-subtle">🌐</div>
          <h3 className="font-semibold text-gray-100 mb-1">Explore Clubs</h3>
          <p className="text-sm text-gray-400">Browse public clubs</p>
        </Link>

        <Link
          to="/profile"
          className="card-hover p-6 text-center group"
        >
          <div className="text-3xl mb-3 group-hover:animate-bounce-subtle">👤</div>
          <h3 className="font-semibold text-gray-100 mb-1">Your Profile</h3>
          <p className="text-sm text-gray-400">Manage your account</p>
        </Link>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/50 border border-red-600 text-red-200 p-4 rounded-lg mb-6">
          {error}
          <button
            onClick={fetchUserClubs}
            className="ml-4 text-red-300 hover:text-red-100 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Your Clubs */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-100">Your Clubs</h2>
          {clubs.length > 0 && (
            <div className="text-sm text-gray-400">
              {clubs.length} club{clubs.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {clubs.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="text-6xl mb-4">🎬</div>
            <h3 className="text-xl font-semibold text-gray-100 mb-2">
              No clubs yet
            </h3>
            <p className="text-gray-400 mb-6">
              Create your first movie club or join an existing one to get started
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/create-club"
                className="btn-primary"
              >
                Create Your First Club
              </Link>
              <Link
                to="/join-club"
                className="btn-secondary"
              >
                Join Existing Club
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clubs.map((club) => (
              <Link
                key={club.id}
                to={`/club/${club.id}`}
                className="card-hover p-6 group"
              >
                {/* Club Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-100 truncate group-hover:text-primary-400 transition-colors">
                      {club.name}
                    </h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-sm text-gray-400">
                        {getRoleIcon(club.role)} {club.role}
                      </span>
                      {club.is_public && (
                        <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
                          Public
                        </span>
                      )}
                    </div>
                  </div>
                  {club.club_picture && (
                    <img
                      src={club.club_picture}
                      alt={club.name}
                      className="w-12 h-12 rounded-lg object-cover flex-shrink-0 ml-3"
                    />
                  )}
                </div>

                {/* Club Description */}
                {club.description && (
                  <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                    {club.description}
                  </p>
                )}

                {/* Club Stats */}
                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <span>👥 {club.member_count} members</span>
                  <span>🎬 {club.total_cycles} cycles</span>
                </div>

                {/* Current Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPhaseColor(club.current_phase || 'idle')}`}
                    >
                      {getPhaseIcon(club.current_phase || 'idle')}
                      {club.current_phase ? club.current_phase.charAt(0).toUpperCase() + club.current_phase.slice(1) : 'Idle'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    Joined {new Date(club.joined_at).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity (placeholder for future enhancement) */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">
          📈 Quick Stats
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-primary-400">{clubs.length}</div>
            <div className="text-sm text-gray-400">Clubs Joined</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-400">
              {clubs.reduce((total, club) => total + club.total_cycles, 0)}
            </div>
            <div className="text-sm text-gray-400">Total Cycles</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-400">
              {clubs.filter(club => club.role === 'producer').length}
            </div>
            <div className="text-sm text-gray-400">Clubs Owned</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-400">
              {clubs.filter(club => club.current_phase && club.current_phase !== 'idle').length}
            </div>
            <div className="text-sm text-gray-400">Active Cycles</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;