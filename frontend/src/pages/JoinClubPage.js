import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { clubAPI, handleApiError } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

const JoinClubPage = () => {
  const [formData, setFormData] = useState({
    inviteCode: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value.toUpperCase() // Invite codes are uppercase
    }));
    
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.inviteCode.trim()) {
      setError('Invite code is required');
      return;
    }

    if (formData.inviteCode.length !== 8) {
      setError('Invite code must be 8 characters long');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await clubAPI.joinClub(
        formData.inviteCode.trim(),
        formData.password.trim() || undefined
      );
      
      // Success - redirect to dashboard with success message
      navigate('/dashboard', {
        state: { message: response.data.message || 'Successfully joined the club!' }
      });
    } catch (error) {
      const errorMsg = handleApiError(error, 'Failed to join club');
      setError(errorMsg);
      
      // Check if error is about password requirement
      if (error.response?.status === 401 && errorMsg.includes('Password required')) {
        setNeedsPassword(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatInviteCode = (code) => {
    // Add spaces every 4 characters for better readability
    return code.replace(/(.{4})/g, '$1 ').trim();
  };

  const handleInviteCodeChange = (e) => {
    let value = e.target.value.replace(/\s/g, '').toUpperCase();
    
    // Limit to 8 characters
    if (value.length > 8) {
      value = value.substring(0, 8);
    }
    
    setFormData(prev => ({
      ...prev,
      inviteCode: value
    }));
    
    if (error) setError('');
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-md">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Join a Club</h1>
        <p className="text-gray-400">
          Enter an invite code to join an existing movie club
        </p>
      </div>

      <div className="card p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-900/50 border border-red-600 text-red-200 p-4 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Invite Code */}
          <div>
            <label htmlFor="inviteCode" className="block text-sm font-medium text-gray-300 mb-2">
              Invite Code *
            </label>
            <input
              id="inviteCode"
              name="inviteCode"
              type="text"
              required
              value={formatInviteCode(formData.inviteCode)}
              onChange={handleInviteCodeChange}
              className="input text-center text-lg font-mono tracking-wider"
              placeholder="ABCD EFGH"
              disabled={loading}
              maxLength={9} // 8 chars + 1 space
            />
            <p className="mt-1 text-xs text-gray-500">
              8-character code provided by the club owner
            </p>
          </div>

          {/* Password (if needed) */}
          {needsPassword && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Club Password *
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="input"
                placeholder="Enter the club password"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500">
                This club requires a password to join
              </p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !formData.inviteCode.trim()}
            className="btn-primary w-full"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <LoadingSpinner size="sm" />
                <span className="ml-2">Joining Club...</span>
              </div>
            ) : (
              '🎬 Join Club'
            )}
          </button>
        </form>

        {/* Help Section */}
        <div className="mt-8 p-4 bg-gray-700/50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-300 mb-3">
            📝 How to get an invite code:
          </h3>
          <ul className="text-xs text-gray-400 space-y-2">
            <li>• Ask a club member for their invite code</li>
            <li>• Club owners and directors can share codes</li>
            <li>• Or browse <Link to="/public-clubs" className="text-primary-400 hover:text-primary-300">public clubs</Link> instead</li>
          </ul>
        </div>

        {/* Alternative Actions */}
        <div className="mt-6 text-center space-y-3">
          <div className="flex items-center">
            <div className="flex-1 border-t border-gray-600"></div>
            <span className="px-4 text-sm text-gray-500">or</span>
            <div className="flex-1 border-t border-gray-600"></div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/public-clubs"
              className="btn-secondary flex-1 text-center"
            >
              Browse Public Clubs
            </Link>
            <Link
              to="/create-club"
              className="btn-ghost flex-1 text-center"
            >
              Create Your Own
            </Link>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-6 card p-4">
        <h4 className="text-sm font-medium text-gray-300 mb-2">
          🎯 What happens after joining?
        </h4>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>• You'll become a Critic in the club</li>
          <li>• Participate in movie cycles and nominations</li>
          <li>• Watch movies and submit rankings</li>
          <li>• Compete for points and cycle wins!</li>
        </ul>
      </div>
    </div>
  );
};

export default JoinClubPage;