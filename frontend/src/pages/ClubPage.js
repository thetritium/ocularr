import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { clubAPI, cycleAPI, handleApiError } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import MovieSearch from '../components/MovieSearch';

const ClubPage = () => {
  const { clubname } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [club, setClub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [members, setMembers] = useState([]);
  const [themes, setThemes] = useState([]);
  const [currentCycle, setCurrentCycle] = useState(null);
  const [clubStats, setClubStats] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal states
  const [showNominationModal, setShowNominationModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [newTheme, setNewTheme] = useState('');
  const [submittingTheme, setSubmittingTheme] = useState(false);
  const [submittingNomination, setSubmittingNomination] = useState(false);

  useEffect(() => {
    if (clubname) {
      fetchClubData();
    }
  }, [clubname]);

  useEffect(() => {
    // Fetch additional data based on active tab
    if (club && activeTab === 'members' && members.length === 0) {
      fetchMembers();
    }
    if (club && activeTab === 'themes' && themes.length === 0) {
      fetchThemes();
    }
    if (club && activeTab === 'stats' && !clubStats) {
      fetchClubStats();
    }
  }, [activeTab, club]);

  const fetchClubData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Fetch club details
      const clubResponse = await clubAPI.getClubByName(clubname);
      setClub(clubResponse.data.club);
      
      // Fetch current cycle if exists
      if (clubResponse.data.club?.id) {
        try {
          const cycleResponse = await cycleAPI.getCurrentCycle(clubResponse.data.club.id);
          setCurrentCycle(cycleResponse.data.cycle);
        } catch (cycleErr) {
          console.log('No current cycle or cycle fetch failed:', cycleErr);
          setCurrentCycle(null);
        }
      }
      
    } catch (err) {
      console.error('Error fetching club data:', err);
      setError(handleApiError(err, 'Failed to load club data'));
      if (err.response?.status === 404 || err.response?.status === 403) {
        navigate('/dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const response = await clubAPI.getMembers(club.id);
      setMembers(response.data.members || []);
    } catch (err) {
      console.error('Error fetching members:', err);
      setError(handleApiError(err, 'Failed to load members'));
    }
  };

  const fetchThemes = async () => {
    try {
      const response = await clubAPI.getThemes(club.id);
      setThemes(response.data.themes || []);
    } catch (err) {
      console.error('Error fetching themes:', err);
      setError(handleApiError(err, 'Failed to load themes'));
    }
  };

  const fetchClubStats = async () => {
    try {
      const response = await clubAPI.getClubStats(club.id);
      setClubStats(response.data);
    } catch (err) {
      console.error('Error fetching club stats:', err);
      setError(handleApiError(err, 'Failed to load club statistics'));
    }
  };

  const handleStartCycle = async () => {
    try {
      setError('');
      setSuccess('');
      
      await cycleAPI.startCycle(club.id);
      setSuccess('New cycle started successfully!');
      
      // Refresh data
      await fetchClubData();
      
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (err) {
      setError(handleApiError(err, 'Failed to start cycle'));
    }
  };

  const handleProgressPhase = async () => {
    try {
      setError('');
      setSuccess('');
      
      await cycleAPI.progressPhase(currentCycle.id);
      setSuccess('Cycle phase updated successfully!');
      
      // Refresh data
      await fetchClubData();
      
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (err) {
      setError(handleApiError(err, 'Failed to progress cycle phase'));
    }
  };

  const handleSubmitTheme = async () => {
    if (!newTheme.trim()) return;

    try {
      setSubmittingTheme(true);
      setError('');
      setSuccess('');
      
      await clubAPI.submitTheme(club.id, { themeText: newTheme.trim() });
      setNewTheme('');
      setShowThemeModal(false);
      setSuccess('Theme submitted successfully!');
      
      // Refresh themes if on themes tab
      if (activeTab === 'themes') {
        await fetchThemes();
      }
      
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (err) {
      setError(handleApiError(err, 'Failed to submit theme'));
    } finally {
      setSubmittingTheme(false);
    }
  };

  const handleNominateMovie = async () => {
    if (!selectedMovie || !currentCycle) return;

    try {
      setSubmittingNomination(true);
      setError('');
      setSuccess('');
      
      await cycleAPI.nominateMovie(currentCycle.id, {
        tmdbId: selectedMovie.id,
        title: selectedMovie.title,
        posterPath: selectedMovie.poster_path,
        releaseDate: selectedMovie.release_date,
        overview: selectedMovie.overview
      });
      
      setSelectedMovie(null);
      setShowNominationModal(false);
      setSuccess('Movie nominated successfully!');
      
      // Refresh cycle data
      await fetchClubData();
      
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (err) {
      setError(handleApiError(err, 'Failed to nominate movie'));
    } finally {
      setSubmittingNomination(false);
    }
  };

  const handleMarkWatched = async (movieId) => {
    try {
      await cycleAPI.updateWatchProgress(currentCycle.id, movieId, { watched: true });
      await fetchClubData(); // Refresh to get updated progress
    } catch (err) {
      setError(handleApiError(err, 'Failed to update watch status'));
    }
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    // FIXED: Use correct backend port
    const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
    return `${baseUrl}${imagePath}`;
  };

  const getTMDBImageUrl = (posterPath, size = 'w500') => {
    if (!posterPath) return null;
    return `https://image.tmdb.org/t/p/${size}${posterPath}`;
  };

  const canManageClub = () => {
    return club?.user_role === 'director' || club?.user_role === 'producer';
  };

  const canStartCycle = () => {
    return canManageClub() && (!currentCycle || currentCycle.phase === 'idle');
  };

  const canProgressPhase = () => {
    return canManageClub() && currentCycle && currentCycle.phase !== 'idle';
  };

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  if (loading) return <LoadingSpinner />;
  if (!club) return <div className="text-center py-8">Club not found</div>;
  // Tab rendering functions
  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Current Cycle Status */}
      <div className="bg-gray-900 rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-4">Current Status</h3>
        {currentCycle && currentCycle.phase !== 'idle' ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-lg font-medium">Cycle #{currentCycle.cycle_number}</h4>
                <p className="text-gray-300">Theme: {currentCycle.theme_text}</p>
              </div>
              <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm capitalize">
                {currentCycle.phase}
              </span>
            </div>
            
            {/* Phase-specific content */}
            {currentCycle.phase === 'nomination' && (
              <div className="mt-4">
                <p className="text-gray-400 mb-3">
                  Nominations: {currentCycle.nominations?.length || 0} / {currentCycle.total_members || 0}
                </p>
                <button
                  onClick={() => setShowNominationModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium transition-colors"
                >
                  Nominate a Movie
                </button>
              </div>
            )}
            
            {canProgressPhase() && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <button
                  onClick={handleProgressPhase}
                  className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded font-medium transition-colors"
                >
                  Progress to Next Phase
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <p className="text-gray-400 mb-4">No active cycle</p>
            {canStartCycle() && (
              <button
                onClick={handleStartCycle}
                className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded font-medium transition-colors"
              >
                Start New Cycle
              </button>
            )}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold">{club.member_count || 0}</div>
          <div className="text-sm text-gray-500">Active Members</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold">{club.total_cycles || 0}</div>
          <div className="text-sm text-gray-500">Completed Cycles</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold">{themes.filter(t => !t.is_used).length || '?'}</div>
          <div className="text-sm text-gray-500">Available Themes</div>
        </div>
      </div>
    </div>
  );

  const renderMembersTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Members ({members.length})</h3>
      </div>
      
      <div className="grid gap-4">
        {members.map(member => (
          <div key={member.id} className="bg-gray-900 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center">
                  {member.profile_picture ? (
                    <img 
                      src={getImageUrl(member.profile_picture)}
                      alt={member.display_name || member.username}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-medium">
                      {(member.display_name || member.username).charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <div className="font-medium text-white">{member.display_name || member.username}</div>
                  <div className="text-sm text-gray-400">@{member.username}</div>
                  <div className="text-xs text-gray-500">
                    Member since {new Date(member.joined_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`px-3 py-1 rounded-full text-xs font-medium text-white mb-2 ${
                  member.role === 'producer' ? 'bg-purple-600' :
                  member.role === 'director' ? 'bg-blue-600' : 'bg-gray-600'
                }`}>
                  {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                </div>
                <div className="text-sm text-gray-300">{member.cycles_won || 0} wins</div>
                <div className="text-xs text-gray-500">{Math.round(member.average_points || 0)} avg pts</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderThemesTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Theme Pool ({themes.length})</h3>
        <button
          onClick={() => setShowThemeModal(true)}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium transition-colors"
        >
          Submit Theme
        </button>
      </div>

      {themes.length > 0 ? (
        <div className="grid gap-3">
          {themes.map(theme => (
            <div 
              key={theme.id} 
              className={`p-4 rounded-lg border ${
                theme.is_used ? 'bg-gray-900 border-gray-600 opacity-60' : 'bg-gray-800 border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className={`${theme.is_used ? 'text-gray-400 line-through' : 'text-white'}`}>
                    {theme.theme_text}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Submitted by {theme.submitted_by_display_name || theme.submitted_by_username || 'Unknown'} on{' '}
                    {new Date(theme.created_at).toLocaleDateString()}
                  </p>
                </div>
                {theme.is_used && (
                  <span className="px-2 py-1 bg-gray-600 text-gray-300 rounded text-xs ml-3">
                    Used
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-400">No themes submitted yet. Be the first to add one!</p>
      )}
    </div>
  );

  // NEW: Stats tab rendering
  const renderStatsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Club Statistics</h3>
        <div className="text-sm text-gray-400">
          Season {clubStats?.season_year || new Date().getFullYear()}
        </div>
      </div>

      {clubStats ? (
        <div className="space-y-6">
          {/* Season Summary */}
          <div className="bg-gray-900 rounded-lg p-6">
            <h4 className="text-lg font-medium mb-4">Season Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">{clubStats.season_summary.total_members}</div>
                <div className="text-xs text-gray-500">Active Members</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{clubStats.season_summary.total_cycles}</div>
                <div className="text-xs text-gray-500">Completed Cycles</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">
                  {Math.round(clubStats.season_summary.average_participation * 10) / 10}
                </div>
                <div className="text-xs text-gray-500">Avg Participation</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">
                  {clubStats.user_stats.length > 0 ? 
                    Math.round(clubStats.user_stats.reduce((sum, user) => sum + user.average_guess_accuracy, 0) / clubStats.user_stats.length) : 0}%
                </div>
                <div className="text-xs text-gray-500">Avg Guess Accuracy</div>
              </div>
            </div>
          </div>

          {/* User Rankings */}
          <div className="bg-gray-900 rounded-lg p-6">
            <h4 className="text-lg font-medium mb-4">Season Rankings</h4>
            <div className="space-y-3">
              {clubStats.user_stats.map((userStat, index) => (
                <div key={userStat.user_id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 ? 'bg-yellow-600 text-yellow-100' :
                      index === 1 ? 'bg-gray-600 text-gray-100' :
                      index === 2 ? 'bg-amber-700 text-amber-100' :
                      'bg-gray-700 text-gray-300'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                      {userStat.profile_picture ? (
                        <img 
                          src={getImageUrl(userStat.profile_picture)}
                          alt={userStat.display_name || userStat.username}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-medium">
                          {(userStat.display_name || userStat.username).charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="font-medium">{userStat.display_name || userStat.username}</div>
                      <div className="text-sm text-gray-400">
                        {userStat.cycles_participated} cycles • {userStat.cycles_won} wins
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{Math.round(userStat.total_points)}</div>
                    <div className="text-sm text-gray-400">
                      {Math.round(userStat.average_points * 10) / 10} avg
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-sm">
                      🥇 {userStat.first_place_finishes} 
                    </div>
                    <div className="text-sm">
                      🎯 {Math.round(userStat.average_guess_accuracy)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-lg p-6 text-center">
          <p className="text-gray-400">Loading statistics...</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Navigation */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-gray-400 hover:text-white mb-4 inline-flex items-center transition-colors"
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-900/50 border border-red-600 text-red-200 p-4 rounded-lg mb-6 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={clearMessages} className="text-red-300 hover:text-red-100">×</button>
        </div>
      )}
      
      {success && (
        <div className="bg-green-900/50 border border-green-600 text-green-200 p-4 rounded-lg mb-6 flex justify-between items-center">
          <span>{success}</span>
          <button onClick={clearMessages} className="text-green-300 hover:text-green-100">×</button>
        </div>
      )}

      {/* Club Header */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <div className="flex items-start gap-6">
          <div className="flex-shrink-0">
            {club.club_picture ? (
              <img 
                src={getImageUrl(club.club_picture)}
                alt={club.name}
                className="w-24 h-24 rounded-lg object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div 
              className={`w-24 h-24 bg-gray-700 rounded-lg flex items-center justify-center ${club.club_picture ? 'hidden' : ''}`}
              style={{ display: club.club_picture ? 'none' : 'flex' }}
            >
              <span className="text-2xl font-bold text-gray-300">
                {club.name.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
          
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">{club.name}</h1>
                {club.description && (
                  <p className="text-gray-300 mb-4">{club.description}</p>
                )}
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span>{club.member_count} members</span>
                  <span>{club.total_cycles || 0} cycles completed</span>
                  <span className="capitalize">{club.user_role} role</span>
                </div>
              </div>
              
              {canManageClub() && (
                <button
                  onClick={() => navigate(`/club/${clubname}/settings`)}
                  className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm transition-colors"
                >
                  Settings
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-700 mb-6">
        <nav className="flex space-x-8">
          {['overview', 'members', 'themes', 'stats'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors capitalize ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'members' && renderMembersTab()}
        {activeTab === 'themes' && renderThemesTab()}
        {activeTab === 'stats' && renderStatsTab()}
      </div>

      {/* Nomination Modal */}
      {showNominationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Nominate a Movie</h2>
            <MovieSearch onSelect={setSelectedMovie} />
            
            {selectedMovie && (
              <div className="mt-4 bg-gray-900 rounded-lg p-4">
                <div className="flex gap-4">
                  {selectedMovie.poster_path && (
                    <img 
                      src={getTMDBImageUrl(selectedMovie.poster_path, 'w200')}
                      alt={selectedMovie.title}
                      className="w-24 rounded"
                    />
                  )}
                  <div>
                    <h3 className="font-medium">{selectedMovie.title}</h3>
                    <p className="text-sm text-gray-400">{selectedMovie.release_date?.split('-')[0]}</p>
                    <p className="text-sm text-gray-400 mt-2">{selectedMovie.overview}</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowNominationModal(false);
                  setSelectedMovie(null);
                }}
                className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleNominateMovie}
                disabled={!selectedMovie || submittingNomination}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed px-4 py-2 rounded font-medium transition-colors"
              >
                {submittingNomination ? 'Nominating...' : 'Nominate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Theme Modal */}
      {showThemeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Submit a Theme</h2>
            <p className="text-sm text-gray-400 mb-4">
              Themes should be broad enough for multiple movie choices but specific enough to be interesting.
            </p>
            <input
              type="text"
              value={newTheme}
              onChange={(e) => setNewTheme(e.target.value)}
              placeholder="e.g., Movies with plot twists"
              className="w-full bg-gray-900 border border-gray-700 px-3 py-2 rounded mb-4 focus:border-blue-500 focus:outline-none"
              maxLength={200}
            />
            <div className="text-sm text-gray-500 mb-4">{newTheme.length}/200 characters</div>
            
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowThemeModal(false);
                  setNewTheme('');
                }}
                className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitTheme}
                disabled={!newTheme.trim() || submittingTheme}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed px-4 py-2 rounded font-medium transition-colors"
              >
                {submittingTheme ? 'Submitting...' : 'Submit Theme'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClubPage;