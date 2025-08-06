import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { userAPI, handleApiError } from '../services/api';
import MovieSearch from '../components/MovieSearch';
import LoadingSpinner from '../components/LoadingSpinner';

const ProfilePage = () => {
  const { username } = useParams(); // Get username from URL params
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [favoriteMovies, setFavoriteMovies] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [error, setError] = useState('');
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    username: '',
    displayName: '',
    bio: '',
    profilePicture: null
  });
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  
  // Movie search modals
  const [showFavoriteSearch, setShowFavoriteSearch] = useState(false);
  const [showWatchlistSearch, setShowWatchlistSearch] = useState(false);

  useEffect(() => {
    if (username) {
      fetchProfile();
    }
  }, [username]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Fetch profile by username
      const response = await userAPI.getProfileByUsername(username);
      
      if (response.data) {
        setProfile(response.data.profile);
        setFavoriteMovies(response.data.favoriteMovies || []);
        setWatchlist(response.data.watchlist || []);
        
        // Set edit form defaults
        setEditForm({
          username: response.data.profile.username,
          displayName: response.data.profile.display_name || '',
          bio: response.data.profile.bio || '',
          profilePicture: null
        });
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      const errorMsg = handleApiError(err, 'Failed to load profile');
      setError(errorMsg);
      
      // If user not found, redirect to dashboard
      if (err.response?.status === 404) {
        navigate('/dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setUploadingPicture(true);
    setError('');

    try {
      const formData = new FormData();
      
      // Only add fields that have changed
      if (editForm.username !== profile.username) {
        formData.append('username', editForm.username);
      }
      if (editForm.displayName !== (profile.display_name || '')) {
        formData.append('displayName', editForm.displayName);
      }
      if (editForm.bio !== (profile.bio || '')) {
        formData.append('bio', editForm.bio);
      }
      if (editForm.profilePicture) {
        formData.append('profilePicture', editForm.profilePicture);
      }

      const response = await userAPI.updateProfile(formData);
      
      // Update local state
      setProfile(prev => ({
        ...prev,
        ...response.data.user
      }));
      
      // Update auth context if it's the current user
      if (profile.id === user?.id) {
        updateUser(response.data.user);
        
        // If username changed, navigate to new profile URL
        if (response.data.user.username !== username) {
          navigate(`/profile/${response.data.user.username}`, { replace: true });
        }
      }
      
      setEditing(false);
      setProfilePicturePreview(null);
    } catch (err) {
      const errorMsg = handleApiError(err, 'Failed to update profile');
      setError(errorMsg);
    } finally {
      setUploadingPicture(false);
    }
  };

  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        setError('Profile picture must be less than 50MB');
        return;
      }
      
      setEditForm(prev => ({ ...prev, profilePicture: file }));
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicturePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddFavorite = async (movie) => {
    try {
      await userAPI.addFavorite({
        tmdbId: movie.id,
        title: movie.title,
        posterPath: movie.poster_path,
        releaseYear: movie.release_date ? new Date(movie.release_date).getFullYear() : null
      });
      setShowFavoriteSearch(false);
      await fetchProfile();
    } catch (err) {
      const errorMsg = handleApiError(err, 'Failed to add favorite');
      setError(errorMsg);
    }
  };

  const handleRemoveFavorite = async (movieId) => {
    try {
      await userAPI.removeFavorite(movieId);
      await fetchProfile();
    } catch (err) {
      setError('Failed to remove favorite');
    }
  };

  const handleAddToWatchlist = async (movie) => {
    try {
      await userAPI.addToWatchlist({
        tmdbId: movie.id,
        title: movie.title,
        posterPath: movie.poster_path,
        releaseYear: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
        overview: movie.overview
      });
      setShowWatchlistSearch(false);
      await fetchProfile();
    } catch (err) {
      const errorMsg = handleApiError(err, 'Failed to add to watchlist');
      setError(errorMsg);
    }
  };

  const handleRemoveFromWatchlist = async (movieId) => {
    try {
      await userAPI.removeFromWatchlist(movieId);
      await fetchProfile();
    } catch (err) {
      setError('Failed to remove from watchlist');
    }
  };

  const handleMarkAsWatched = async (movieId) => {
    try {
      await userAPI.markAsWatched(movieId);
      await fetchProfile();
    } catch (err) {
      setError('Failed to update watch status');
    }
  };

  const getProfilePictureUrl = () => {
    if (profilePicturePreview) {
      return profilePicturePreview;
    }
    if (profile?.profile_picture) {
      return `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${profile.profile_picture}`;
    }
    return null;
  };

  if (loading) return <LoadingSpinner />;

  if (!profile) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400 mb-4">Profile not found</p>
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

  const isOwnProfile = profile.id === user?.id;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {error && (
        <div className="bg-red-900/50 border border-red-600 text-red-200 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Info */}
        <div className="lg:col-span-1">
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="text-center mb-6">
              {/* Profile Picture */}
              <div className="relative inline-block mb-4">
                {getProfilePictureUrl() ? (
                  <img 
                    src={getProfilePictureUrl()}
                    alt={profile.username}
                    className="w-32 h-32 rounded-full object-cover mx-auto"
                  />
                ) : (
                  <div className="w-32 h-32 bg-gray-700 rounded-full mx-auto flex items-center justify-center">
                    <span className="text-4xl font-bold">
                      {profile.username?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                
                {editing && isOwnProfile && (
                  <label className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 p-2 rounded-full cursor-pointer">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <input 
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePictureChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {editing && isOwnProfile ? (
                <form onSubmit={handleEditSubmit} className="space-y-4">
                  <input
                    type="text"
                    value={editForm.username}
                    onChange={(e) => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full bg-gray-900 px-3 py-2 rounded"
                    placeholder="Username"
                    required
                  />
                  <input
                    type="text"
                    value={editForm.displayName}
                    onChange={(e) => setEditForm(prev => ({ ...prev, displayName: e.target.value }))}
                    className="w-full bg-gray-900 px-3 py-2 rounded"
                    placeholder="Display Name"
                  />
                  <textarea
                    value={editForm.bio}
                    onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                    placeholder="Add a bio..."
                    className="w-full bg-gray-900 px-3 py-2 rounded h-24 resize-none"
                    maxLength={500}
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={uploadingPicture}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 px-4 py-2 rounded font-medium transition-colors"
                    >
                      {uploadingPicture ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(false);
                        setEditForm({
                          username: profile.username,
                          displayName: profile.display_name || '',
                          bio: profile.bio || '',
                          profilePicture: null
                        });
                        setProfilePicturePreview(null);
                        setError('');
                      }}
                      className="flex-1 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <h2 className="text-2xl font-bold mb-1">{profile.display_name || profile.username}</h2>
                  {profile.display_name && (
                    <p className="text-gray-400 text-sm mb-2">@{profile.username}</p>
                  )}
                  <p className="text-gray-400 mb-4">{profile.bio || 'No bio yet'}</p>
                  {isOwnProfile && (
                    <button
                      onClick={() => setEditing(true)}
                      className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded font-medium transition-colors"
                    >
                      Edit Profile
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="border-t border-gray-700 pt-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Member since</span>
                  <span>{new Date(profile.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total points</span>
                  <span>{Math.round(profile.total_points || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Cycles participated</span>
                  <span>{profile.cycles_participated || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Cycles won</span>
                  <span>{profile.cycles_won || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Perfect guesses</span>
                  <span>{profile.perfect_guesses || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Favorite Movies */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Favorite Movies</h3>
              {isOwnProfile && (
                <button
                  onClick={() => setShowFavoriteSearch(!showFavoriteSearch)}
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium transition-colors text-sm"
                >
                  Add Movie
                </button>
              )}
            </div>

            {showFavoriteSearch && isOwnProfile && (
              <div className="mb-4 p-4 bg-gray-900 rounded-lg">
                <MovieSearch onSelectMovie={handleAddFavorite} />
              </div>
            )}

            <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
              {favoriteMovies.length === 0 ? (
                <p className="text-gray-500 col-span-full">
                  {isOwnProfile ? 'No favorite movies yet. Add some!' : 'No favorite movies yet'}
                </p>
              ) : (
                favoriteMovies.slice(0, 12).map(movie => (
                  <div key={movie.tmdb_id} className="relative group">
                    {movie.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w200${movie.poster_path}`}
                        alt={movie.title}
                        className="w-full rounded-lg shadow-lg hover:shadow-xl transition-shadow"
                      />
                    ) : (
                      <div className="w-full aspect-[2/3] bg-gray-700 rounded-lg flex items-center justify-center">
                        <span className="text-xs text-gray-500 text-center px-2">{movie.title}</span>
                      </div>
                    )}
                    {isOwnProfile && (
                      <button
                        onClick={() => handleRemoveFavorite(movie.tmdb_id)}
                        className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-xs font-medium truncate">{movie.title}</p>
                      {movie.release_year && (
                        <p className="text-xs text-gray-300">{movie.release_year}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            {favoriteMovies.length >= 12 && (
              <p className="text-sm text-gray-500 mt-4 text-center">Maximum of 12 favorites reached</p>
            )}
          </div>

          {/* Watchlist */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Watchlist</h3>
              {isOwnProfile && (
                <button
                  onClick={() => setShowWatchlistSearch(!showWatchlistSearch)}
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium transition-colors text-sm"
                >
                  Add to Watchlist
                </button>
              )}
            </div>

            {showWatchlistSearch && isOwnProfile && (
              <div className="mb-4 p-4 bg-gray-900 rounded-lg">
                <MovieSearch onSelectMovie={handleAddToWatchlist} />
              </div>
            )}

            <div className="space-y-3">
              {watchlist.length === 0 ? (
                <p className="text-gray-500">
                  {isOwnProfile ? 'Your watchlist is empty. Add movies to watch!' : 'No movies in watchlist'}
                </p>
              ) : (
                watchlist.map(movie => (
                  <div key={movie.tmdb_id} className="bg-gray-900 rounded-lg p-4 flex items-center gap-4">
                    {movie.poster_path && (
                      <img
                        src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`}
                        alt={movie.title}
                        className="w-16 h-24 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <h4 className="font-medium">{movie.title}</h4>
                      <p className="text-sm text-gray-500">
                        {movie.release_year || 'TBA'}
                      </p>
                    </div>
                    {isOwnProfile && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleMarkAsWatched(movie.tmdb_id)}
                          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                            movie.watched 
                              ? 'bg-green-600 text-white' 
                              : 'bg-gray-700 hover:bg-gray-600'
                          }`}
                        >
                          {movie.watched ? '✓ Watched' : 'Mark Watched'}
                        </button>
                        <button
                          onClick={() => handleRemoveFromWatchlist(movie.tmdb_id)}
                          className="text-red-500 hover:text-red-400"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-900 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-500">{profile.clubs_joined || 0}</div>
                <div className="text-sm text-gray-500">Clubs Joined</div>
              </div>
              <div className="bg-gray-900 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-500">{profile.cycles_won || 0}</div>
                <div className="text-sm text-gray-500">Cycles Won</div>
              </div>
              <div className="bg-gray-900 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-purple-500">{profile.perfect_guesses || 0}</div>
                <div className="text-sm text-gray-500">Perfect Guesses</div>
              </div>
              <div className="bg-gray-900 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-yellow-500">{Math.round(profile.total_points || 0)}</div>
                <div className="text-sm text-gray-500">Total Points</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;