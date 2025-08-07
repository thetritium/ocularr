import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api, { handleApiError } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import MovieSearch from '../components/MovieSearch';

const ClubPage = () => {
  const { clubname } = useParams(); // Using clubname from URL params
  const { user } = useAuth();
  const navigate = useNavigate();
  const [club, setClub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [members, setMembers] = useState([]);
  const [themes, setThemes] = useState([]);
  const [clubStats, setClubStats] = useState(null);
  const [showNominationModal, setShowNominationModal] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [newTheme, setNewTheme] = useState('');
  const [currentCycle, setCurrentCycle] = useState(null);
  const [nominations, setNominations] = useState([]);
  const [watchProgress, setWatchProgress] = useState([]);

  useEffect(() => {
    if (clubname) {
      fetchClubData();
    }
  }, [clubname]);

  const fetchClubData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Fetch club by name using the correct endpoint
      const response = await api.get(`/clubs/by-name/${clubname}`);
      setClub(response.data.club);
      
      // Fetch additional data based on active tab
      if (response.data.club.current_cycle) {
        fetchCycleData(response.data.club.current_cycle.id);
      }
    } catch (err) {
      console.error('Error fetching club:', err);
      setError(handleApiError(err, 'Failed to load club'));
      // Don't automatically navigate away - let user see the error
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const response = await api.get(`/clubs/${club.id}/members`);
      setMembers(response.data.members);
    } catch (err) {
      console.error('Error fetching members:', err);
    }
  };

  const fetchThemes = async () => {
    try {
      const response = await api.get(`/clubs/${club.id}/themes`);
      setThemes(response.data.themes);
    } catch (err) {
      console.error('Error fetching themes:', err);
    }
  };

  const fetchClubStats = async () => {
    try {
      const response = await api.get(`/clubs/${club.id}/stats`);
      setClubStats(response.data);
    } catch (err) {
      console.error('Error fetching club stats:', err);
    }
  };

  const fetchCycleData = async (cycleId) => {
    try {
      const response = await api.get(`/cycles/${club.id}/current`);
      if (response.data.cycle) {
        setCurrentCycle(response.data.cycle);
        setNominations(response.data.cycle.nominations || []);
        setWatchProgress(response.data.cycle.user_progress || []);
      }
    } catch (err) {
      console.error('Error fetching cycle data:', err);
    }
  };

  const handleStartCycle = async () => {
    try {
      await api.post(`/cycles/${club.id}/start`);
      await fetchClubData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to start cycle');
    }
  };

  const handleProgressPhase = async () => {
    try {
      await api.put(`/cycles/${currentCycle.id}/phase`, { action: 'next' });
      await fetchClubData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to progress phase');
    }
  };

  const handleNominate = async () => {
    if (!selectedMovie) return;
    
    try {
      await api.post(`/cycles/${currentCycle.id}/nominate`, {
        tmdbId: selectedMovie.id,
        title: selectedMovie.title,
        posterPath: selectedMovie.poster_path,
        overview: selectedMovie.overview,
        releaseDate: selectedMovie.release_date
      });
      setShowNominationModal(false);
      setSelectedMovie(null);
      await fetchCycleData(currentCycle.id);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to nominate movie');
    }
  };

  const handleAddTheme = async () => {
    if (!newTheme.trim()) return;
    
    try {
      await api.post(`/clubs/${club.id}/themes`, {
        themeText: newTheme
      });
      setShowThemeModal(false);
      setNewTheme('');
      await fetchThemes();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add theme');
    }
  };

  const handleMarkWatched = async (movieId) => {
    try {
      await api.put(`/cycles/${currentCycle.id}/watch/${movieId}`, { watched: true });
      await fetchCycleData(currentCycle.id);
    } catch (err) {
      alert('Failed to update watch status');
    }
  };

  const handleLeaveClub = async () => {
    if (!window.confirm('Are you sure you want to leave this club?')) return;
    
    try {
      await api.post(`/clubs/${club.id}/leave`);
      navigate('/dashboard');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to leave club');
    }
  };

  // Get image URL using nginx proxy
  const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    // Use relative path - nginx will proxy to backend
    return imagePath;
  };

  useEffect(() => {
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
  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button 
            onClick={() => navigate('/dashboard')}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400 mb-4">Club not found</p>
          <button 
            onClick={() => navigate('/dashboard')}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const canManageClub = club.user_role === 'director' || club.user_role === 'producer';
  const canStartCycle = canManageClub && (!currentCycle || currentCycle.phase === 'idle');
  const canProgressPhase = canManageClub && currentCycle && currentCycle.phase !== 'idle';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Error Message */}
      {error && (
        <div className="bg-red-900/50 border border-red-600 text-red-200 p-4 rounded-lg mb-6">
          {error}
          <button
            onClick={fetchClubData}
            className="ml-4 text-red-300 hover:text-red-100 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Club Header */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <div className="flex items-start gap-6">
          {club.club_picture ? (
            <img 
              src={getImageUrl(club.club_picture)}
              alt={club.name}
              className="w-32 h-32 rounded-lg object-cover"
            />
          ) : (
            <div className="w-32 h-32 bg-gray-700 rounded-lg flex items-center justify-center">
              <span className="text-4xl font-bold text-gray-500">
                {club.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">{club.name}</h1>
            {club.description && (
              <p className="text-gray-400 mb-4">{club.description}</p>
            )}
            
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-gray-500">Members:</span>
                <span className="ml-2 font-medium">{club.member_count || 0}</span>
              </div>
              <div>
                <span className="text-gray-500">Total Cycles:</span>
                <span className="ml-2 font-medium">{club.total_cycles || 0}</span>
              </div>
              <div>
                <span className="text-gray-500">Your Role:</span>
                <span className="ml-2 font-medium capitalize">{club.user_role}</span>
              </div>
              {club.invite_code && canManageClub && (
                <div>
                  <span className="text-gray-500">Invite Code:</span>
                  <span className="ml-2 font-mono font-medium bg-gray-700 px-2 py-1 rounded">
                    {club.invite_code}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            {canStartCycle && (
              <button 
                onClick={handleStartCycle}
                className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded font-medium transition-colors"
              >
                Start New Cycle
              </button>
            )}
            {canProgressPhase && (
              <button 
                onClick={handleProgressPhase}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium transition-colors"
              >
                Next Phase
              </button>
            )}
            {canManageClub && (
              <button 
                onClick={() => navigate(`/club/${clubname}/settings`)}
                className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded font-medium transition-colors"
              >
                Settings
              </button>
            )}
            {club.user_role === 'critic' && (
              <button 
                onClick={handleLeaveClub}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-medium transition-colors"
              >
                Leave Club
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-800 rounded-lg">
        <div className="border-b border-gray-700">
          <nav className="flex -mb-px">
            {['overview', 'current-cycle', 'members', 'themes', 'stats', 'history'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 border-b-2 font-medium text-sm capitalize transition-colors ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-500'
                    : 'border-transparent text-gray-400 hover:text-white hover:border-gray-300'
                }`}
              >
                {tab.replace('-', ' ')}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Club Overview</h2>
              {currentCycle && currentCycle.phase !== 'idle' ? (
                <div className="bg-gray-900 rounded-lg p-4 mb-4">
                  <h3 className="font-medium mb-2">Current Cycle</h3>
                  <p className="text-gray-400">Theme: {currentCycle.theme_text}</p>
                  <p className="text-gray-400">Phase: <span className="capitalize">{currentCycle.phase}</span></p>
                  <p className="text-gray-400">Started: {new Date(currentCycle.started_at).toLocaleDateString()}</p>
                </div>
              ) : (
                <p className="text-gray-500">No active cycle. {canManageClub ? 'Start a new cycle to begin!' : 'Waiting for a director to start a new cycle.'}</p>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
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
          )}

          {/* Current Cycle Tab */}
          {activeTab === 'current-cycle' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Current Cycle</h2>
              {currentCycle && currentCycle.phase !== 'idle' ? (
                <div>
                  <div className="bg-gray-900 rounded-lg p-4 mb-6">
                    <h3 className="text-lg font-medium mb-2">{currentCycle.theme_text}</h3>
                    <div className="flex gap-4 text-sm text-gray-400">
                      <span>Phase: <span className="capitalize text-white">{currentCycle.phase}</span></span>
                      <span>Cycle #{currentCycle.cycle_number}</span>
                    </div>
                  </div>

                  {/* Nomination Phase */}
                  {currentCycle.phase === 'nomination' && (
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-medium">Nominations</h3>
                        {!nominations.find(n => n.user_id === user.id) && (
                          <button 
                            onClick={() => setShowNominationModal(true)}
                            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm font-medium"
                          >
                            Nominate a Movie
                          </button>
                        )}
                      </div>
                      
                      {nominations.length === 0 ? (
                        <p className="text-gray-500">No nominations yet. Be the first!</p>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {nominations.map(nom => (
                            <div key={nom.id} className="bg-gray-900 rounded-lg p-3">
                              <div className="text-sm font-medium mb-1">
                                {nom.user_id === user.id ? 'Your Nomination' : 'Nominated'}
                              </div>
                              <div className="text-xs text-gray-500">Hidden until watching phase</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Watching Phase */}
                  {currentCycle.phase === 'watching' && (
                    <div>
                      <h3 className="font-medium mb-4">Movies to Watch</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {nominations.map(nom => {
                          const watched = watchProgress.find(w => w.nomination_id === nom.id)?.watched;
                          
                          return (
                            <div key={nom.id} className="bg-gray-900 rounded-lg overflow-hidden">
                              {nom.poster_path && (
                                <img 
                                  src={`https://image.tmdb.org/t/p/w200${nom.poster_path}`}
                                  alt={nom.title}
                                  className="w-full"
                                />
                              )}
                              <div className="p-3">
                                <h4 className="font-medium text-sm mb-2">{nom.title}</h4>
                                {nom.user_id === user.id ? (
                                  <span className="text-xs text-blue-500">Your nomination</span>
                                ) : (
                                  <button
                                    onClick={() => handleMarkWatched(nom.id)}
                                    className={`w-full text-xs py-1 px-2 rounded ${
                                      watched 
                                        ? 'bg-green-600 text-white' 
                                        : 'bg-gray-700 hover:bg-gray-600'
                                    }`}
                                  >
                                    {watched ? '✓ Watched' : 'Mark Watched'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Ranking Phase */}
                  {currentCycle.phase === 'ranking' && (
                    <div>
                      <h3 className="font-medium mb-4">Time to Rank!</h3>
                      <button 
                        onClick={() => navigate(`/club/${clubname}/ranking`)}
                        className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded font-medium"
                      >
                        Submit Your Rankings
                      </button>
                    </div>
                  )}

                  {/* Results Phase */}
                  {currentCycle.phase === 'results' && (
                    <div>
                      <h3 className="font-medium mb-4">Cycle Results</h3>
                      <button 
                        onClick={() => navigate(`/club/${clubname}/results/${currentCycle.id}`)}
                        className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded font-medium"
                      >
                        View Results
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500">No active cycle.</p>
              )}
            </div>
          )}
          {/* Members Tab */}
          {activeTab === 'members' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Members ({members.length})</h2>
              <div className="space-y-3">
                {members.map(member => (
                  <div key={member.id} className="bg-gray-900 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {member.profile_picture ? (
                        <img 
                          src={getImageUrl(member.profile_picture)}
                          alt={member.display_name || member.username}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                          <span className="font-medium">
                            {(member.display_name || member.username).charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <div className="font-medium">{member.display_name || member.username}</div>
                        <div className="text-sm text-gray-500 capitalize">{member.role}</div>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="text-gray-400">Avg Points: {parseFloat(member.average_points || 0).toFixed(1)}</div>
                      <div className="text-gray-400">Wins: {member.cycles_won || 0}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Themes Tab */}
          {activeTab === 'themes' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Theme Pool</h2>
                <button 
                  onClick={() => setShowThemeModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm font-medium"
                >
                  Submit Theme
                </button>
              </div>
              
              <div className="space-y-2">
                {themes.length === 0 ? (
                  <p className="text-gray-500">No themes yet. Submit one!</p>
                ) : (
                  themes.map(theme => (
                    <div 
                      key={theme.id} 
                      className={`bg-gray-900 rounded-lg p-3 ${theme.is_used ? 'opacity-50' : ''}`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{theme.theme_text}</p>
                          <p className="text-sm text-gray-500 mt-1">
                            Submitted by {theme.submitted_by_display_name || theme.submitted_by_username}
                          </p>
                        </div>
                        {theme.is_used && (
                          <span className="text-xs bg-gray-700 px-2 py-1 rounded">Used</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Stats Tab with Enhanced User Table */}
          {activeTab === 'stats' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Club Statistics</h2>
              
              {/* Season Stats Table */}
              <div className="bg-gray-900 rounded-lg p-6">
                <h3 className="text-lg font-medium mb-4">Season Leaderboard</h3>
                
                {clubStats && clubStats.seasonStats && clubStats.seasonStats.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left py-3 px-4 cursor-pointer hover:text-blue-400">
                            Rank
                          </th>
                          <th className="text-left py-3 px-4 cursor-pointer hover:text-blue-400">
                            Player
                          </th>
                          <th className="text-left py-3 px-4 cursor-pointer hover:text-blue-400">
                            Points
                          </th>
                          <th className="text-left py-3 px-4 cursor-pointer hover:text-blue-400">
                            Avg Points
                          </th>
                          <th className="text-left py-3 px-4 cursor-pointer hover:text-blue-400">
                            Cycles
                          </th>
                          <th className="text-left py-3 px-4 cursor-pointer hover:text-blue-400">
                            Wins
                          </th>
                          <th className="text-left py-3 px-4 cursor-pointer hover:text-blue-400">
                            Win Rate
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {clubStats.seasonStats
                          .sort((a, b) => parseFloat(b.total_points) - parseFloat(a.total_points))
                          .map((stat, index) => (
                            <tr key={stat.user_id} className={`border-b border-gray-800 hover:bg-gray-800 ${stat.user_id === user.id ? 'bg-blue-900/20' : ''}`}>
                              <td className="py-3 px-4">
                                <span className={`font-medium ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-orange-600' : ''}`}>
                                  #{index + 1}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  {stat.profile_picture ? (
                                    <img 
                                      src={getImageUrl(stat.profile_picture)}
                                      alt={stat.display_name || stat.username}
                                      className="w-6 h-6 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center">
                                      <span className="text-xs font-medium">
                                        {(stat.display_name || stat.username).charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                  )}
                                  <span className={`font-medium ${stat.user_id === user.id ? 'text-blue-400' : ''}`}>
                                    {stat.display_name || stat.username}
                                    {stat.user_id === user.id && <span className="text-xs text-blue-400 ml-1">(You)</span>}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-4 font-medium">{Math.round(parseFloat(stat.total_points || 0))}</td>
                              <td className="py-3 px-4">{parseFloat(stat.average_points || 0).toFixed(1)}</td>
                              <td className="py-3 px-4">{stat.cycles_participated || 0}</td>
                              <td className="py-3 px-4">{stat.cycles_won || 0}</td>
                              <td className="py-3 px-4">
                                {stat.cycles_participated > 0 
                                  ? `${Math.round((stat.cycles_won / stat.cycles_participated) * 100)}%`
                                  : '0%'
                                }
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No season statistics available yet. Complete some cycles to see stats!</p>
                )}
              </div>

              {/* Overall Club Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div className="bg-gray-900 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-500">{clubStats?.totalCycles || club.total_cycles || 0}</div>
                  <div className="text-sm text-gray-500">Total Cycles</div>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-500">{clubStats?.totalMovies || 0}</div>
                  <div className="text-sm text-gray-500">Movies Watched</div>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-500">{club.member_count || 0}</div>
                  <div className="text-sm text-gray-500">Active Members</div>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-500">{themes.filter(t => !t.is_used).length || 0}</div>
                  <div className="text-sm text-gray-500">Available Themes</div>
                </div>
              </div>
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Cycle History</h2>
              <p className="text-gray-500">Coming soon...</p>
            </div>
          )}
        </div>
      </div>

      {/* Nomination Modal */}
      {showNominationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Nominate a Movie</h2>
            <MovieSearch onSelectMovie={setSelectedMovie} />
            
            {selectedMovie && (
              <div className="mt-4 bg-gray-900 rounded-lg p-4">
                <div className="flex gap-4">
                  {selectedMovie.poster_path && (
                    <img 
                      src={`https://image.tmdb.org/t/p/w200${selectedMovie.poster_path}`}
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
                className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleNominate}
                disabled={!selectedMovie}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed px-4 py-2 rounded font-medium"
              >
                Nominate
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
              className="w-full bg-gray-900 px-3 py-2 rounded mb-4"
              maxLength={200}
            />
            <div className="text-sm text-gray-500 mb-4">{newTheme.length}/200 characters</div>
            
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowThemeModal(false);
                  setNewTheme('');
                }}
                className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTheme}
                disabled={!newTheme.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed px-4 py-2 rounded font-medium"
              >
                Submit Theme
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClubPage;