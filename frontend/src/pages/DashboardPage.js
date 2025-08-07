import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalClubs: 0,
    activeCycles: 0,
    moviesWatched: 0
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch user's clubs
      const clubsResponse = await api.get('/clubs');
      setClubs(clubsResponse.data.clubs);
      
      // Calculate stats
      const totalClubs = clubsResponse.data.clubs.length;
      const activeCycles = clubsResponse.data.clubs.filter(
        club => club.current_phase && club.current_phase !== 'idle'
      ).length;
      
      setStats({
        totalClubs,
        activeCycles,
        moviesWatched: 0 // TODO: Implement from watch progress
      });
      
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Welcome back, {user?.display_name || user?.username || 'User'}!
        </h1>
        <p className="text-gray-400">
          {clubs.length === 0 
            ? "You haven't joined any clubs yet. Create one or join an existing club to get started!"
            : `You're part of ${clubs.length} movie ${clubs.length === 1 ? 'club' : 'clubs'}.`
          }
        </p>
      </div>

      {/* Quick Actions */}
      {clubs.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Link 
            to="/clubs/create" 
            className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-8 text-center hover:from-blue-700 hover:to-blue-800 transition-all"
          >
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <h3 className="text-xl font-semibold mb-2">Create a Club</h3>
            <p className="text-blue-200">Start your own movie club and invite friends</p>
          </Link>

          <Link 
            to="/clubs/join" 
            className="bg-gradient-to-r from-green-600 to-green-700 rounded-lg p-8 text-center hover:from-green-700 hover:to-green-800 transition-all"
          >
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            <h3 className="text-xl font-semibold mb-2">Join a Club</h3>
            <p className="text-green-200">Enter an invite code to join an existing club</p>
          </Link>
        </div>
      )}

      {/* Your Clubs */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">Your Clubs</h2>
          {clubs.length > 0 && (
            <div className="flex gap-2">
              <Link 
                to="/clubs/create" 
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium transition-colors"
              >
                Create Club
              </Link>
              <Link 
                to="/clubs/join" 
                className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded font-medium transition-colors"
              >
                Join Club
              </Link>
            </div>
          )}
        </div>

        {clubs.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4" />
            </svg>
            <p className="text-gray-400 mb-6">No clubs yet. Time to start your movie journey!</p>
            <div className="flex gap-3 justify-center">
              <Link 
                to="/clubs/create" 
                className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded font-medium transition-colors"
              >
                Create Your First Club
              </Link>
              <Link 
                to="/clubs/public" 
                className="bg-gray-700 hover:bg-gray-600 px-6 py-2 rounded font-medium transition-colors"
              >
                Browse Public Clubs
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clubs.map(club => (
              <Link 
                key={club.id} 
                to={`/club/${club.url_slug}`}
                className="block group"
              >
                <div className="bg-gray-800 rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all">
                  {/* Club Header with Picture */}
                  <div className="h-32 bg-gradient-to-r from-blue-600 to-purple-600 relative">
                    {club.club_picture ? (
                      <img 
                        src={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${club.club_picture}`}
                        alt={club.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-6xl font-bold text-white/20">
                          {club.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <span className="bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full capitalize">
                        {club.role}
                      </span>
                    </div>
                  </div>

                  {/* Club Info */}
                  <div className="p-6">
                    <h3 className="text-xl font-semibold mb-2 group-hover:text-blue-400 transition-colors">
                      {club.name}
                    </h3>
                    {club.description && (
                      <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                        {club.description}
                      </p>
                    )}

                    {/* Club Stats */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex gap-4 text-gray-500">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          {club.member_count || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          {club.total_cycles || 0}
                        </span>
                      </div>
                    </div>

                    {/* Current Phase Indicator */}
                    {club.current_phase && club.current_phase !== 'idle' && (
                      <div className="mt-4 pt-4 border-t border-gray-700">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">Current Phase</span>
                          <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-1 rounded capitalize">
                            {club.current_phase}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity Section (Optional) */}
      {clubs.length > 0 && (
        <div className="mt-12">
          <h2 className="text-2xl font-semibold mb-6">Recent Activity</h2>
          <div className="bg-gray-800 rounded-lg p-6">
            <p className="text-gray-500 text-center">Activity feed coming soon...</p>
          </div>
        </div>
      )}

      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400">Total Clubs</span>
            <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div className="text-3xl font-bold">{stats.totalClubs}</div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400">Active Cycles</span>
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div className="text-3xl font-bold">{stats.activeCycles}</div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400">Movies Watched</span>
            <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4" />
            </svg>
          </div>
          <div className="text-3xl font-bold">{stats.moviesWatched}</div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;