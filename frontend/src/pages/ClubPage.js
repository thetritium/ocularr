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
  const [themes, setThemes] = useState([]);
  const [members, setMembers] = useState([]);
  const [currentCycle, setCurrentCycle] = useState(null);
  const [newTheme, setNewTheme] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // States for cycle management
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [submittingNomination, setSubmittingNomination] = useState(false);

  useEffect(() => {
    if (clubname) {
      fetchClubData();
    }
  }, [clubname]);

  const fetchClubData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Fetch club details
      const clubResponse = await clubAPI.getClubByName(clubname);
      setClub(clubResponse.data.club);
      
      // Fetch themes, members, and current cycle in parallel
      const [themesResponse, membersResponse, cycleResponse] = await Promise.all([
        clubAPI.getThemes(clubResponse.data.club.id),
        clubAPI.getMembers(clubResponse.data.club.id),
        cycleAPI.getCurrentCycle(clubResponse.data.club.id).catch(() => ({ data: { cycle: null } }))
      ]);
      
      setThemes(themesResponse.data.themes);
      setMembers(membersResponse.data.members);
      setCurrentCycle(cycleResponse.data.cycle);
      
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

  const handleSubmitTheme = async (e) => {
    e.preventDefault();
    if (!newTheme.trim()) return;

    try {
      setError('');
      setSuccess('');
      
      await clubAPI.submitTheme(club.id, { themeText: newTheme.trim() });
      setNewTheme('');
      setSuccess('Theme submitted successfully!');
      
      // Refresh themes
      const themesResponse = await clubAPI.getThemes(club.id);
      setThemes(themesResponse.data.themes);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (err) {
      setError(handleApiError(err, 'Failed to submit theme'));
    }
  };

  const handleStartCycle = async () => {
    try {
      setError('');
      setSuccess('');
      
      await cycleAPI.startCycle(club.id);
      setSuccess('New cycle started!');
      
      // Refresh data
      fetchClubData();
      
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (err) {
      setError(handleApiError(err, 'Failed to start cycle'));
    }
  };

  const handleNominateMovie = async () => {
    if (!selectedMovie) return;

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
      setSuccess('Movie nominated successfully!');
      
      // Refresh cycle data
      const cycleResponse = await cycleAPI.getCurrentCycle(club.id);
      setCurrentCycle(cycleResponse.data.cycle);
      
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (err) {
      setError(handleApiError(err, 'Failed to nominate movie'));
    } finally {
      setSubmittingNomination(false);
    }
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
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

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Club Header */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-start gap-6">
          <div className="flex-shrink-0">
            {club.club_picture ? (
              <img 
                src={getImageUrl(club.club_picture)}
                alt={club.name}
                className="w-24 h-24 rounded-lg object-cover"
              />
            ) : (
              <div className="w-24 h-24 bg-gray-700 rounded-lg flex items-center justify-center">
                <span className="text-2xl font-bold text-gray-300">
                  {club.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
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

      {/* Current Cycle Status */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Current Status</h2>
        {currentCycle ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium">Cycle #{currentCycle.cycle_number}</h3>
                <p className="text-gray-300">Theme: {currentCycle.theme_text}</p>
              </div>
              <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm capitalize">
                {currentCycle.phase}
              </span>
            </div>
            
            {/* Phase-specific content */}
            {currentCycle.phase === 'nomination' && (
              <div className="mt-4">
                <h4 className="font-medium mb-3">Nominate a Movie</h4>
                <div className="space-y-4">
                  <MovieSearch onSelect={setSelectedMovie} />
                  {selectedMovie && (
                    <div className="bg-gray-900 p-4 rounded-lg">
                      <div className="flex items-start gap-4">
                        {selectedMovie.poster_path && (
                          <img 
                            src={getTMDBImageUrl(selectedMovie.poster_path, 'w92')}
                            alt={selectedMovie.title}
                            className="w-16 h-24 rounded object-cover flex-shrink-0"
                          />
                        )}
                        <div className="flex-1">
                          <h5 className="font-medium">{selectedMovie.title}</h5>
                          <p className="text-sm text-gray-400 mb-2">
                            {selectedMovie.release_date ? new Date(selectedMovie.release_date).getFullYear() : 'Unknown'}
                          </p>
                          <p className="text-sm text-gray-300 line-clamp-3">
                            {selectedMovie.overview}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={handleNominateMovie}
                          disabled={submittingNomination}
                          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm font-medium disabled:opacity-50 transition-colors"
                        >
                          {submittingNomination ? 'Nominating...' : 'Nominate This Movie'}
                        </button>
                        <button
                          onClick={() => setSelectedMovie(null)}
                          className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded text-sm transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <p className="text-gray-300 mb-4">No active cycle</p>
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
    </div>
  );
  const renderThemesTab = () => (
    <div className="space-y-6">
      {/* Submit New Theme */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Submit New Theme</h2>
        <form onSubmit={handleSubmitTheme} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Theme Idea</label>
            <input
              type="text"
              value={newTheme}
              onChange={(e) => setNewTheme(e.target.value)}
              placeholder="e.g., Movies with time travel, Films from the 1980s..."
              className="w-full p-3 bg-gray-900 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
              maxLength={200}
            />
            <p className="text-sm text-gray-400 mt-1">{newTheme.length}/200 characters</p>
          </div>
          <button
            type="submit"
            disabled={!newTheme.trim()}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Submit Theme
          </button>
        </form>
      </div>

      {/* Theme Pool */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Theme Pool ({themes.length})</h2>
        {themes.length > 0 ? (
          <div className="grid gap-3">
            {themes.map(theme => (
              <div 
                key={theme.id} 
                className={`p-4 rounded-lg border ${theme.is_used ? 'bg-gray-900 border-gray-600' : 'bg-gray-700 border-gray-600'}`}
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
    </div>
  );

  const renderMembersTab = () => (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Members ({members.length})</h2>
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

  if (loading) return <LoadingSpinner />;
  if (!club) return <div className="text-center py-8">Club not found</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Navigation */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-gray-400 hover:text-white mb-4 inline-flex items-center transition-colors"
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* Error/Success Messages */}
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

      {/* Tab Navigation */}
      <div className="border-b border-gray-700 mb-6">
        <nav className="flex space-x-8">
          {['overview', 'themes', 'members'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'themes' && renderThemesTab()}
        {activeTab === 'members' && renderMembersTab()}
      </div>
    </div>
  );
};

export default ClubPage;