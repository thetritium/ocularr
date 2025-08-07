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
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedClub, setSelectedClub] = useState(null);
  const [joinPassword, setJoinPassword] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    pages: 1
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

  // FIXED: Proper join club workflow with invite code prompt
  const handleJoinClub = (club) => {
    if (club.is_member) {
      navigate(`/club/${club.url_slug}`);
      return;
    }
    
    if (club.member_count >= club.max_members) {
      setError('This club is at maximum capacity');
      return;
    }
    
    setSelectedClub(club);
    setShowJoinModal(true);
  };

  const confirmJoinClub = async () => {
    if (!selectedClub) return;

    setJoining(selectedClub.id);
    try {
      setError('');
      // Use the club's invite code from the API response
      await clubAPI.joinClub(selectedClub.invite_code, joinPassword || null);
      
      setShowJoinModal(false);
      setJoinPassword('');
      setSelectedClub(null);
      
      // Navigate to the club
      navigate(`/club/${selectedClub.url_slug}`);
      
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

  const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    // FIXED: Use correct backend port
    const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
    return `${baseUrl}${imagePath}`;
  };

  const getPhaseColor = (phase) => {
    const colors = {
      nomination: 'bg-blue-600/20 text-blue-400',
      watching: 'bg-yellow-600/20 text-yellow-400',
      ranking: 'bg-purple-600/20 text-purple-400',
      results: 'bg-green-600/20 text-green-400',
      idle: 'bg-gray-600/20 text-gray-400'
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
                className="w-full bg-gray-800 border border-gray-700 px-4 py-2 rounded-l-lg focus:border-blue-500 focus:outline-none text-white"
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
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded font-medium transition-colors"
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
          <LoadingSpinner />
          <p className="text-gray-400 mt-4">Loading public clubs...</p>
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
                          src={getImageUrl(club.club_picture)}
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
                        <button
                          onClick={() => navigate(`/club/${club.url_slug}`)}
                          className="w-full bg-green-600 hover:bg-green-700 py-2 px-4 rounded font-medium transition-colors"
                        >
                          View Club
                        </button>
                      ) : club.member_count >= club.max_members ? (
                        <button 
                          className="w-full bg-gray-600 py-2 px-4 rounded font-medium cursor-not-allowed" 
                          disabled
                        >
                          Club Full
                        </button>
                      ) : (
                        <button
                          onClick={() => handleJoinClub(club)}
                          disabled={joining === club.id}
                          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed py-2 px-4 rounded font-medium transition-colors"
                        >
                          {joining === club.id ? (
                            <div className="flex items-center justify-center">
                              <LoadingSpinner />
                              <span className="ml-2">Joining...</span>
                            </div>
                          ) : (
                            'Join Club'
                          )}
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
            
            <div className="mb-4">
              <p className="text-gray-400 text-sm mb-3">
                You're about to join this public club. 
                {selectedClub.has_password && ' This club requires a password.'}
              </p>
              
              {selectedClub.has_password && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Club Password</label>
                  <input
                    type="password"
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    placeholder="Enter club password"
                    className="w-full bg-gray-900 border border-gray-700 px-3 py-2 rounded focus:border-blue-500 focus:outline-none"
                  />
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowJoinModal(false);
                  setSelectedClub(null);
                  setJoinPassword('');
                }}
                className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmJoinClub}
                disabled={joining === selectedClub.id || (selectedClub.has_password && !joinPassword.trim())}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded font-medium transition-colors"
              >
                {joining === selectedClub.id ? 'Joining...' : 'Join Club'}
              </button>
            </div>
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
                <li>• No invite code needed to join</li>
                <li>• May still require a password</li>
                <li>• Great for meeting new movie enthusiasts</li>
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