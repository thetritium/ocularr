import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clubAPI, handleApiError } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

const PublicClubsPage = () => {
  const navigate = useNavigate();
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(null);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    pages: 1
  });

  // Join modal state
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedClub, setSelectedClub] = useState(null);
  const [joinForm, setJoinForm] = useState({
    inviteCode: '',
    password: ''
  });

  useEffect(() => {
    fetchPublicClubs();
  }, [pagination.page, searchQuery]);

  const fetchPublicClubs = async () => {
    try {
      setLoading(true);
      setError('');
      
      const params = {
        page: pagination.page,
        limit: pagination.limit,
      };
      
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      
      const response = await clubAPI.getPublicClubs(params);
      setClubs(response.data.clubs || []);
      setPagination(prev => ({
        ...prev,
        ...response.data.pagination
      }));
    } catch (error) {
      console.error('Failed to fetch public clubs:', error);
      setError(handleApiError(error, 'Failed to load public clubs'));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchPublicClubs();
  };

  const openJoinModal = (club) => {
    setSelectedClub(club);
    setJoinForm({ inviteCode: club.invite_code || '', password: '' });
    setShowJoinModal(true);
  };

  const closeJoinModal = () => {
    setShowJoinModal(false);
    setSelectedClub(null);
    setJoinForm({ inviteCode: '', password: '' });
    setError('');
  };

  const handleJoinClub = async (e) => {
    e.preventDefault();
    if (!selectedClub) return;

    setJoining(selectedClub.id);
    setError('');
    
    try {
      const response = await clubAPI.joinClub(joinForm.inviteCode, joinForm.password || null);
      
      closeJoinModal();
      
      // Navigate to the club page
      if (response.data.club?.url_slug) {
        navigate(`/club/${response.data.club.url_slug}`);
      } else {
        // Refresh the clubs list to show updated membership status
        fetchPublicClubs();
      }
    } catch (error) {
      console.error('Failed to join club:', error);
      setError(handleApiError(error, 'Failed to join club'));
    } finally {
      setJoining(null);
    }
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  // Get club image URL using nginx proxy
  const getClubImageUrl = (clubPicture) => {
    if (!clubPicture) return null;
    // If it's already a full URL (starts with http), use as-is
    if (clubPicture.startsWith('http')) return clubPicture;
    // Otherwise, use relative path - nginx will proxy to backend
    return clubPicture;
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Public Clubs</h1>
        <p className="text-gray-400">
          Discover and join movie clubs that are open to everyone
        </p>
      </div>

      {/* Search and Actions */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row gap-4">
          <form onSubmit={handleSearch} className="flex-1">
            <div className="flex">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search clubs by name or description..."
                className="bg-gray-800 border border-gray-700 rounded-l-lg px-4 py-2 flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-r-lg font-medium transition-colors"
                disabled={loading}
              >
                🔍
              </button>
            </div>
          </form>

          <div className="flex gap-2">
            <Link 
              to="/clubs/join" 
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded font-medium transition-colors"
            >
              Join by Code
            </Link>
            <Link 
              to="/clubs/create" 
              className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded font-medium transition-colors"
            >
              Create Club
            </Link>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/50 border border-red-600 text-red-200 p-4 rounded-lg mb-6">
          {error}
          <button
            onClick={fetchPublicClubs}
            className="ml-4 text-red-300 hover:text-red-100 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <LoadingSpinner size="lg" text="Loading public clubs..." />
        </div>
      )}

      {/* Clubs Grid */}
      {!loading && (
        <>
          {clubs.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold text-gray-100 mb-2">
                {searchQuery ? 'No clubs found' : 'No public clubs yet'}
              </h3>
              <p className="text-gray-400 mb-6">
                {searchQuery 
                  ? `No clubs match "${searchQuery}". Try a different search term.`
                  : 'Be the first to create a public club for others to discover!'
                }
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                    className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded font-medium transition-colors"
                  >
                    Clear Search
                  </button>
                )}
                <Link 
                  to="/clubs/create" 
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium transition-colors"
                >
                  Create Public Club
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {clubs.map((club) => (
                  <div key={club.id} className="bg-gray-800 rounded-lg p-6">
                    {/* Club Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-100 truncate">
                          {club.name}
                        </h3>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs bg-green-900 text-green-200 px-2 py-1 rounded">
                            Public
                          </span>
                          {club.member_count >= club.max_members && (
                            <span className="text-xs bg-red-900 text-red-200 px-2 py-1 rounded">
                              Full
                            </span>
                          )}
                        </div>
                      </div>
                      {club.club_picture && (
                        <img
                          src={getClubImageUrl(club.club_picture)}
                          alt={club.name}
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0 ml-3"
                        />
                      )}
                    </div>

                    {/* Club Description */}
                    {club.description && (
                      <p className="text-sm text-gray-400 mb-4 line-clamp-3">
                        {club.description}
                      </p>
                    )}

                    {/* Club Stats */}
                    <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                      <span>👥 {club.member_count}/{club.max_members}</span>
                      <span>🎬 {club.total_cycles} cycles</span>
                    </div>

                    {/* Current Status */}
                    <div className="mb-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPhaseColor(club.current_phase || 'idle')}`}
                      >
                        {getPhaseIcon(club.current_phase || 'idle')}
                        <span className="ml-1">
                          {club.current_phase ? club.current_phase.charAt(0).toUpperCase() + club.current_phase.slice(1) : 'Idle'}
                        </span>
                      </span>
                    </div>

                    {/* Action Button */}
                    <div className="space-y-2">
                      {club.is_member ? (
                        <Link
                          to={`/club/${club.url_slug || club.id}`}
                          className="block w-full text-center bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium transition-colors"
                        >
                          View Club
                        </Link>
                      ) : club.member_count >= club.max_members ? (
                        <button className="w-full bg-gray-700 px-4 py-2 rounded font-medium cursor-not-allowed" disabled>
                          Club Full
                        </button>
                      ) : (
                        <button
                          onClick={() => openJoinModal(club)}
                          className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium transition-colors"
                        >
                          Join Club
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="flex justify-center space-x-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded font-medium transition-colors"
                  >
                    Previous
                  </button>
                  
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                      let pageNum;
                      if (pagination.pages <= 5) {
                        pageNum = i + 1;
                      } else if (pagination.page <= 3) {
                        pageNum = i + 1;
                      } else if (pagination.page >= pagination.pages - 2) {
                        pageNum = pagination.pages - 4 + i;
                      } else {
                        pageNum = pagination.page - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                            pageNum === pagination.page
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.pages}
                    className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded font-medium transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Join Club Modal */}
      {showJoinModal && selectedClub && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Join {selectedClub.name}</h2>
            
            <form onSubmit={handleJoinClub} className="space-y-4">
              <div>
                <label htmlFor="inviteCode" className="block text-sm font-medium mb-2">
                  Invite Code
                </label>
                <input
                  type="text"
                  id="inviteCode"
                  value={joinForm.inviteCode}
                  onChange={(e) => setJoinForm(prev => ({ ...prev, inviteCode: e.target.value }))}
                  placeholder="Enter invite code"
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-2">
                  Password (if required)
                </label>
                <input
                  type="password"
                  id="password"
                  value={joinForm.password}
                  onChange={(e) => setJoinForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter password if club is password protected"
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {error && (
                <div className="bg-red-900/50 border border-red-600 text-red-200 p-3 rounded text-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={closeJoinModal}
                  className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joining === selectedClub.id}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 px-4 py-2 rounded font-medium transition-colors"
                >
                  {joining === selectedClub.id ? (
                    <div className="flex items-center">
                      <LoadingSpinner size="sm" />
                      <span className="ml-2">Joining...</span>
                    </div>
                  ) : (
                    'Join Club'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Info Box */}
      {!loading && clubs.length > 0 && (
        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">
            🎬 About Public Clubs
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-400">
            <div>
              <h4 className="font-medium text-gray-300 mb-2">What are public clubs?</h4>
              <ul className="space-y-1">
                <li>• Open for anyone to discover and join</li>
                <li>• May require invite code or password</li>
                <li>• Great for meeting new movie enthusiasts</li>
                <li>• Visible to all users in the discover section</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-300 mb-2">How do movie cycles work?</h4>
              <ul className="space-y-1">
                <li>• 📝 Nomination: Submit movies for a theme</li>
                <li>• 👀 Watching: Watch all nominated movies</li>
                <li>• 🎯 Ranking: Guess nominators & rank movies</li>
                <li>• 🏆 Results: See who won and earned points</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicClubsPage;