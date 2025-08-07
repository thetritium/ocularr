import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { clubAPI, handleApiError } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';

const ClubSettingsPage = () => {
  const { clubname } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [club, setClub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  // Club edit form
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    isPublic: false,
    password: '',
    maxMembers: 50,
    clubPicture: null
  });

  useEffect(() => {
    if (clubname) {
      fetchClubDetails();
    }
  }, [clubname]);

  const fetchClubDetails = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await clubAPI.getClubByName(clubname);
      const clubData = response.data.club;
      
      // Check permissions
      if (clubData.user_role !== 'director' && clubData.user_role !== 'producer') {
        navigate(`/club/${clubname}`);
        return;
      }
      
      setClub(clubData);
      
      // Set form data
      setEditForm({
        name: clubData.name,
        description: clubData.description || '',
        isPublic: clubData.is_public,
        password: '',
        maxMembers: clubData.max_members,
        clubPicture: null
      });
      
      // Fetch members
      const membersResponse = await clubAPI.getMembers(clubData.id);
      setMembers(membersResponse.data.members);
      
    } catch (err) {
      console.error('Error fetching club:', err);
      setError(handleApiError(err, 'Failed to load club settings'));
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!club?.id) return;

    setSaving(true);
    setError('');

    try {
      const formData = new FormData();
      
      // Add changed fields
      if (editForm.name !== club.name) {
        formData.append('name', editForm.name);
      }
      if (editForm.description !== (club.description || '')) {
        formData.append('description', editForm.description);
      }
      if (editForm.isPublic !== club.is_public) {
        formData.append('isPublic', editForm.isPublic);
      }
      if (editForm.password.trim()) {
        formData.append('password', editForm.password);
      }
      if (editForm.maxMembers !== club.max_members) {
        formData.append('maxMembers', editForm.maxMembers);
      }
      if (editForm.clubPicture) {
        formData.append('clubPicture', editForm.clubPicture);
      }

      // Use direct API call since we don't have updateClub in clubAPI yet
      const response = await fetch(`${process.env.REACT_APP_API_URL || '/api'}/clubs/${club.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('ocularr_token')}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to update club');
      }

      const result = await response.json();
      
      // Update local state
      setClub(prev => ({ ...prev, ...result.club }));
      
      // If name changed, navigate to new URL
      if (result.club.url_slug !== clubname) {
        navigate(`/club/${result.club.url_slug}/settings`, { replace: true });
      }
      
    } catch (err) {
      setError(handleApiError(err, 'Failed to update club settings'));
    } finally {
      setSaving(false);
    }
  };

  const handleClubPictureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 100 * 1024 * 1024) {
        setError('Club picture must be less than 100MB');
        return;
      }
      setEditForm(prev => ({ ...prev, clubPicture: file }));
    }
  };

  const handleLeaveClub = async () => {
    if (!club?.id) return;
    
    try {
      await clubAPI.leaveClub(club.id);
      navigate('/dashboard');
    } catch (err) {
      setError(handleApiError(err, 'Failed to leave club'));
    }
  };

  const getClubPictureUrl = (clubPicture) => {
    if (!clubPicture) return null;
    
    // If it starts with http, it's already a full URL
    if (clubPicture.startsWith('http')) {
      return clubPicture;
    }
    
    // Otherwise, construct the URL
    const baseUrl = process.env.REACT_APP_API_URL || window.location.origin;
    return `${baseUrl}${clubPicture}`;
  };

  const getProfilePictureUrl = (profilePicture) => {
    if (!profilePicture) return null;
    
    // If it starts with http, it's already a full URL
    if (profilePicture.startsWith('http')) {
      return profilePicture;
    }
    
    // Otherwise, construct the URL
    const baseUrl = process.env.REACT_APP_API_URL || window.location.origin;
    return `${baseUrl}${profilePicture}`;
  };

  if (loading) return <LoadingSpinner />;
  if (!club) return null;

  const canEditClub = club.user_role === 'director' || club.user_role === 'producer';
  const isProducer = club.user_role === 'producer';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <button
          onClick={() => navigate(`/club/${clubname}`)}
          className="text-gray-400 hover:text-white mb-4 inline-flex items-center"
        >
          ← Back to Club
        </button>
        <h1 className="text-3xl font-bold">Club Settings</h1>
        <p className="text-gray-400 mt-2">{club.name}</p>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-600 text-red-200 p-4 rounded-lg mb-6">
          {error}
          <button
            onClick={() => setError('')}
            className="ml-4 text-red-300 hover:text-red-100"
          >
            ✕
          </button>
        </div>
      )}

      {canEditClub && (
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">General Settings</h2>
          
          <form onSubmit={handleSaveSettings} className="space-y-6">
            {/* Club Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Club Name *
              </label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                className="input"
                required
                maxLength={100}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                className="input h-24 resize-none"
                placeholder="What's your club about?"
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">{editForm.description.length}/500 characters</p>
            </div>

            {/* Club Picture */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Club Picture
              </label>
              <div className="flex items-center gap-4">
                {getClubPictureUrl(club.club_picture) && (
                  <img
                    src={getClubPictureUrl(club.club_picture)}
                    alt={club.name}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleClubPictureChange}
                  className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gray-700 file:text-gray-300 hover:file:bg-gray-600"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Max size: 100MB. Supports JPG, PNG, GIF, WebP</p>
            </div>

            {/* Privacy Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={editForm.isPublic}
                    onChange={(e) => setEditForm(prev => ({ ...prev, isPublic: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-300">Public Club</span>
                </label>
                <p className="text-xs text-gray-500 mt-1">Allow anyone to discover and join this club</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Club Password
                </label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                  className="input"
                  placeholder="Leave empty to remove password"
                />
                <p className="text-xs text-gray-500 mt-1">Optional extra security for joining</p>
              </div>
            </div>

            {/* Max Members */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Maximum Members
              </label>
              <input
                type="number"
                min="2"
                max="200"
                value={editForm.maxMembers}
                onChange={(e) => setEditForm(prev => ({ ...prev, maxMembers: parseInt(e.target.value) || 50 }))}
                className="input"
              />
              <p className="text-xs text-gray-500 mt-1">
                Current: {members.length} members
              </p>
            </div>

            {/* Invite Code */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Invite Code
              </label>
              <div className="flex items-center gap-4">
                <code className="bg-gray-700 px-4 py-2 rounded font-mono text-lg tracking-wider">
                  {club.invite_code}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(club.invite_code);
                    // You could add a toast notification here
                  }}
                  className="btn-secondary text-sm"
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Save Button */}
            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </div>
      )}

      {/* Members List */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Members ({members.length})</h2>
        <div className="space-y-2">
          {members.map(member => (
            <div key={member.id} className="bg-gray-900 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getProfilePictureUrl(member.profile_picture) ? (
                  <img
                    src={getProfilePictureUrl(member.profile_picture)}
                    alt={member.display_name || member.username}
                    className="w-10 h-10 rounded-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className={`w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center ${
                    getProfilePictureUrl(member.profile_picture) ? 'hidden' : 'flex'
                  }`}
                >
                  <span>{(member.display_name || member.username).charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <div className="font-medium">{member.display_name || member.username}</div>
                  <div className="text-sm text-gray-500 capitalize">{member.role}</div>
                </div>
              </div>
              
              {isProducer && member.id !== user.id && (
                <div className="flex items-center gap-2">
                  {/* Role management could go here */}
                  <span className="text-sm text-gray-500">
                    Joined {new Date(member.joined_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-gray-800 rounded-lg p-6 border border-red-900">
        <h2 className="text-xl font-semibold mb-4 text-red-500">Danger Zone</h2>
        <div className="space-y-4">
          <div>
            <button
              onClick={() => setShowLeaveDialog(true)}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-medium"
            >
              Leave Club
            </button>
            <p className="text-sm text-gray-400 mt-2">
              {club.user_role === 'producer' 
                ? 'As the producer, you must transfer ownership before leaving.'
                : 'You will lose access to this club and all its content.'}
            </p>
          </div>
        </div>
      </div>

      {/* Leave Confirmation Dialog */}
      {showLeaveDialog && (
        <ConfirmDialog
          title="Leave Club"
          message={`Are you sure you want to leave "${club.name}"? This action cannot be undone.`}
          confirmText="Leave Club"
          confirmButtonClass="bg-red-600 hover:bg-red-700"
          onConfirm={handleLeaveClub}
          onCancel={() => setShowLeaveDialog(false)}
        />
      )}
    </div>
  );
};

export default ClubSettingsPage;