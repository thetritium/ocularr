import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import MovieSearch from '../components/MovieSearch';
import LoadingSpinner from '../components/LoadingSpinner';

const ClubPage = () => {
  const { clubId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [club, setClub] = useState(null);
  const [currentCycle, setCurrentCycle] = useState(null);
  const [members, setMembers] = useState([]);
  const [themes, setThemes] = useState([]);
  const [userRole, setUserRole] = useState('critic');
  const [nominations, setNominations] = useState([]);
  const [watchProgress, setWatchProgress] = useState({});
  const [rankings, setRankings] = useState([]);
  const [guesses, setGuesses] = useState({});
  const [results, setResults] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [newTheme, setNewTheme] = useState('');
  const [showThemeForm, setShowThemeForm] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await api.get('/auth/me');
        setCurrentUserId(response.data.user.id);
      } catch (err) {
        console.error('Error fetching user data:', err);
      }
    };
    fetchUserData();
  }, []);

  useEffect(() => {
    if (!clubId) {
      setError('Club ID is required');
      setLoading(false);
      return;
    }
    fetchClubData();
  }, [clubId]);

  const fetchClubData = async () => {
    try {
      setLoading(true);
      setError(null);

      const clubResponse = await api.get(`/clubs/${clubId}`);
      setClub(clubResponse.data.club);
      setUserRole(clubResponse.data.userRole);

      const membersResponse = await api.get(`/clubs/${clubId}/members`);
      setMembers(membersResponse.data.members);

      const themesResponse = await api.get(`/clubs/${clubId}/themes`);
      setThemes(themesResponse.data.themes);

      const cycleResponse = await api.get(`/cycles/${clubId}/current`);
      if (cycleResponse.data.cycle) {
        setCurrentCycle(cycleResponse.data.cycle);
        setNominations(cycleResponse.data.nominations || []);
        setWatchProgress(cycleResponse.data.watchProgress || {});
        setRankings(cycleResponse.data.rankings || []);
        setGuesses(cycleResponse.data.guesses || {});
        setResults(cycleResponse.data.results);
      }
    } catch (err) {
      console.error('Error fetching club data:', err);
      setError(err.response?.data?.error || 'Failed to load club');
    } finally {
      setLoading(false);
    }
  };

  const handleStartCycle = async () => {
    try {
      await api.post(`/cycles/${clubId}/start`);
      await fetchClubData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to start cycle');
    }
  };

  const handleProgressPhase = async () => {
    if (!currentCycle) return;
    
    const confirmMessage = {
      nomination: 'End nominations and start watching phase?',
      watching: 'End watching phase and start ranking?',
      ranking: 'End ranking phase and calculate results?'
    };

    if (window.confirm(confirmMessage[currentCycle.phase])) {
      try {
        await api.put(`/cycles/${currentCycle.id}/phase`);
        await fetchClubData();
      } catch (err) {
        alert(err.response?.data?.error || 'Failed to progress phase');
      }
    }
  };

  const handleNominate = async (movie) => {
    if (!currentCycle || currentCycle.phase !== 'nomination') return;
    
    try {
      await api.post(`/cycles/${currentCycle.id}/nominate`, {
        tmdbId: movie.id,
        title: movie.title,
        releaseDate: movie.release_date,
        posterPath: movie.poster_path,
        overview: movie.overview
      });
      await fetchClubData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to nominate movie');
    }
  };

  const handleMarkWatched = async (movieId) => {
    if (!currentCycle || currentCycle.phase !== 'watching') return;
    
    try {
      await api.put(`/cycles/${currentCycle.id}/watch/${movieId}`);
      await fetchClubData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update watch status');
    }
  };

  const handleSubmitRankings = async () => {
    if (!currentCycle || currentCycle.phase !== 'ranking') return;
    
    const movieRankings = {};
    const nominatorGuesses = {};
    
    nominations.forEach(nom => {
      const rankInput = document.getElementById(`rank-${nom.id}`);
      const guessSelect = document.getElementById(`guess-${nom.id}`);
      
      if (rankInput && rankInput.value) {
        movieRankings[nom.id] = parseInt(rankInput.value);
      }
      if (guessSelect && guessSelect.value) {
        nominatorGuesses[nom.id] = parseInt(guessSelect.value);
      }
    });

    try {
      await api.post(`/cycles/${currentCycle.id}/submit-rankings`, {
        rankings: movieRankings,
        guesses: nominatorGuesses
      });
      await fetchClubData();
      alert('Rankings submitted successfully!');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit rankings');
    }
  };

  const handleSubmitTheme = async (e) => {
    e.preventDefault();
    if (!newTheme.trim()) return;

    try {
      await api.post(`/clubs/${clubId}/themes`, { theme: newTheme });
      setNewTheme('');
      setShowThemeForm(false);
      await fetchClubData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit theme');
    }
  };
  const renderIdlePhase = () => (
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-xl font-semibold mb-4">No Active Cycle</h3>
      <p className="text-gray-400 mb-6">The club is currently between movie cycles.</p>
      {(userRole === 'director' || userRole === 'producer') && themes.length > 0 && (
        <button
          onClick={handleStartCycle}
          className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium transition-colors"
        >
          Start New Cycle
        </button>
      )}
      {themes.length === 0 && (
        <p className="text-yellow-500">Add themes to the pool before starting a cycle.</p>
      )}
    </div>
  );

  const renderNominationPhase = () => {
    const hasNominated = nominations.some(n => n.user_id === currentUserId);
    
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-semibold">Nomination Phase</h3>
            <p className="text-gray-400 mt-1">Theme: {currentCycle.theme}</p>
          </div>
          {(userRole === 'director' || userRole === 'producer') && (
            <button
              onClick={handleProgressPhase}
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              End Nominations
            </button>
          )}
        </div>

        {hasNominated ? (
          <div className="bg-gray-900 p-4 rounded-lg">
            <p className="text-green-400">✓ You have submitted your nomination</p>
            <p className="text-gray-500 text-sm mt-2">Waiting for other members to nominate...</p>
          </div>
        ) : (
          <div>
            <p className="text-gray-300 mb-4">Search and nominate a movie that fits the theme:</p>
            <MovieSearch onSelectMovie={handleNominate} />
          </div>
        )}

        <div className="mt-6">
          <h4 className="font-medium mb-3">Nominations so far: {nominations.length}</h4>
          <div className="text-sm text-gray-500">
            Members who nominated: {nominations.length} / {members.filter(m => m.is_active).length}
          </div>
        </div>
      </div>
    );
  };

  const renderWatchingPhase = () => (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold">Watching Phase</h3>
        {(userRole === 'director' || userRole === 'producer') && (
          <button
            onClick={handleProgressPhase}
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            End Watching Phase
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {nominations.map(movie => {
          const isWatched = watchProgress[movie.id]?.watched;
          const isOwnNomination = movie.user_id === currentUserId;
          
          return (
            <div key={movie.id} className="bg-gray-900 rounded-lg overflow-hidden">
              {movie.poster_path && (
                <img
                  src={`https://image.tmdb.org/t/p/w300${movie.poster_path}`}
                  alt={movie.title}
                  className="w-full h-64 object-cover"
                />
              )}
              <div className="p-4">
                <h4 className="font-medium mb-2">{movie.title}</h4>
                <p className="text-sm text-gray-500 mb-3">
                  {new Date(movie.release_date).getFullYear()}
                </p>
                {isOwnNomination ? (
                  <div className="bg-blue-900 px-3 py-2 rounded text-sm">
                    Your nomination (auto-marked as watched)
                  </div>
                ) : (
                  <button
                    onClick={() => handleMarkWatched(movie.id)}
                    className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                      isWatched
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    {isWatched ? '✓ Watched' : 'Mark as Watched'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderRankingPhase = () => {
    const otherNominations = nominations.filter(n => n.user_id !== currentUserId);
    
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold">Ranking Phase</h3>
          {(userRole === 'director' || userRole === 'producer') && (
            <button
              onClick={handleProgressPhase}
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Calculate Results
            </button>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <h4 className="font-medium mb-4">Guess who nominated each movie:</h4>
            {nominations.map(movie => (
              <div key={movie.id} className="bg-gray-900 p-4 rounded-lg mb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-medium">{movie.title}</h5>
                    <p className="text-sm text-gray-500">{new Date(movie.release_date).getFullYear()}</p>
                  </div>
                  {movie.user_id === currentUserId ? (
                    <span className="text-blue-400 text-sm">Your nomination</span>
                  ) : (
                    <select
                      id={`guess-${movie.id}`}
                      className="bg-gray-800 px-3 py-1 rounded"
                      defaultValue=""
                    >
                      <option value="">Select member...</option>
                      {members
                        .filter(m => m.is_active && m.id !== currentUserId)
                        .map(member => (
                          <option key={member.id} value={member.id}>
                            {member.username}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div>
            <h4 className="font-medium mb-4">Rank the movies (excluding your own):</h4>
            {otherNominations.map((movie, index) => (
              <div key={movie.id} className="bg-gray-900 p-4 rounded-lg mb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-medium">{movie.title}</h5>
                    <p className="text-sm text-gray-500">{new Date(movie.release_date).getFullYear()}</p>
                  </div>
                  <input
                    type="number"
                    id={`rank-${movie.id}`}
                    min="1"
                    max={otherNominations.length}
                    placeholder={`1-${otherNominations.length}`}
                    className="bg-gray-800 px-3 py-1 rounded w-20 text-center"
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleSubmitRankings}
            className="w-full bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Submit Rankings & Guesses
          </button>
        </div>
      </div>
    );
  };
  const renderResultsPhase = () => {
    if (!results) return null;

    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold">Cycle Results</h3>
          {(userRole === 'director' || userRole === 'producer') && (
            <button
              onClick={handleStartCycle}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Start New Cycle
            </button>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <h4 className="font-medium mb-4">Final Rankings</h4>
            {results.finalRankings?.map((result, index) => (
              <div key={result.movie_id} className="bg-gray-900 p-4 rounded-lg mb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="text-2xl font-bold text-gray-500 mr-4">
                      #{index + 1}
                    </span>
                    <div>
                      <h5 className="font-medium">{result.title}</h5>
                      <p className="text-sm text-gray-500">
                        Nominated by {result.nominator} • {result.points} points
                      </p>
                    </div>
                  </div>
                  {index === 0 && (
                    <span className="text-yellow-500">🏆 Winner</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div>
            <h4 className="font-medium mb-4">Guess Accuracy</h4>
            <div className="bg-gray-900 p-4 rounded-lg">
              <p className="text-gray-400">
                Members correctly guessed {results.correctGuesses || 0} out of {nominations.length} nominations
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCurrentPhase = () => {
    if (!currentCycle) return renderIdlePhase();

    switch (currentCycle.phase) {
      case 'nomination':
        return renderNominationPhase();
      case 'watching':
        return renderWatchingPhase();
      case 'ranking':
        return renderRankingPhase();
      case 'completed':
        return renderResultsPhase();
      default:
        return renderIdlePhase();
    }
  };

  const renderMembers = () => (
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-xl font-semibold mb-4">Members ({members.filter(m => m.is_active).length})</h3>
      <div className="space-y-3">
        {members
          .filter(m => m.is_active)
          .map(member => (
            <div key={member.id} className="flex items-center justify-between bg-gray-900 p-3 rounded-lg">
              <div>
                <span className="font-medium">{member.username}</span>
                <span className="ml-3 text-sm text-gray-500 capitalize">
                  {member.role}
                </span>
              </div>
              <span className="text-sm text-gray-500">
                Joined {new Date(member.joined_at).toLocaleDateString()}
              </span>
            </div>
          ))}
      </div>
    </div>
  );

  const renderThemes = () => (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Theme Pool ({themes.length})</h3>
        <button
          onClick={() => setShowThemeForm(!showThemeForm)}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium transition-colors text-sm"
        >
          Add Theme
        </button>
      </div>

      {showThemeForm && (
        <form onSubmit={handleSubmitTheme} className="mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newTheme}
              onChange={(e) => setNewTheme(e.target.value)}
              placeholder="Enter a theme..."
              className="flex-1 bg-gray-900 px-4 py-2 rounded-lg"
              maxLength={100}
            />
            <button
              type="submit"
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Submit
            </button>
            <button
              type="button"
              onClick={() => {
                setShowThemeForm(false);
                setNewTheme('');
              }}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {themes.length === 0 ? (
          <p className="text-gray-500">No themes yet. Add some to get started!</p>
        ) : (
          themes.map(theme => (
            <div key={theme.id} className="bg-gray-900 p-3 rounded-lg">
              <div className="flex justify-between items-center">
                <span>{theme.theme}</span>
                <div className="text-sm text-gray-500">
                  {theme.is_used && <span className="text-green-500 mr-3">✓ Used</span>}
                  by {theme.username}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
  if (loading) return <LoadingSpinner />;

  if (error || !club) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-900 p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-2">Error</h2>
          <p className="mb-4">{error || 'Unable to load club'}</p>
          <button 
            onClick={() => navigate('/dashboard')}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold">{club.name}</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-500">
              Invite Code: <span className="font-mono bg-gray-800 px-2 py-1 rounded">{club.invite_code}</span>
            </span>
            {userRole === 'producer' && (
              <button className="text-gray-500 hover:text-white">
                ⚙️ Settings
              </button>
            )}
          </div>
        </div>
        {club.description && (
          <p className="text-gray-400 mb-4">{club.description}</p>
        )}
        <div className="flex items-center gap-6 text-sm text-gray-500">
          <span>{members.filter(m => m.is_active).length} / {club.max_members} members</span>
          <span>Created {new Date(club.created_at).toLocaleDateString()}</span>
          <span className="capitalize">Your role: {userRole}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {renderCurrentPhase()}
          
          {currentCycle && (
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Cycle Progress</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Phase:</span>
                  <span className="capitalize">{currentCycle.phase}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Started:</span>
                  <span>{new Date(currentCycle.created_at).toLocaleDateString()}</span>
                </div>
                {currentCycle.phase === 'watching' && (
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Watch Progress:</span>
                      <span>
                        {Object.values(watchProgress).filter(p => p.watched).length} / {nominations.length}
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ 
                          width: `${(Object.values(watchProgress).filter(p => p.watched).length / nominations.length) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Cycles</h3>
            <p className="text-gray-500">Cycle history will appear here</p>
          </div>
        </div>

        <div className="space-y-6">
          {renderMembers()}
          {renderThemes()}
          
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Season Stats</h3>
            <p className="text-gray-500">Season leaderboard coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClubPage;