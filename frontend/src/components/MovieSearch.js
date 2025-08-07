import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';

const MovieSearch = ({ onSelectMovie }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const searchTimeout = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // Clear previous timeout
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    // Don't search if query is too short
    if (query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    // Set a new timeout for debounced search
    searchTimeout.current = setTimeout(() => {
      searchMovies();
    }, 300); // 300ms debounce

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [query]);

  const searchMovies = async () => {
    if (query.length < 2) return;

    try {
      setLoading(true);
      console.log('Searching for movies:', query); // Debug log
      
      const response = await api.get('/tmdb/search/movie', {
        params: { query }
      });
      
      console.log('Search results:', response.data); // Debug log
      setResults(response.data.results || []);
      setShowDropdown(true);
    } catch (err) {
      console.error('Error searching movies:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMovie = (movie) => {
    onSelectMovie(movie);
    setQuery('');
    setResults([]);
    setShowDropdown(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for a movie..."
        className="w-full bg-gray-900 px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
      />
      
      {loading && (
        <div className="absolute right-3 top-2.5">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
        </div>
      )}

      {showDropdown && results.length > 0 && (
        <div className="absolute z-10 w-full mt-2 bg-gray-900 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {results.map(movie => (
            <div
              key={movie.id}
              onClick={() => handleSelectMovie(movie)}
              className="flex items-center p-3 hover:bg-gray-800 cursor-pointer border-b border-gray-800 last:border-b-0"
            >
              {movie.poster_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`}
                  alt={movie.title}
                  className="w-12 h-18 object-cover rounded mr-3"
                />
              ) : (
                <div className="w-12 h-18 bg-gray-700 rounded mr-3 flex items-center justify-center">
                  <span className="text-gray-500 text-xs">No Image</span>
                </div>
              )}
              <div className="flex-1">
                <h4 className="font-medium">{movie.title}</h4>
                <p className="text-sm text-gray-500">
                  {movie.release_date ? new Date(movie.release_date).getFullYear() : 'No date'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showDropdown && query.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute z-10 w-full mt-2 bg-gray-900 rounded-lg shadow-lg p-4 text-center text-gray-500">
          No movies found
        </div>
      )}
    </div>
  );
};

export default MovieSearch;