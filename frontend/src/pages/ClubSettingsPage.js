// Create this new file with the following content:
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
    if (!window.confirm('Are you sure you want to leave this club?')) return;
    
    try {
      await clubAPI.leaveClub(club.id);
      navigate('/dashboard');
    } catch (err) {
      setError(handleApiError(err, 'Failed to leave club'));
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!club) return null;

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
        </div>
      )}

      {/* Members List */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Members ({members.length})</h2>
        <div className="space-y-2">
          {members.map(member => (
            <div key={member.id} className="bg-gray-900 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                  <span>{(member.display_name || member.username).charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <div className="font-medium">{member.display_name || member.username}</div>
                  <div className="text-sm text-gray-500 capitalize">{member.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-gray-800 rounded-lg p-6 border border-red-900">
        <h2 className="text-xl font-semibold mb-4 text-red-500">Danger Zone</h2>
        <button
          onClick={handleLeaveClub}
          className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-medium"
        >
          Leave Club
        </button>
      </div>
    </div>
  );
};

export default ClubSettingsPage;