import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { clubAPI, cycleAPI, handleApiError } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import MovieSearch from '../components/MovieSearch';

const ClubPage = () => {
  const { clubId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  // State management
  const [club, setClub] = useState(null);
  const [currentCycle, setCurrentCycle] = useState(null);
  const [members, setMembers] = useState([]);
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Active tab state
  const [activeTab, setActiveTab] = useState('cycle');
  
  // Form states
  const [newTheme, setNewTheme] = useState('');
  const [submittingTheme, setSubmittingTheme] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [submittingNomination, setSubmittingNomination] = useState(false);
  const [progressingPhase, setProgressingPhase] = useState(false);
  const [startingCycle, setStartingCycle] = useState(false);
  
  // Ranking state
  const [rankings, setRankings] = useState([]);
  const [guesses, setGuesses] = useState([]);
  const [submittingRankings, setSubmittingRankings] = useState(false);

  // Initialize from location state
  useEffect(() => {
    if (location.state?.message) {
      setSuccess(location.state.message);
      // Clear the message from location state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Fetch initial data
  useEffect(() => {
    if (clubId) {
      fetchClubData();
    }
  }, [clubId]);

  const fetchClubData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [clubResponse, cycleResponse, membersResponse, themesResponse] = await Promise.all([
        clubAPI.getClubDetails(clubId),
        cycleAPI.getCurrentCycle(clubId),
        clubAPI.getClubMembers(clubId),
        clubAPI.getClubThemes(clubId)
      ]);
      
      setClub(clubResponse.data.club);
      setCurrentCycle(cycleResponse.data.cycle);
      setMembers(membersResponse.data.members);
      setThemes(themesResponse.data.themes);
      
      // Initialize rankings and guesses if in ranking phase
      if (cycleResponse.data.cycle?.phase === 'ranking') {
        initializeRankingData(cycleResponse.data.cycle);
      }
    } catch (error) {
      console.error('Failed to fetch club data:', error);
      setError(handleApiError(error, 'Failed to load club data'));
      
      // If club not found or no access, redirect to dashboard
      if (error.response?.status === 404 || error.response?.status === 403) {
        setTimeout(() => navigate('/dashboard'), 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  const initializeRankingData = (cycle) => {
    if (!cycle?.nominations) return;
    
    // Filter out user's own nomination for ranking
    const otherNominations = cycle.nominations.filter(nom => nom.user_id !== user.id);
    
    // Initialize rankings with empty positions
    const initialRankings = otherNominations.map(nom => ({
      nominationId: nom.id,
      rankPosition: 0
    }));
    
    // Initialize guesses
    const initialGuesses = cycle.nominations.map(nom => ({
      nominationId: nom.id,
      guessedNominatorId: null
    }));
    
    setRankings(initialRankings);
    setGuesses(initialGuesses);
  };

  // Helper functions
  const canManageCycles = () => {
    return club?.user_role === 'director' || club?.user_role === 'producer';
  };

  const canManageClub = () => {
    return club?.user_role === 'producer';
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
// Action handlers
  const handleStartCycle = async () => {
    if (!canManageCycles()) return;
    
    setStartingCycle(true);
    setError('');
    setSuccess('');
    
    try {
      const response = await cycleAPI.startCycle(clubId);
      setSuccess('New cycle started successfully!');
      fetchClubData(); // Refresh data
    } catch (error) {
      setError(handleApiError(error, 'Failed to start cycle'));
    } finally {
      setStartingCycle(false);
    }
  };

  const handleProgressPhase = async (action) => {
    if (!canManageCycles() || !currentCycle) return;
    
    setProgressingPhase(true);
    setError('');
    setSuccess('');
    
    try {
      const response = await cycleAPI.updateCyclePhase(currentCycle.id, action);
      setSuccess(`Cycle phase updated to ${response.data.phase}`);
      fetchClubData(); // Refresh data
    } catch (error) {
      setError(handleApiError(error, 'Failed to update cycle phase'));
    } finally {
      setProgressingPhase(false);
    }
  };

  const handleSubmitTheme = async (e) => {
    e.preventDefault();
    
    if (!newTheme.trim()) return;
    
    setSubmittingTheme(true);
    setError('');
    setSuccess('');
    
    try {
      await clubAPI.submitTheme(clubId, newTheme.trim());
      setSuccess('Theme submitted successfully!');
      setNewTheme('');
      fetchClubData(); // Refresh themes
    } catch (error) {
      setError(handleApiError(error, 'Failed to submit theme'));
    } finally {
      setSubmittingTheme(false);
    }
  };

  const handleSubmitNomination = async () => {
    if (!selectedMovie || !currentCycle) return;
    
    setSubmittingNomination(true);
    setError('');
    setSuccess('');
    
    try {
      const movieData = {
        tmdbMovieId: selectedMovie.id,
        title: selectedMovie.title,
        year: selectedMovie.year,
        posterPath: selectedMovie.posterPath,
        overview: selectedMovie.overview,
        genreIds: selectedMovie.genreIds,
        director: selectedMovie.director,
        runtime: selectedMovie.runtime
      };
      
      await cycleAPI.submitNomination(currentCycle.id, movieData);
      setSuccess('Movie nominated successfully!');
      setSelectedMovie(null);
      fetchClubData(); // Refresh cycle data
    } catch (error) {
      setError(handleApiError(error, 'Failed to submit nomination'));
    } finally {
      setSubmittingNomination(false);
    }
  };

  const handleWatchProgress = async (movieId, watched) => {
    if (!currentCycle) return;
    
    try {
      await cycleAPI.updateWatchProgress(currentCycle.id, movieId, { watched });
      fetchClubData(); // Refresh to update watch progress
    } catch (error) {
      console.error('Failed to update watch progress:', error);
      setError(handleApiError(error, 'Failed to update watch progress'));
    }
  };

  const handleRankingChange = (nominationId, rankPosition) => {
    setRankings(prev => prev.map(ranking => 
      ranking.nominationId === nominationId 
        ? { ...ranking, rankPosition: parseInt(rankPosition) }
        : ranking
    ));
  };

  const handleGuessChange = (nominationId, guessedNominatorId) => {
    setGuesses(prev => prev.map(guess => 
      guess.nominationId === nominationId 
        ? { ...guess, guessedNominatorId: parseInt(guessedNominatorId) }
        : guess
    ));
  };

  const handleSubmitRankings = async () => {
    if (!currentCycle) return;
    
    // Validate rankings - ensure all positions are filled and unique
    const filledRankings = rankings.filter(r => r.rankPosition > 0);
    const rankPositions = filledRankings.map(r => r.rankPosition);
    const uniquePositions = new Set(rankPositions);
    
    if (filledRankings.length !== rankings.length) {
      setError('Please rank all movies');
      return;
    }
    
    if (uniquePositions.size !== rankPositions.length) {
      setError('Each movie must have a unique rank position');
      return;
    }
    
    setSubmittingRankings(true);
    setError('');
    setSuccess('');
    
    try {
      await cycleAPI.submitRankings(currentCycle.id, {
        rankings: filledRankings,
        guesses: guesses.filter(g => g.guessedNominatorId !== null)
      });
      
      setSuccess('Rankings submitted successfully!');
      fetchClubData(); // Refresh data
    } catch (error) {
      setError(handleApiError(error, 'Failed to submit rankings'));
    } finally {
      setSubmittingRankings(false);
    }
  };
// UI Helper functions
  const getUserProgress = (nominationId) => {
    return currentCycle?.user_progress?.find(p => p.nomination_id === nominationId);
  };

  const hasUserNominated = () => {
    return currentCycle?.nominations?.some(nom => nom.user_id === user.id);
  };

  const getUserNomination = () => {
    return currentCycle?.nominations?.find(nom => nom.user_id === user.id);
  };

  const getWatchedCount = (nominationId) => {
    // This would need additional API data - placeholder for now
    return 0;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <LoadingSpinner size="lg" text="Loading club..." />
      </div>
    );
  }

  if (error && !club) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="card p-8 text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-xl font-semibold text-gray-100 mb-2">
            Unable to Load Club
          </h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-primary"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Club Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-100 truncate">
                {club?.name}
              </h1>
              <span className="text-lg">
                {getRoleIcon(club?.user_role)} {club?.user_role}
              </span>
            </div>
            {club?.description && (
              <p className="text-gray-400 text-lg">{club.description}</p>
            )}
            <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
              <span>👥 {club?.member_count} members</span>
              <span>🎬 {club?.total_cycles} cycles</span>
              <span>📅 Created {new Date(club?.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          {club?.club_picture && (
            <img
              src={club.club_picture}
              alt={club.name}
              className="w-20 h-20 rounded-xl object-cover flex-shrink-0 ml-6"
            />
          )}
        </div>

        {/* Current Cycle Status */}
        {currentCycle ? (
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPhaseColor(currentCycle.phase)}`}
                >
                  {getPhaseIcon(currentCycle.phase)} {currentCycle.phase.charAt(0).toUpperCase() + currentCycle.phase.slice(1)} Phase
                </span>
                <div className="text-sm text-gray-400">
                  <strong>Theme:</strong> {currentCycle.theme_text}
                </div>
                <div className="text-sm text-gray-400">
                  Cycle #{currentCycle.cycle_number}
                </div>
              </div>
              
              {canManageCycles() && (
                <div className="flex space-x-2">
                  {currentCycle.phase !== 'idle' && (
                    <button
                      onClick={() => handleProgressPhase('previous')}
                      disabled={progressingPhase || currentCycle.phase === 'nomination'}
                      className="btn-secondary btn-sm"
                    >
                      ← Previous
                    </button>
                  )}
                  <button
                    onClick={() => handleProgressPhase('next')}
                    disabled={progressingPhase}
                    className="btn-primary btn-sm"
                  >
                    {progressingPhase ? 'Updating...' : 'Next Phase →'}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card p-6 text-center">
            <div className="text-4xl mb-3">😴</div>
            <h3 className="text-lg font-semibold text-gray-100 mb-2">No Active Cycle</h3>
            <p className="text-gray-400 mb-4">
              {canManageCycles() 
                ? 'Start a new movie cycle to begin the fun!'
                : 'Waiting for a director or producer to start the next cycle.'
              }
            </p>
            {canManageCycles() && (
              <button
                onClick={handleStartCycle}
                disabled={startingCycle || themes.filter(t => !t.is_used).length === 0}
                className="btn-primary"
              >
                {startingCycle ? (
                  <div className="flex items-center">
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Starting Cycle...</span>
                  </div>
                ) : (
                  '🎬 Start New Cycle'
                )}
              </button>
            )}
            {themes.filter(t => !t.is_used).length === 0 && (
              <p className="text-red-400 text-sm mt-2">
                No unused themes available. Add themes to the pool first.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-900/50 border border-red-600 text-red-200 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-900/50 border border-green-600 text-green-200 p-4 rounded-lg mb-6">
          {success}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-gray-700 mb-8">
        <nav className="-mb-px flex space-x-8">
          {['cycle', 'members', 'themes'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab
                  ? 'border-primary-500 text-primary-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              {tab === 'cycle' && '🎬 Current Cycle'}
              {tab === 'members' && '👥 Members'}
              {tab === 'themes' && '💡 Theme Pool'}
            </button>
          ))}
        </nav>
      </div>
{/* Tab Content */}
      {activeTab === 'cycle' && currentCycle && (
        <div className="space-y-6">
          {/* Nomination Phase */}
          {currentCycle.phase === 'nomination' && (
            <div className="card p-6">
              <h3 className="text-xl font-semibold text-gray-100 mb-4">
                📝 Nomination Phase
              </h3>
              <p className="text-gray-400 mb-6">
                <strong>Theme:</strong> {currentCycle.theme_text}
              </p>
              
              {!hasUserNominated() ? (
                <div>
                  <h4 className="text-lg font-medium text-gray-200 mb-4">Submit Your Nomination</h4>
                  <MovieSearch
                    onSelectMovie={setSelectedMovie}
                    selectedMovie={selectedMovie}
                    placeholder="Search for a movie that fits the theme..."
                  />
                  
                  {selectedMovie && (
                    <div className="mt-4">
                      <button
                        onClick={handleSubmitNomination}
                        disabled={submittingNomination}
                        className="btn-primary"
                      >
                        {submittingNomination ? (
                          <div className="flex items-center">
                            <LoadingSpinner size="sm" />
                            <span className="ml-2">Submitting...</span>
                          </div>
                        ) : (
                          'Submit Nomination'
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-green-900/20 border border-green-800 rounded-lg p-4">
                  <h4 className="text-green-300 font-medium mb-2">✅ Your Nomination</h4>
                  <div className="flex items-start space-x-4">
                    {getUserNomination()?.poster_path && (
                      <img
                        src={getUserNomination().poster_path}
                        alt={getUserNomination().title}
                        className="w-16 h-24 object-cover rounded movie-poster"
                      />
                    )}
                    <div>
                      <h5 className="font-medium text-gray-200">{getUserNomination()?.title}</h5>
                      {getUserNomination()?.year && (
                        <p className="text-sm text-gray-400">{getUserNomination().year}</p>
                      )}
                      <p className="text-green-400 text-sm">Nomination submitted successfully!</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Current Nominations */}
              {currentCycle.nominations?.length > 0 && (
                <div className="mt-8">
                  <h4 className="text-lg font-medium text-gray-200 mb-4">
                    Current Nominations ({currentCycle.nominations.length}/{currentCycle.total_members})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {currentCycle.nominations.map((nomination) => (
                      <div key={nomination.id} className="bg-gray-700 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                          {nomination.poster_path && (
                            <img
                              src={nomination.poster_path}
                              alt={nomination.title}
                              className="w-12 h-18 object-cover rounded flex-shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <h5 className="font-medium text-gray-200 truncate">{nomination.title}</h5>
                            {nomination.year && (
                              <p className="text-sm text-gray-400">{nomination.year}</p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                              By {nomination.user_id === user.id ? 'You' : 'Anonymous'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Watching Phase */}
          {currentCycle.phase === 'watching' && (
            <div className="card p-6">
              <h3 className="text-xl font-semibold text-gray-100 mb-4">
                👀 Watching Phase
              </h3>
              <p className="text-gray-400 mb-6">
                Watch all nominated movies and mark them as watched. Your own nomination is automatically marked as watched.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentCycle.nominations?.map((nomination) => {
                  const progress = getUserProgress(nomination.id);
                  const isOwnNomination = nomination.user_id === user.id;
                  
                  return (
                    <div key={nomination.id} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex items-start space-x-4">
                        {nomination.poster_path && (
                          <img
                            src={nomination.poster_path}
                            alt={nomination.title}
                            className="w-16 h-24 object-cover rounded movie-poster flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h5 className="font-medium text-gray-200 mb-1">{nomination.title}</h5>
                          {nomination.year && (
                            <p className="text-sm text-gray-400 mb-2">{nomination.year}</p>
                          )}
                          {nomination.director && (
                            <p className="text-xs text-gray-500 mb-2">Dir: {nomination.director}</p>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={progress?.watched || isOwnNomination}
                                onChange={(e) => handleWatchProgress(nomination.id, e.target.checked)}
                                disabled={isOwnNomination}
                                className="w-4 h-4 text-primary-600 bg-gray-600 border-gray-500 rounded focus:ring-primary-500"
                              />
                              <span className="ml-2 text-sm text-gray-300">
                                {isOwnNomination ? 'Your nomination' : 'Watched'}
                              </span>
                            </label>
                            
                            {(progress?.watched || isOwnNomination) && (
                              <span className="text-green-400 text-sm">✅</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ranking Phase */}
          {currentCycle.phase === 'ranking' && (
            <div className="card p-6">
              <h3 className="text-xl font-semibold text-gray-100 mb-4">
                🎯 Ranking Phase
              </h3>
              <p className="text-gray-400 mb-6">
                Guess who nominated each movie and rank the movies you didn't nominate from best to worst.
              </p>
              
              <div className="space-y-6">
                {currentCycle.nominations?.filter(nom => nom.user_id !== user.id).map((nomination, index) => {
                  const ranking = rankings.find(r => r.nominationId === nomination.id);
                  const guess = guesses.find(g => g.nominationId === nomination.id);
                  
                  return (
                    <div key={nomination.id} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex items-start space-x-4">
                        {nomination.poster_path && (
                          <img
                            src={nomination.poster_path}
                            alt={nomination.title}
                            className="w-20 h-30 object-cover rounded movie-poster flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 space-y-4">
                          <div>
                            <h5 className="font-medium text-gray-200 mb-1">{nomination.title}</h5>
                            {nomination.year && (
                              <p className="text-sm text-gray-400">{nomination.year}</p>
                            )}
                            {nomination.overview && (
                              <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                                {nomination.overview}
                              </p>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Guess who nominated */}
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">
                                Who nominated this?
                              </label>
                              <select
                                value={guess?.guessedNominatorId || ''}
                                onChange={(e) => handleGuessChange(nomination.id, e.target.value)}
                                className="input"
                              >
                                <option value="">Select member...</option>
                                {members.filter(m => m.id !== user.id).map(member => (
                                  <option key={member.id} value={member.id}>
                                    {member.display_name || member.username}
                                  </option>
                                ))}
                              </select>
                            </div>
                            
                            {/* Rank this movie */}
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">
                                Your ranking (1 = best)
                              </label>
                              <select
                                value={ranking?.rankPosition || ''}
                                onChange={(e) => handleRankingChange(nomination.id, e.target.value)}
                                className="input"
                              >
                                <option value="">Select rank...</option>
                                {Array.from({ length: currentCycle.nominations.length - 1 }, (_, i) => (
                                  <option key={i + 1} value={i + 1}>
                                    {i + 1}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {/* Submit Rankings Button */}
                <div className="text-center pt-4">
                  <button
                    onClick={handleSubmitRankings}
                    disabled={submittingRankings}
                    className="btn-primary btn-lg"
                  >
                    {submittingRankings ? (
                      <div className="flex items-center">
                        <LoadingSpinner size="sm" />
                        <span className="ml-2">Submitting Rankings...</span>
                      </div>
                    ) : (
                      'Submit Rankings & Guesses'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Results Phase */}
          {currentCycle.phase === 'results' && (
            <div className="card p-6">
              <h3 className="text-xl font-semibold text-gray-100 mb-4">
                🏆 Results
              </h3>
              <p className="text-gray-400 mb-6">
                See how movies were ranked and who earned the most points this cycle!
              </p>
              
              <div className="text-center py-8">
                <div className="text-6xl mb-4">🏆</div>
                <p className="text-gray-400">
                  Results calculation and display coming soon...
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div className="card p-6">
          <h3 className="text-xl font-semibold text-gray-100 mb-6">
            👥 Club Members ({members.length})
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map((member) => (
              <div key={member.id} className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  {member.profile_picture ? (
                    <img
                      src={member.profile_picture}
                      alt={member.username}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center">
                      <span className="text-lg">👤</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-200 truncate">
                      {member.display_name || member.username}
                    </h4>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-400">
                        {getRoleIcon(member.role)} {member.role}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      <div>🏆 {member.cycles_won} wins</div>
                      <div>📊 {parseFloat(member.average_points || 0).toFixed(1)} avg pts</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Themes Tab */}
      {activeTab === 'themes' && (
        <div className="space-y-6">
          {/* Submit New Theme */}
          <div className="card p-6">
            <h3 className="text-xl font-semibold text-gray-100 mb-4">
              💡 Submit New Theme
            </h3>
            <form onSubmit={handleSubmitTheme} className="flex gap-3">
              <input
                type="text"
                value={newTheme}
                onChange={(e) => setNewTheme(e.target.value)}
                placeholder="Enter a movie theme (e.g., 'Movies with time travel')"
                className="input flex-1"
                maxLength={200}
                disabled={submittingTheme}
              />
              <button
                type="submit"
                disabled={!newTheme.trim() || submittingTheme}
                className="btn-primary"
              >
                {submittingTheme ? 'Adding...' : 'Add Theme'}
              </button>
            </form>
            <p className="text-xs text-gray-500 mt-2">
              {newTheme.length}/200 characters
            </p>
          </div>

          {/* Theme Pool */}
          <div className="card p-6">
            <h3 className="text-xl font-semibold text-gray-100 mb-4">
              Theme Pool ({themes.length} total, {themes.filter(t => !t.is_used).length} unused)
            </h3>
            
            <div className="space-y-3">
              {themes.map((theme) => (
                <div
                  key={theme.id}
                  className={`p-3 rounded-lg border ${
                    theme.is_used
                      ? 'bg-gray-700 border-gray-600 opacity-60'
                      : 'bg-gray-700 border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-gray-200">{theme.theme_text}</p>
                      <div className="flex items-center space-x-3 mt-1 text-xs text-gray-500">
                        <span>
                          By {theme.submitted_by_display_name || theme.submitted_by_username || 'Unknown'}
                        </span>
                        <span>
                          {new Date(theme.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 ml-4">
                      {theme.is_used ? (
                        <span className="text-xs bg-gray-600 text-gray-400 px-2 py-1 rounded">
                          Used
                        </span>
                      ) : (
                        <span className="text-xs bg-green-900 text-green-200 px-2 py-1 rounded">
                          Available
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {themes.length === 0 && (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">💡</div>
                <p className="text-gray-400">
                  No themes in the pool yet. Add the first theme to get started!
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClubPage;