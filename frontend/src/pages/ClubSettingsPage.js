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
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);

  useEffect(() => {
    if (clubname) {
      fetchClubDetails();
    }
  }, [clubname]);

  const fetchClubDetails = async () => {
    try {
      setLoading(true);
      const response = await clubAPI.getClubByName(clubname);
      const clubData = response.data.club;
      
      // Check permissions
      if (clubData.user_role !== 'director' && clubData.user_role !== 'producer') {
        navigate(`/club/${clubname}`);
        return;
      }
      
      setClub(clubData);
      
      // Fetch members
      const membersResponse = await clubAPI.getMembers(clubData.id);
      setMembers(membersResponse.data.members);
      
    } catch (err) {
      console.error('Error fetching club:', err);
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveClub = async () => {
    try {
      await clubAPI.leaveClub(club.id);
      navigate('/dashboard');
    } catch (err) {
      setError(handleApiError(err, 'Failed to leave club'));
    }
  };

  const getRoleDisplayName = (role) => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  const getRoleBadgeColor = (role) => {
    switch(role) {
      case 'producer': return 'bg-purple-600';
      case 'director': return 'bg-blue-600';
      case 'critic': return 'bg-gray-600';
      default: return 'bg-gray-600';
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!club) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <button
          onClick={() => navigate(`/club/${clubname}`)}
          className="text-gray-400 hover:text-white mb-4 inline-flex items-center transition-colors"
        >
          ← Back to Club
        </button>
        <h1 className="text-3xl font-bold">Club Settings</h1>
        <p className="text-gray-400 mt-2">{club.name}</p>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-600 text-red-200 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Club Information */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Club Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Club Name</label>
            <div className="bg-gray-900 p-3 rounded border text-gray-200">{club.name}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Invite Code</label>
            <div className="bg-gray-900 p-3 rounded border text-gray-200 font-mono">{club.invite_code}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Visibility</label>
            <div className="bg-gray-900 p-3 rounded border text-gray-200">
              {club.is_public ? 'Public' : 'Private'}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Members</label>
            <div className="bg-gray-900 p-3 rounded border text-gray-200">
              {club.member_count} / {club.max_members}
            </div>
          </div>
        </div>
        {club.description && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
            <div className="bg-gray-900 p-3 rounded border text-gray-200">{club.description}</div>
          </div>
        )}
      </div>

      {/* Members List */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Members ({members.length})</h2>
        <div className="space-y-3">
          {members.map(member => (
            <div key={member.id} className="bg-gray-900 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center">
                  {member.profile_picture ? (
                    <img 
                      src={`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}${member.profile_picture}`}
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
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${getRoleBadgeColor(member.role)}`}>
                  {getRoleDisplayName(member.role)}
                </span>
                <div className="text-right text-sm">
                  <div className="text-gray-300">{member.cycles_won || 0} wins</div>
                  <div className="text-gray-500">{Math.round(member.average_points || 0)} avg pts</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-gray-800 rounded-lg p-6 border border-red-900">
        <h2 className="text-xl font-semibold mb-4 text-red-400">Danger Zone</h2>
        <p className="text-gray-300 mb-4">
          Leaving this club will remove you from all current and future activities. This action cannot be undone.
        </p>
        <button
          onClick={() => setShowConfirmLeave(true)}
          className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded font-medium transition-colors"
        >
          Leave Club
        </button>
      </div>

      {/* Confirm Leave Dialog */}
      <ConfirmDialog
        isOpen={showConfirmLeave}
        onClose={() => setShowConfirmLeave(false)}
        onConfirm={handleLeaveClub}
        title="Leave Club"
        message={`Are you sure you want to leave ${club.name}? This action cannot be undone.`}
        confirmText="Leave Club"
        confirmStyle="bg-red-600 hover:bg-red-700"
      />
    </div>
  );
};

export default ClubSettingsPage;