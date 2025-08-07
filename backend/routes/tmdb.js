const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticateToken } = require('../middleware/auth');

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.TMDB_API_KEY;

// Search movies
router.get('/search/movie', authenticateToken, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.json({ results: [] });
    }

    console.log('TMDB search for:', query); // Debug log
    console.log('Using API key:', TMDB_API_KEY ? 'Key is set' : 'KEY IS MISSING'); // Debug log

    const response = await axios.get(`${TMDB_BASE_URL}/search/movie`, {
      params: {
        api_key: TMDB_API_KEY,
        query: query,
        language: 'en-US',
        page: 1,
        include_adult: false
      }
    });

    console.log('TMDB results count:', response.data.results.length); // Debug log

    res.json({
      results: response.data.results.slice(0, 10) // Limit to 10 results
    });
  } catch (err) {
    console.error('TMDB search error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to search movies' });
  }
});

// Get movie details
router.get('/movie/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const response = await axios.get(`${TMDB_BASE_URL}/movie/${id}`, {
      params: {
        api_key: TMDB_API_KEY,
        language: 'en-US'
      }
    });

    res.json(response.data);
  } catch (err) {
    console.error('TMDB movie error:', err);
    res.status(500).json({ error: 'Failed to get movie details' });
  }
});

// Get popular movies
router.get('/popular', authenticateToken, async (req, res) => {
  try {
    const response = await axios.get(`${TMDB_BASE_URL}/movie/popular`, {
      params: {
        api_key: TMDB_API_KEY,
        language: 'en-US',
        page: 1
      }
    });

    res.json({
      results: response.data.results.slice(0, 20)
    });
  } catch (err) {
    console.error('TMDB popular error:', err);
    res.status(500).json({ error: 'Failed to get popular movies' });
  }
});

// Get top rated movies
router.get('/top-rated', authenticateToken, async (req, res) => {
  try {
    const response = await axios.get(`${TMDB_BASE_URL}/movie/top_rated`, {
      params: {
        api_key: TMDB_API_KEY,
        language: 'en-US',
        page: 1
      }
    });

    res.json({
      results: response.data.results.slice(0, 20)
    });
  } catch (err) {
    console.error('TMDB top rated error:', err);
    res.status(500).json({ error: 'Failed to get top rated movies' });
  }
});

// Get upcoming movies
router.get('/upcoming', authenticateToken, async (req, res) => {
  try {
    const response = await axios.get(`${TMDB_BASE_URL}/movie/upcoming`, {
      params: {
        api_key: TMDB_API_KEY,
        language: 'en-US',
        page: 1
      }
    });

    res.json({
      results: response.data.results.slice(0, 20)
    });
  } catch (err) {
    console.error('TMDB upcoming error:', err);
    res.status(500).json({ error: 'Failed to get upcoming movies' });
  }
});

// Get movie credits (cast and crew)
router.get('/movie/:id/credits', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const response = await axios.get(`${TMDB_BASE_URL}/movie/${id}/credits`, {
      params: {
        api_key: TMDB_API_KEY
      }
    });

    res.json({
      cast: response.data.cast.slice(0, 15), // Top 15 cast members
      crew: response.data.crew.filter(person => 
        ['Director', 'Producer', 'Screenplay', 'Writer'].includes(person.job)
      )
    });
  } catch (err) {
    console.error('TMDB credits error:', err);
    res.status(500).json({ error: 'Failed to get movie credits' });
  }
});

// Get movie recommendations
router.get('/movie/:id/recommendations', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const response = await axios.get(`${TMDB_BASE_URL}/movie/${id}/recommendations`, {
      params: {
        api_key: TMDB_API_KEY,
        language: 'en-US',
        page: 1
      }
    });

    res.json({
      results: response.data.results.slice(0, 10)
    });
  } catch (err) {
    console.error('TMDB recommendations error:', err);
    res.status(500).json({ error: 'Failed to get movie recommendations' });
  }
});

module.exports = router;