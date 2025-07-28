import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { userAPI, handleApiError } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const [profileData, setProfileData] = useState({
    displayName: '',
    bio: '',
    favoriteGenre: '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  useEffect(() => {
    if (user) {
      setProfileData({
        displayName: user.display_name || '',
        bio: user.bio || '',
        favoriteGenre: user.favorite_genre || '',
      });
    }
    fetchWatchlist();
    setLoading(false);
  }, [user]);

  const fetchWatchlist = async () => {
    try {
      const response = await userAPI.getWatchlist();
      setWatchlist(response.data.watchlist || []);
    } catch (error) {
      console.error('Failed to fetch watchlist:', error);
    }
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
    if (error) setError('');
    if (success) setSuccess('');
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
    if (passwordError) setPasswordError('');
    if (passwordSuccess) setPasswordSuccess('');
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await userAPI.updateProfile(profileData);
      updateUser(response.data.user);
      setSuccess('Profile updated successfully!');
    } catch (error) {
      setError(handleApiError(error, 'Failed to update profile'));
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }

    setChangingPassword(true);
    setPasswordError('');
    setPasswordSuccess('');

    try {
      await userAPI.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      setPasswordSuccess('Password changed successfully!');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      setPasswordError(handleApiError(error, 'Failed to change password'));
    } finally {
      setChangingPassword(false);
    }
  };

  const handlePictureUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setError('Profile picture must be less than 5MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    setUploadingPicture(true);
    setError('');

    try {
      const response = await userAPI.uploadProfilePicture(file);
      updateUser({ profile_picture: response.data.profilePicture });
      setSuccess('Profile picture updated successfully!');
    } catch (error) {
      setError(handleApiError(error, 'Failed to upload profile picture'));
    } finally {
      setUploadingPicture(false);
    }
  };

  const removeFromWatchlist = async (movieId) => {
    try {
      await userAPI.removeFromWatchlist(movieId);
      setWatchlist(prev => prev.filter(movie => movie.id !== movieId));
    } catch (error) {
      console.error('Failed to remove from watchlist:', error);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <LoadingSpinner size="lg" text="Loading your profile..." />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-gray-100 mb-8">Your Profile</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Information */}
        <div className="lg:col-span-2 space-y-8">
          {/* Basic Profile */}
          <div className="card p-6">
            <h2 className="text-xl font-semibold text-gray-100 mb-6">Profile Information</h2>
            
            {error && (
              <div className="bg-red-900/50 border border-red-600 text-red-200 p-3 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}
            
            {success && (
              <div className="bg-green-900/50 border border-green-600 text-green-200 p-3 rounded-lg mb-4 text-sm">
                {success}
              </div>
            )}

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={user?.username || ''}
                  disabled
                  className="input bg-gray-700 text-gray-400 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Username cannot be changed</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="input bg-gray-700 text-gray-400 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Contact support to change email</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  name="displayName"
                  value={profileData.displayName}
                  onChange={handleProfileChange}
                  className="input"
                  placeholder="How others see you"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Bio
                </label>
                <textarea
                  name="bio"
                  value={profileData.bio}
                  onChange={handleProfileChange}
                  className="input min-h-[100px] resize-vertical"
                  placeholder="Tell others about yourself..."
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {profileData.bio.length}/500 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Favorite Genre
                </label>
                <input
                  type="text"
                  name="favoriteGenre"
                  value={profileData.favoriteGenre}
                  onChange={handleProfileChange}
                  className="input"
                  placeholder="e.g., Sci-Fi, Horror, Comedy"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="btn-primary w-full"
              >
                {saving ? (
                  <div className="flex items-center justify-center">
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Saving...</span>
                  </div>
                ) : (
                  'Save Changes'
                )}
              </button>
            </form>
          </div>

          {/* Change Password */}
          <div className="card p-6">
            <h2 className="text-xl font-semibold text-gray-100 mb-6">Change Password</h2>
            
            {passwordError && (
              <div className="bg-red-900/50 border border-red-600 text-red-200 p-3 rounded-lg mb-4 text-sm">
                {passwordError}
              </div>
            )}
            
            {passwordSuccess && (
              <div className="bg-green-900/50 border border-green-600 text-green-200 p-3 rounded-lg mb-4 text-sm">
                {passwordSuccess}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  name="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  className="input"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  className="input"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={changingPassword}
                className="btn-primary w-full"
              >
                {changingPassword ? (
                  <div className="flex items-center justify-center">
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Changing Password...</span>
                  </div>
                ) : (
                  'Change Password'
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Profile Picture */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">Profile Picture</h3>
            
            <div className="text-center">
              <div className="relative inline-block">
                {user?.profile_picture ? (
                  <img
                    src={user.profile_picture}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover mx-auto"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center mx-auto">
                    <span className="text-2xl text-gray-400">👤</span>
                  </div>
                )}
                
                {uploadingPicture && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                    <LoadingSpinner size="sm" />
                  </div>
                )}
              </div>

              <div className="mt-4">
                <label className="btn-secondary cursor-pointer">
                  {uploadingPicture ? 'Uploading...' : 'Change Picture'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePictureUpload}
                    className="hidden"
                    disabled={uploadingPicture}
                  />
                </label>
                <p className="text-xs text-gray-500 mt-2">
                  Max 5MB • PNG, JPG, GIF
                </p>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">Quick Stats</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Member since</span>
                <span className="text-gray-200">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Watchlist items</span>
                <span className="text-gray-200">{watchlist.length}</span>
              </div>
            </div>
          </div>

          {/* Recent Watchlist */}
          {watchlist.length > 0 && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-100 mb-4">Recent Watchlist</h3>
              
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {watchlist.slice(0, 5).map((movie) => (
                  <div key={movie.id} className="flex items-center space-x-3">
                    {movie.poster_path && (
                      <img
                        src={movie.poster_path}
                        alt={movie.title}
                        className="w-10 h-15 object-cover rounded flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-200 truncate">
                        {movie.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        Added {new Date(movie.added_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => removeFromWatchlist(movie.id)}
                      className="text-gray-400 hover:text-red-400 flex-shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              
              {watchlist.length > 5 && (
                <p className="text-xs text-gray-500 mt-3 text-center">
                  And {watchlist.length - 5} more items...
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;