import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clubAPI, handleApiError } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

const CreateClubPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: false,
    password: '',
    maxMembers: 50,
  });
  const [clubPicture, setClubPicture] = useState(null);
  const [picturePreview, setPicturePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear errors when user starts typing
    if (error) setError('');
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handlePictureChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size (100MB limit as per backend)
    if (file.size > 100 * 1024 * 1024) {
      setError('Club picture must be less than 100MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    setClubPicture(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPicturePreview(reader.result);
    };
    reader.readAsDataURL(file);
    
    if (error) setError('');
  };

  const validateForm = () => {
    const errors = {};
    
    // Name validation
    if (!formData.name.trim()) {
      errors.name = 'Club name is required';
    } else if (formData.name.length > 100) {
      errors.name = 'Club name must be less than 100 characters';
    }

    // Description validation (optional)
    if (formData.description && formData.description.length > 500) {
      errors.description = 'Description must be less than 500 characters';
    }

    // Password validation (if not public)
    if (!formData.isPublic && formData.password && formData.password.length < 3) {
      errors.password = 'Password must be at least 3 characters if provided';
    }

    // Max members validation
    if (formData.maxMembers < 2 || formData.maxMembers > 200) {
      errors.maxMembers = 'Max members must be between 2 and 200';
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    setError('');
    setFieldErrors({});

    try {
      const clubData = {
        ...formData,
        name: formData.name.trim(),
        description: formData.description.trim(),
        maxMembers: parseInt(formData.maxMembers),
      };

      if (clubPicture) {
        clubData.clubPicture = clubPicture;
      }

      const response = await clubAPI.createClub(clubData);
      
      // Redirect to the new club
      navigate(`/club/${response.data.club.id}`, {
        state: { message: 'Club created successfully!' }
      });
    } catch (error) {
      setError(handleApiError(error, 'Failed to create club'));
    } finally {
      setLoading(false);
    }
  };

  const removePicture = () => {
    setClubPicture(null);
    setPicturePreview(null);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Create New Club</h1>
        <p className="text-gray-400">
          Start your own movie club and invite friends to join the fun
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

          {/* Club Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
              Club Name *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={formData.name}
              onChange={handleChange}
              className={`input ${fieldErrors.name ? 'input-error' : ''}`}
              placeholder="Enter a memorable club name"
              disabled={loading}
              maxLength={100}
            />
            {fieldErrors.name && (
              <p className="mt-1 text-sm text-red-400">{fieldErrors.name}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              {formData.name.length}/100 characters
            </p>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              className={`input min-h-[100px] resize-vertical ${fieldErrors.description ? 'input-error' : ''}`}
              placeholder="Describe your club's focus, rules, or theme preferences..."
              disabled={loading}
              maxLength={500}
            />
            {fieldErrors.description && (
              <p className="mt-1 text-sm text-red-400">{fieldErrors.description}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              {formData.description.length}/500 characters
            </p>
          </div>

          {/* Club Picture */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Club Picture
            </label>
            
            {picturePreview ? (
              <div className="relative inline-block">
                <img
                  src={picturePreview}
                  alt="Club preview"
                  className="w-32 h-32 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={removePicture}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-sm hover:bg-red-700"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div>
                <label className="btn-secondary cursor-pointer">
                  Choose Picture
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePictureChange}
                    className="hidden"
                    disabled={loading}
                  />
                </label>
                <p className="text-xs text-gray-500 mt-2">
                  Optional • Max 100MB • PNG, JPG, GIF, WebP
                </p>
              </div>
            )}
          </div>

          {/* Max Members */}
          <div>
            <label htmlFor="maxMembers" className="block text-sm font-medium text-gray-300 mb-2">
              Maximum Members
            </label>
            <input
              id="maxMembers"
              name="maxMembers"
              type="number"
              min="2"
              max="200"
              value={formData.maxMembers}
              onChange={handleChange}
              className={`input ${fieldErrors.maxMembers ? 'input-error' : ''}`}
              disabled={loading}
            />
            {fieldErrors.maxMembers && (
              <p className="mt-1 text-sm text-red-400">{fieldErrors.maxMembers}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Set a limit for how many members can join (2-200)
            </p>
          </div>

          {/* Privacy Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-200">Privacy Settings</h3>
            
            {/* Public Club Toggle */}
            <div className="flex items-center">
              <input
                id="isPublic"
                name="isPublic"
                type="checkbox"
                checked={formData.isPublic}
                onChange={handleChange}
                className="w-4 h-4 text-primary-600 bg-gray-700 border-gray-600 rounded focus:ring-primary-500 focus:ring-2"
                disabled={loading}
              />
              <label htmlFor="isPublic" className="ml-2 text-sm text-gray-300">
                Make this club public
              </label>
            </div>
            <p className="text-xs text-gray-500 ml-6">
              Public clubs appear in the club directory and can be discovered by anyone
            </p>

            {/* Password Protection */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Club Password {!formData.isPublic && '(Optional)'}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                className={`input ${fieldErrors.password ? 'input-error' : ''}`}
                placeholder={formData.isPublic ? "Password protects invite codes" : "Additional security (optional)"}
                disabled={loading}
              />
              {fieldErrors.password && (
                <p className="mt-1 text-sm text-red-400">{fieldErrors.password}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                {formData.isPublic 
                  ? "Required password for anyone joining, even with invite codes"
                  : "Optional extra protection for your club"
                }
              </p>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">Creating Club...</span>
                </div>
              ) : (
                '🎬 Create Club'
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              disabled={loading}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>

        {/* Info Box */}
        <div className="mt-8 p-4 bg-primary-900/20 border border-primary-800 rounded-lg">
          <h4 className="text-sm font-medium text-primary-300 mb-2">
            🎯 What happens next?
          </h4>
          <ul className="text-xs text-gray-400 space-y-1">
            <li>• You'll become the club's Producer (owner)</li>
            <li>• You'll get a unique invite code to share</li>
            <li>• You can add themes to start movie cycles</li>
            <li>• Invite friends and start watching movies together!</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CreateClubPage;