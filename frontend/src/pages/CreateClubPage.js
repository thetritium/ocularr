import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { toast } from '../components/Toast';
import { confirm } from '../components/ConfirmDialog';

const CreateClubPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: true,
    password: '',
    maxMembers: 50,
    clubPicture: null
  });
  const [errors, setErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (100MB limit)
      if (file.size > 100 * 1024 * 1024) {
        toast.error('Image size should be less than 100MB');
        return;
      }

      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        toast.error('Please upload a valid image file (JPEG, PNG, GIF, or WebP)');
        return;
      }

      setFormData(prev => ({ ...prev, clubPicture: file }));
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setFormData(prev => ({ ...prev, clubPicture: null }));
    setImagePreview(null);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Club name is required';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Club name must be 100 characters or less';
    }

    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'Description must be 500 characters or less';
    }

    if (!formData.isPublic && !formData.password) {
      newErrors.password = 'Password is required for private clubs';
    }

    if (formData.maxMembers < 2 || formData.maxMembers > 100) {
      newErrors.maxMembers = 'Max members must be between 2 and 100';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    // Confirm creation
    const confirmed = await confirm({
      title: 'Create Club',
      message: `Are you ready to create "${formData.name}"? You'll become the Producer of this club.`,
      confirmText: 'Create Club',
      type: 'success'
    });

    if (!confirmed) return;

    setLoading(true);

    try {
      const data = new FormData();
      data.append('name', formData.name);
      data.append('description', formData.description);
      data.append('isPublic', formData.isPublic);
      data.append('password', formData.password);
      data.append('maxMembers', formData.maxMembers);
      if (formData.clubPicture) {
        data.append('clubPicture', formData.clubPicture);
      }

      const response = await api.post('/clubs', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success('Club created successfully!');
      navigate(`/club/${response.data.club.url_slug}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create club');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-fadeIn">
      <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6">
          <h1 className="text-3xl font-bold">Create a Movie Club</h1>
          <p className="text-blue-100 mt-2">
            Start your cinematic journey with friends
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Club Picture */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Club Picture
            </label>
            <div className="flex items-center space-x-4">
              {imagePreview ? (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Club preview"
                    className="w-32 h-32 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <label className="w-32 h-32 flex flex-col items-center justify-center border-2 border-gray-600 border-dashed rounded-lg cursor-pointer hover:border-gray-500 transition-colors">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="mt-2 text-xs text-gray-400">Upload Image</span>
                  <input
                    type="file"
                    onChange={handleImageChange}
                    accept="image/*"
                    className="hidden"
                  />
                </label>
              )}
              <div className="text-sm text-gray-400">
                <p>Optional club picture</p>
                <p>Max size: 100MB</p>
                <p>Formats: JPEG, PNG, GIF, WebP</p>
              </div>
            </div>
          </div>

          {/* Club Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-2">
              Club Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="e.g., Friday Night Films"
              className={`input ${errors.name ? 'border-red-500' : ''}`}
              maxLength={100}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              {formData.name.length}/100 characters
            </p>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-2">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="What's your club about?"
              rows={4}
              className={`input ${errors.description ? 'border-red-500' : ''}`}
              maxLength={500}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-500">{errors.description}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              {formData.description.length}/500 characters
            </p>
          </div>

          {/* Privacy Settings */}
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isPublic"
                name="isPublic"
                checked={formData.isPublic}
                onChange={handleInputChange}
                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="isPublic" className="ml-2 text-sm">
                Make this club public (discoverable by anyone)
              </label>
            </div>

            {!formData.isPublic && (
              <div className="ml-6 animate-fadeIn">
                <label htmlFor="password" className="block text-sm font-medium mb-2">
                  Club Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Required for private clubs"
                  className={`input ${errors.password ? 'border-red-500' : ''}`}
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-500">{errors.password}</p>
                )}
              </div>
            )}
          </div>
          {/* Max Members */}
          <div>
            <label htmlFor="maxMembers" className="block text-sm font-medium mb-2">
              Maximum Members
            </label>
            <input
              type="number"
              id="maxMembers"
              name="maxMembers"
              value={formData.maxMembers}
              onChange={handleInputChange}
              min={2}
              max={100}
              className={`input ${errors.maxMembers ? 'border-red-500' : ''}`}
            />
            {errors.maxMembers && (
              <p className="mt-1 text-sm text-red-500">{errors.maxMembers}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              How many people can join your club (2-100)
            </p>
          </div>

          {/* Club Preview */}
          <div className="border-t border-gray-700 pt-6">
            <h3 className="text-lg font-medium mb-4">Preview</h3>
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="flex items-start space-x-4">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Club preview"
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center">
                    <span className="text-2xl font-bold text-gray-500">
                      {formData.name.charAt(0).toUpperCase() || '?'}
                    </span>
                  </div>
                )}
                <div className="flex-1">
                  <h4 className="font-semibold text-lg">
                    {formData.name || 'Your Club Name'}
                  </h4>
                  <p className="text-sm text-gray-400 mt-1">
                    {formData.description || 'Your club description will appear here'}
                  </p>
                  <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                    <span>{formData.isPublic ? '🌍 Public' : '🔒 Private'}</span>
                    <span>👥 {formData.maxMembers} max members</span>
                    <span>👑 {user?.username || 'You'} (Producer)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-6">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Creating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create Club
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Tips Section */}
      <div className="mt-8 bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-medium mb-4">🎬 Tips for a Great Movie Club</h3>
        <ul className="space-y-2 text-sm text-gray-400">
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>Choose a catchy name that reflects your club's personality</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>Add a clear description so potential members know what to expect</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>Public clubs grow faster, but private clubs offer more intimacy</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>Start with a smaller member limit - you can always increase it later</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-500 mr-2">•</span>
            <span>As the Producer, you'll have full control over your club's settings</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default CreateClubPage;

// Combine Part 1 and Part 2 when implementing