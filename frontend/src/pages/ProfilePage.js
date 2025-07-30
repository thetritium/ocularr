import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import MovieSearch from '../components/MovieSearch';
import LoadingSpinner from '../components/LoadingSpinner';

const ProfilePage = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [favoriteMovies, setFavoriteMovies] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [showFavoriteSearch, setShowFavoriteSearch] = useState(false);
  const [showWatchlistSearch, setShowWatchlistSearch] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/users/${user.id}/profile`);
      setProfile(response.data.profile);
      setUsername(response.data.profile.username);
      setBio(response.data.profile.bio || '');
      setFavoriteMovies(response.data.favoriteMovies || []);
      setWatchlist(response.data.watchlist || []);
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      await api.put('/users/profile', {
        username,
        bio
      });
      setEditing(false);
      await fetchProfile();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update profile');
    }
  };

  const handleAddFavorite = async (movie) => {
    try {
      await api.post('/users/favorite-movies', {
        tmdbId: movie.id,
        title: movie.title,
        posterPath: movie.poster_path,
        releaseDate: movie.release_date
      });
      setShowFavoriteSearch(false);
      await fetchProfile();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add favorite');
    }
  };

  const handleRemoveFavorite = async (movieId) => {
    try {
      await api.delete(`/users/favorite-movies/${movieId}`);
      await fetchProfile();
    } catch (err) {
      alert('Failed to remove favorite');
    }
  };

  const handleAddToWatchlist = async (movie) => {
    try {
      await api.post('/users/watchlist', {
        tmdbId: movie.id,
        title: movie.title,
        posterPath: movie.poster_path,
        releaseDate: movie.release_date,
        overview: movie.overview
      });
      setShowWatchlistSearch(false);
      await fetchProfile();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add to watchlist');
    }
  };

  const handleRemoveFromWatchlist = async (movieId) => {
    try {
      await api.delete(`/users/watchlist/${movieId}`);
      await fetchProfile();
    } catch (err) {
      alert('Failed to remove from watchlist');
    }
  };

  const handleMarkAsWatched = async (movieId) => {
    try {
      await api.put(`/users/watchlist/${movieId}/watched`);
      await fetchProfile();
    } catch (err) {
      alert('Failed to update watch status');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Info */}
        <div className="lg:col-span-1">
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="text-center mb-6">
              <div className="w-24 h-24 bg-gray-700 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-3xl font-bold">
                  {profile?.username?.charAt(0).toUpperCase()}
                </span>
              </div>
              {editing ? (
                <div className="space-y-4">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-gray-900 px-3 py-2 rounded"
                  />
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Add a bio..."
                    className="w-full bg-gray-900 px-3 py-2 rounded h-24"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdateProfile}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false);
                        setUsername(profile.username);
                        setBio(profile.bio || '');
                      }}
                      className="flex-1 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-bold mb-2">{profile?.username}</h2>
                  <p className="text-gray-400 mb-4">{profile?.bio || 'No bio yet'}</p>
                  <button
                    onClick={() => setEditing(true)}
                    className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded font-medium transition-colors"
                  >
                    Edit Profile
                  </button>
                </>
              )}
            </div>

            <div className="border-t border-gray-700 pt-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Member since</span>
                  <span>{new Date(profile?.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total points</span>
                  <span>{profile?.total_points || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Cycles participated</span>
                  <span>{profile?.cycles_participated || 0}</span>
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
              <button
                onClick={() => setShowFavoriteSearch(!showFavoriteSearch)}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium transition-colors text-sm"
              >
                Add Movie
              </button>
            </div>

            {showFavoriteSearch && (
              <div className="mb-4">
                <MovieSearch onSelectMovie={handleAddFavorite} />
              </div>
            )}

            <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
              {favoriteMovies.length === 0 ? (
                <p className="text-gray-500 col-span-full">No favorite movies yet</p>
              ) : (
                favoriteMovies.map(movie => (
                  <div key={movie.id} className="relative group">
                    {movie.poster_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w200${movie.poster_path}`}
                        alt={movie.title}
                        className="w-full rounded-lg"
                      />
                    ) : (
                      <div className="w-full aspect-[2/3] bg-gray-700 rounded-lg flex items-center justify-center">
                        <span className="text-xs text-gray-500 text-center px-2">{movie.title}</span>
                      </div>
                    )}
                    <button
                      onClick={() => handleRemoveFavorite(movie.id)}
                      className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Watchlist */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Watchlist</h3>
              <button
                onClick={() => setShowWatchlistSearch(!showWatchlistSearch)}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium transition-colors text-sm"
              >
                Add to Watchlist
              </button>
            </div>

            {showWatchlistSearch && (
              <div className="mb-4">
                <MovieSearch onSelectMovie={handleAddToWatchlist} />
              </div>
            )}

            <div className="space-y-3">
              {watchlist.length === 0 ? (
                <p className="text-gray-500">Your watchlist is empty</p>
              ) : (
                watchlist.map(movie => (
                  <div key={movie.id} className="bg-gray-900 rounded-lg p-4 flex items-center gap-4">
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
                        {movie.release_date ? new Date(movie.release_date).getFullYear() : 'TBA'}
                      </p>
                      {movie.overview && (
                        <p className="text-sm text-gray-400 mt-1 line-clamp-2">{movie.overview}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleMarkAsWatched(movie.id)}
                        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                          movie.watched 
                            ? 'bg-green-600 text-white' 
                            : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                      >
                        {movie.watched ? '✓ Watched' : 'Mark Watched'}
                      </button>
                      <button
                        onClick={() => handleRemoveFromWatchlist(movie.id)}
                        className="text-red-500 hover:text-red-400"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-4">Statistics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-900 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold">{profile?.cycles_won || 0}</div>
                <div className="text-sm text-gray-500">Cycles Won</div>
              </div>
              <div className="bg-gray-900 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold">{profile?.perfect_guesses || 0}</div>
                <div className="text-sm text-gray-500">Perfect Guesses</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;