import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

const DashboardPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [clubs, setClubs] = useState([]);
  const [publicClubs, setPublicClubs] = useState([]);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  // Debug logging
  useEffect(() => {
    console.log('Dashboard mounted');
    console.log('Loading state:', loading);
    console.log('Clubs:', clubs);
    console.log('Error:', error);
    console.log('User:', user);
  }, [loading, clubs, error, user]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      console.log('Fetching dashboard data...');
      setLoading(true);
      setError(null);

      // Fetch user data
      const userResponse = await api.get('/auth/me');
      console.log('User data:', userResponse.data);
      setUser(userResponse.data.user);

      // Fetch user's clubs
      const clubsResponse = await api.get('/clubs');
      console.log('Clubs response:', clubsResponse.data);
      setClubs(clubsResponse.data.clubs || []);

      // Fetch public clubs (limited to 3)
      try {
        const publicResponse = await api.get('/clubs/public?limit=3');
        console.log('Public clubs response:', publicResponse.data);
        setPublicClubs(publicResponse.data.clubs || []);
      } catch (err) {
        console.error('Error fetching public clubs:', err);
        // Don't fail the whole page if public clubs fail
        setPublicClubs([]);
      }
    } catch (err) {
      console.error('Dashboard error:', err);
      setError(err.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  // Show loading spinner
  if (loading) {
    console.log('Showing loading spinner...');
    return <LoadingSpinner />;
  }

  // Show error state
  if (error) {
    console.log('Showing error state:', error);
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-2">Error Loading Dashboard</h2>
          <p className="text-red-300 mb-4">{error}</p>
          <button 
            onClick={fetchDashboardData}
            className="bg-red-700 hover:bg-red-600 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  console.log('Rendering dashboard with', clubs.length, 'clubs');

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Welcome back{user?.username ? `, ${user.username}` : ''}!
        </h1>
        <p className="text-gray-400">Manage your movie clubs and discover new ones</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link
          to="/clubs/create"
          className="bg-blue-600 hover:bg-blue-700 p-4 rounded-lg text-center font-medium transition-colors"
        >
          <div className="text-2xl mb-2">🎬</div>
          Create New Club
        </Link>
        <Link
          to="/clubs/join"
          className="bg-green-600 hover:bg-green-700 p-4 rounded-lg text-center font-medium transition-colors"
        >
          <div className="text-2xl mb-2">🎟️</div>
          Join with Code
        </Link>
        <Link
          to="/clubs/public"
          className="bg-purple-600 hover:bg-purple-700 p-4 rounded-lg text-center font-medium transition-colors"
        >
          <div className="text-2xl mb-2">🌍</div>
          Browse Public Clubs
        </Link>
      </div>

      {/* User's Clubs */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-6">Your Clubs</h2>
        {clubs.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400 mb-4">You haven't joined any clubs yet</p>
            <div className="flex gap-4 justify-center">
              <Link
                to="/clubs/create"
                className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Create a Club
              </Link>
              <Link
                to="/clubs/join"
                className="bg-gray-700 hover:bg-gray-600 px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Join Existing Club
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clubs.map(club => {
              console.log('Rendering club:', club.id, club.name);
              return (
                <div
                  key={club.id}
                  onClick={() => {
                    console.log('Navigating to club:', club.id);
                    navigate(`/clubs/${club.id}`);
                  }}
                  className="bg-gray-800 rounded-lg p-6 cursor-pointer hover:bg-gray-700 transition-colors"
                >
                  {club.club_picture && (
                    <img
                      src={club.club_picture}
                      alt={club.name}
                      className="w-full h-40 object-cover rounded-lg mb-4"
                    />
                  )}
                  <h3 className="text-xl font-semibold mb-2">{club.name}</h3>
                  <p className="text-gray-400 mb-4 line-clamp-2">
                    {club.description || 'No description'}
                  </p>
                  <div className="flex justify-between items-center text-sm text-gray-500">
                    <span>{club.member_count || 0} members</span>
                    <span className="capitalize">{club.role || 'member'}</span>
                  </div>
                  {club.current_cycle && (
                    <div className="mt-4 p-3 bg-gray-900 rounded">
                      <span className="text-xs text-blue-400">
                        Active Cycle: {club.current_cycle.phase}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Public Clubs */}
      {publicClubs.length > 0 && (
        <section>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold">Discover Public Clubs</h2>
            <Link
              to="/clubs/public"
              className="text-blue-400 hover:text-blue-300 font-medium"
            >
              View All →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {publicClubs.map(club => (
              <div
                key={club.id}
                className="bg-gray-800 rounded-lg p-6 border border-gray-700"
              >
                {club.club_picture && (
                  <img
                    src={club.club_picture}
                    alt={club.name}
                    className="w-full h-32 object-cover rounded-lg mb-4"
                  />
                )}
                <h3 className="text-lg font-semibold mb-2">{club.name}</h3>
                <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                  {club.description || 'No description'}
                </p>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">
                    {club.member_count || 0}/{club.max_members} members
                  </span>
                  {club.is_member ? (
                    <span className="text-sm text-green-500">✓ Member</span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/clubs/join', { state: { inviteCode: club.invite_code } });
                      }}
                      className="text-sm bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded transition-colors"
                    >
                      Join
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Debug Info (remove in production) */}
      <div className="mt-12 p-4 bg-gray-900 rounded-lg text-xs text-gray-500">
        <h3 className="font-bold mb-2">Debug Info:</h3>
        <p>Clubs loaded: {clubs.length}</p>
        <p>Public clubs: {publicClubs.length}</p>
        <p>User ID: {user?.id || 'Not loaded'}</p>
        <p>Username: {user?.username || 'Not loaded'}</p>
      </div>
    </div>
  );
};

export default DashboardPage;