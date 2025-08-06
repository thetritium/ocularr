import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import MovieSearch from '../components/MovieSearch';
import { toast } from '../components/Toast';
import { confirm } from '../components/ConfirmDialog';
import Skeleton, { SkeletonCard } from '../components/Skeleton';

const ProfilePage = () => {
  const { username } = useParams();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    displayName: '',
    bio: '',
    profilePicture: null
  });
  const [imagePreview, setImagePreview] = useState(null);
  
  // Movie states
  const [favoriteMovies, setFavoriteMovies] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [showFavoriteSearch, setShowFavoriteSearch] = useState(false);
  const [showWatchlistSearch, setShowWatchlistSearch] = useState(false);

  const isOwnProfile = currentUser?.username === username;

  useEffect(() => {
    fetchProfile();
  }, [username]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      // Get user ID from username first
      const userResponse = await api.get(`/users/by-username/${username}`);
      const userId = userResponse.data.user.id;
      
      // Then fetch full profile
      const response = await api.get(`/users/profile/${userId}`);
      setProfile(response.data.user);
      
      // Set edit form defaults
      setEditForm({
        displayName: response.data.user.display_name || '',
        bio: response.data.user.bio || '',
        profilePicture: null
      });
      
      // Only load personal data for own profile
      if (isOwnProfile) {
        setFavoriteMovies(response.data.user.favorite_movies || []);
        setWatchlist(response.data.user.watchlist || []);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      toast.error('Failed to load profile');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        toast.error('Image size should be less than 50MB');
        return;
      }

      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        toast.error('Please upload a valid image file');
        return;
      }

      setEditForm(prev => ({ ...prev, profilePicture: file }));
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      setUploadingImage(true);
      
      const formData = new FormData();
      formData.append('displayName', editForm.displayName);
      formData.append('bio', editForm.bio);
      if (editForm.profilePicture) {
        formData.append('profilePicture', editForm.profilePicture);
      }

      const response = await api.put('/users/profile', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setProfile(prev => ({
        ...prev,
        ...response.data.user
      }));
      
      setEditing(false);
      setImagePreview(null);
      toast.success('Profile updated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddFavorite = async (movie) => {
    try {
      await api.post('/users/favorites', {
        tmdbId: movie.id,
        title: movie.title,
        posterPath: movie.poster_path,
        releaseYear: movie.release_date ? new Date(movie.release_date).getFullYear() : null
      });
      
      await fetchProfile();
      setShowFavoriteSearch(false);
      toast.success('Added to favorites!');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to add favorite');
    }
  };

  const handleRemoveFavorite = async (tmdbId) => {
    const confirmed = await confirm({
      title: 'Remove Favorite',
      message: 'Remove this movie from your favorites?',
      confirmText: 'Remove',
      type: 'danger'
    });

    if (!confirmed) return;

    try {
      await api.delete(`/users/favorites/${tmdbId}`);
      await fetchProfile();
      toast.success('Removed from favorites');
    } catch (error) {
      toast.error('Failed to remove favorite');
    }
  };

  const handleAddToWatchlist = async (movie) => {
    try {
      await api.post('/users/watchlist', {
        tmdbId: movie.id,
        title: movie.title,
        posterPath: movie.poster_path,
        releaseYear: movie.release_date ? new Date(movie.release_date).getFullYear() : null
      });
      
      await fetchProfile();
      setShowWatchlistSearch(false);
      toast.success('Added to watchlist!');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to add to watchlist');
    }
  };

  const handleRemoveFromWatchlist = async (tmdbId) => {
    try {
      await api.delete(`/users/watchlist/${tmdbId}`);
      await fetchProfile();
      toast.success('Removed from watchlist');
    } catch (error) {
      toast.error('Failed to remove from watchlist');
    }
  };

  const handleMarkWatched = async (tmdbId) => {
    try {
      await api.put(`/users/watchlist/${tmdbId}/watched`);
      await fetchProfile();
      toast.success('Marked as watched');
    } catch (error) {
      toast.error('Failed to update watch status');
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-lg p-6">
              <Skeleton variant="avatar" className="w-24 h-24 mx-auto mb-4" />
              <Skeleton variant="title" className="mx-auto mb-2" />
              <Skeleton variant="text" count={2} />
            </div>
          </div>
          <div className="lg:col-span-2">
            <div className="grid grid-cols-3 gap-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) return null;
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fadeIn">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-gray-800 rounded-lg p-6 sticky top-20">
            {/* Profile Picture */}
            <div className="text-center mb-6">
              {editing ? (
                <div className="relative inline-block">
                  <label className="cursor-pointer group">
                    {imagePreview || profile.profile_picture ? (
                      <img
                        src={imagePreview || `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${profile.profile_picture}`}
                        alt={profile.username}
                        className="w-32 h-32 rounded-full object-cover mx-auto group-hover:opacity-75 transition-opacity"
                      />
                    ) : (
                      <div className="w-32 h-32 bg-gray-700 rounded-full mx-auto flex items-center justify-center group-hover:bg-gray-600 transition-colors">
                        <span className="text-4xl font-bold">
                          {profile.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <input
                      type="file"
                      onChange={handleImageChange}
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingImage}
                    />
                  </label>
                  <p className="text-xs text-gray-500 mt-2">Click to change photo</p>
                </div>
              ) : (
                <>
                  {profile.profile_picture ? (
                    <img
                      src={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${profile.profile_picture}`}
                      alt={profile.username}
                      className="w-32 h-32 rounded-full object-cover mx-auto"
                    />
                  ) : (
                    <div className="w-32 h-32 bg-gray-700 rounded-full mx-auto flex items-center justify-center">
                      <span className="text-4xl font-bold">
                        {profile.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Username and Display Name */}
              {editing ? (
                <div className="mt-4 space-y-3">
                  <input
                    type="text"
                    value={editForm.displayName}
                    onChange={(e) => setEditForm(prev => ({ ...prev, displayName: e.target.value }))}
                    placeholder="Display name"
                    className="input text-center"
                    maxLength={100}
                  />
                  <p className="text-sm text-gray-500">@{profile.username}</p>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-bold mt-4">
                    {profile.display_name || profile.username}
                  </h2>
                  {profile.display_name && (
                    <p className="text-gray-400">@{profile.username}</p>
                  )}
                </>
              )}
            </div>

            {/* Bio */}
            {editing ? (
              <div className="mb-6">
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                  placeholder="Tell us about yourself..."
                  className="input"
                  rows={4}
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {editForm.bio.length}/500 characters
                </p>
              </div>
            ) : (
              profile.bio && (
                <p className="text-gray-400 mb-6">{profile.bio}</p>
              )
            )}

            {/* Action Buttons */}
            {isOwnProfile && (
              <div className="space-y-2">
                {editing ? (
                  <>
                    <button
                      onClick={handleUpdateProfile}
                      disabled={uploadingImage}
                      className="w-full btn-primary disabled:opacity-50"
                    >
                      {uploadingImage ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false);
                        setImagePreview(null);
                        setEditForm({
                          displayName: profile.display_name || '',
                          bio: profile.bio || '',
                          profilePicture: null
                        });
                      }}
                      disabled={uploadingImage}
                      className="w-full btn-secondary"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setEditing(true)}
                    className="w-full btn-secondary"
                  >
                    Edit Profile
                  </button>
                )}
              </div>
            )}

            {/* Stats */}
            <div className="border-t border-gray-700 mt-6 pt-6">
              <h3 className="font-medium mb-4">Statistics</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Member since</span>
                  <span>{new Date(profile.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Clubs joined</span>
                  <span>{profile.stats?.clubs_joined || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Cycles completed</span>
                  <span>{profile.stats?.cycles_completed || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Cycles won</span>
                  <span>{profile.stats?.cycles_won || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Average points</span>
                  <span>{parseFloat(profile.stats?.average_points || 0).toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2">
          {/* Tabs */}
          <div className="bg-gray-800 rounded-lg mb-6">
            <div className="border-b border-gray-700">
              <nav className="flex -mb-px">
                {['overview', 'favorites', 'watchlist', 'clubs', 'history'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-6 py-3 border-b-2 font-medium text-sm capitalize transition-colors ${
                      activeTab === tab
                        ? 'border-blue-500 text-blue-500'
                        : 'border-transparent text-gray-400 hover:text-white hover:border-gray-300'
                    }`}
                    // Disable personal tabs for other users
                    disabled={!isOwnProfile && ['watchlist', 'history'].includes(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Tab Content */}
          <div className="animate-fadeIn">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Recent Activity */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-4">Recent Activity</h3>
                  <div className="empty-state">
                    <div className="empty-state-icon">📽️</div>
                    <p className="empty-state-text">No recent activity yet</p>
                  </div>
                </div>

                {/* Achievements */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-4">Achievements</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {profile.stats?.cycles_won > 0 && (
                      <div className="text-center">
                        <div className="text-4xl mb-2">🏆</div>
                        <p className="text-sm text-gray-400">Cycle Winner</p>
                      </div>
                    )}
                    {profile.stats?.cycles_completed >= 10 && (
                      <div className="text-center">
                        <div className="text-4xl mb-2">🎬</div>
                        <p className="text-sm text-gray-400">Movie Veteran</p>
                      </div>
                    )}
                    {profile.stats?.clubs_joined >= 5 && (
                      <div className="text-center">
                        <div className="text-4xl mb-2">🌟</div>
                        <p className="text-sm text-gray-400">Social Butterfly</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Favorites Tab */}
            {activeTab === 'favorites' && (
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-semibold">Favorite Movies</h3>
                  {isOwnProfile && favoriteMovies.length < 12 && (
                    <button
                      onClick={() => setShowFavoriteSearch(!showFavoriteSearch)}
                      className="btn-primary text-sm"
                    >
                      Add Movie
                    </button>
                  )}
                </div>

                {showFavoriteSearch && (
                  <div className="mb-6 p-4 bg-gray-900 rounded-lg">
                    <MovieSearch onSelectMovie={handleAddFavorite} />
                  </div>
                )}

                {favoriteMovies.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">❤️</div>
                    <p className="empty-state-text">
                      {isOwnProfile ? "You haven't added any favorite movies yet" : "No favorite movies yet"}
                    </p>
                  </div>
                ) : (
                  <div className="movie-grid">
                    {favoriteMovies.map(movie => (
                      <div key={movie.tmdb_id} className="relative group">
                        {movie.poster_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w200${movie.poster_path}`}
                            alt={movie.title}
                            className="w-full rounded-lg shadow-lg group-hover:shadow-xl transition-shadow"
                          />
                        ) : (
                          <div className="aspect-poster bg-gray-700 rounded-lg flex items-center justify-center">
                            <span className="text-xs text-gray-500 text-center px-2">{movie.title}</span>
                          </div>
                        )}
                        {isOwnProfile && (
                          <button
                            onClick={() => handleRemoveFavorite(movie.tmdb_id)}
                            className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-xs font-medium">{movie.title}</p>
                          <p className="text-xs text-gray-400">{movie.release_year}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* Watchlist Tab */}
            {activeTab === 'watchlist' && isOwnProfile && (
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-semibold">Watchlist</h3>
                  <button
                    onClick={() => setShowWatchlistSearch(!showWatchlistSearch)}
                    className="btn-primary text-sm"
                  >
                    Add to Watchlist
                  </button>
                </div>

                {showWatchlistSearch && (
                  <div className="mb-6 p-4 bg-gray-900 rounded-lg">
                    <MovieSearch onSelectMovie={handleAddToWatchlist} />
                  </div>
                )}

                {watchlist.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">📋</div>
                    <p className="empty-state-text">Your watchlist is empty</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {watchlist.map(movie => (
                      <div key={movie.tmdb_id} className="bg-gray-900 rounded-lg p-4 flex items-center gap-4 hover:bg-gray-800 transition-colors">
                        {movie.poster_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`}
                            alt={movie.title}
                            className="w-16 h-24 object-cover rounded"
                          />
                        ) : (
                          <div className="w-16 h-24 bg-gray-700 rounded flex items-center justify-center">
                            <span className="text-xs text-gray-500">No image</span>
                          </div>
                        )}
                        <div className="flex-1">
                          <h4 className="font-medium">{movie.title}</h4>
                          <p className="text-sm text-gray-400">
                            {movie.release_year || 'TBA'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleMarkWatched(movie.tmdb_id)}
                            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                              movie.is_watched 
                                ? 'bg-green-600 text-white' 
                                : 'bg-gray-700 hover:bg-gray-600'
                            }`}
                          >
                            {movie.is_watched ? '✓ Watched' : 'Mark Watched'}
                          </button>
                          <button
                            onClick={() => handleRemoveFromWatchlist(movie.tmdb_id)}
                            className="text-red-500 hover:text-red-400"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Clubs Tab */}
            {activeTab === 'clubs' && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-6">
                  {isOwnProfile ? 'Your Clubs' : `${profile.display_name || profile.username}'s Clubs`}
                </h3>
                {profile.recent_clubs && profile.recent_clubs.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {profile.recent_clubs.map(club => (
                      <div key={club.id} className="bg-gray-900 rounded-lg p-4 hover:bg-gray-800 transition-colors">
                        <div className="flex items-center gap-3">
                          {club.club_picture ? (
                            <img
                              src={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${club.club_picture}`}
                              alt={club.name}
                              className="w-12 h-12 rounded object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-700 rounded flex items-center justify-center">
                              <span className="font-bold">{club.name.charAt(0)}</span>
                            </div>
                          )}
                          <div>
                            <h4 className="font-medium">{club.name}</h4>
                            <p className="text-sm text-gray-400 capitalize">{club.role}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-state-icon">🎬</div>
                    <p className="empty-state-text">No clubs yet</p>
                  </div>
                )}
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && isOwnProfile && (
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-6">Cycle History</h3>
                <div className="empty-state">
                  <div className="empty-state-icon">📊</div>
                  <p className="empty-state-text">No cycle history yet</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Your past cycle performances will appear here
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;

// Note: Combine all three parts when implementing