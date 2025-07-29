const express = require('express');
const axios = require('axios');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

// Helper function to make TMDB API calls
const tmdbRequest = async (endpoint, params = {}) => {
  try {
    const response = await axios.get(`${TMDB_BASE_URL}${endpoint}`, {
      params: {
        api_key: process.env.TMDB_API_KEY,
        ...params
      }
    });
    return response.data;
  } catch (error) {
    console.error('TMDB API error:', error.response?.data || error.message);
    throw new Error('Failed to fetch data from TMDB');
  }
};

// Search for movies
router.get('/search/movie', authenticateToken, async (req, res) => {
  const { query, page = 1 } = req.query;

  if (!query || query.trim().length === 0) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const data = await tmdbRequest('/search/movie', {
      query: query.trim(),
      page: parseInt(page),
      include_adult: false
    });

    // Filter and format results
    const movies = data.results
      .filter(movie => movie.release_date && movie.poster_path) // Only movies with release date and poster
      .map(movie => ({
        id: movie.id,
        title: movie.title,
        year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
        releaseDate: movie.release_date,
        overview: movie.overview,
        posterPath: movie.poster_path ? `${IMAGE_BASE_URL}${movie.poster_path}` : null,
        backdropPath: movie.backdrop_path ? `${IMAGE_BASE_URL}${movie.backdrop_path}` : null,
        genreIds: movie.genre_ids,
        voteAverage: movie.vote_average,
        voteCount: movie.vote_count,
        adult: movie.adult,
        originalLanguage: movie.original_language,
        popularity: movie.popularity
      }))
      .sort((a, b) => b.popularity - a.popularity); // Sort by popularity

    res.json({
      results: movies,
      totalResults: data.total_results,
      totalPages: data.total_pages,
      currentPage: data.page
    });

  } catch (error) {
    console.error('Movie search error:', error);
    res.status(500).json({ error: 'Failed to search movies' });
  }
});

// Get movie details by ID
router.get('/movie/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'Valid movie ID is required' });
  }

  try {
    const [movieData, creditsData] = await Promise.all([
      tmdbRequest(`/movie/${id}`),
      tmdbRequest(`/movie/${id}/credits`)
    ]);

    // Find director from crew
    const director = creditsData.crew.find(person => person.job === 'Director');

    // Format movie data
    const movie = {
      id: movieData.id,
      title: movieData.title,
      originalTitle: movieData.original_title,
      year: movieData.release_date ? new Date(movieData.release_date).getFullYear() : null,
      releaseDate: movieData.release_date,
      overview: movieData.overview,
      runtime: movieData.runtime,
      posterPath: movieData.poster_path ? `${IMAGE_BASE_URL}${movieData.poster_path}` : null,
      backdropPath: movieData.backdrop_path ? `${IMAGE_BASE_URL}${movieData.backdrop_path}` : null,
      genres: movieData.genres,
      genreIds: movieData.genres.map(g => g.id),
      director: director ? director.name : null,
      cast: creditsData.cast.slice(0, 10).map(actor => ({
        id: actor.id,
        name: actor.name,
        character: actor.character,
        profilePath: actor.profile_path ? `${IMAGE_BASE_URL}${actor.profile_path}` : null
      })),
      voteAverage: movieData.vote_average,
      voteCount: movieData.vote_count,
      popularity: movieData.popularity,
      budget: movieData.budget,
      revenue: movieData.revenue,
      status: movieData.status,
      tagline: movieData.tagline,
      adult: movieData.adult,
      originalLanguage: movieData.original_language,
      spokenLanguages: movieData.spoken_languages,
      productionCompanies: movieData.production_companies,
      productionCountries: movieData.production_countries,
      homepage: movieData.homepage,
      imdbId: movieData.imdb_id
    };

    res.json({ movie });

  } catch (error) {
    console.error('Get movie details error:', error);
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'Movie not found' });
    }
    res.status(500).json({ error: 'Failed to get movie details' });
  }
});

// Get popular movies
router.get('/movie/popular', authenticateToken, async (req, res) => {
  const { page = 1 } = req.query;

  try {
    const data = await tmdbRequest('/movie/popular', {
      page: parseInt(page)
    });

    const movies = data.results.map(movie => ({
      id: movie.id,
      title: movie.title,
      year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
      releaseDate: movie.release_date,
      overview: movie.overview,
      posterPath: movie.poster_path ? `${IMAGE_BASE_URL}${movie.poster_path}` : null,
      backdropPath: movie.backdrop_path ? `${IMAGE_BASE_URL}${movie.backdrop_path}` : null,
      genreIds: movie.genre_ids,
      voteAverage: movie.vote_average,
      voteCount: movie.vote_count,
      popularity: movie.popularity
    }));

    res.json({
      results: movies,
      totalResults: data.total_results,
      totalPages: data.total_pages,
      currentPage: data.page
    });

  } catch (error) {
    console.error('Get popular movies error:', error);
    res.status(500).json({ error: 'Failed to get popular movies' });
  }
});

// Get movie genres
router.get('/genre/movie/list', authenticateToken, async (req, res) => {
  try {
    const data = await tmdbRequest('/genre/movie/list');

    res.json({ genres: data.genres });

  } catch (error) {
    console.error('Get genres error:', error);
    res.status(500).json({ error: 'Failed to get movie genres' });
  }
});

// Get trending movies
router.get('/trending/movie/:timeWindow', authenticateToken, async (req, res) => {
  const { timeWindow } = req.params; // 'day' or 'week'
  const { page = 1 } = req.query;

  if (!['day', 'week'].includes(timeWindow)) {
    return res.status(400).json({ error: 'Time window must be "day" or "week"' });
  }

  try {
    const data = await tmdbRequest(`/trending/movie/${timeWindow}`, {
      page: parseInt(page)
    });

    const movies = data.results.map(movie => ({
      id: movie.id,
      title: movie.title,
      year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
      releaseDate: movie.release_date,
      overview: movie.overview,
      posterPath: movie.poster_path ? `${IMAGE_BASE_URL}${movie.poster_path}` : null,
      backdropPath: movie.backdrop_path ? `${IMAGE_BASE_URL}${movie.backdrop_path}` : null,
      genreIds: movie.genre_ids,
      voteAverage: movie.vote_average,
      voteCount: movie.vote_count,
      popularity: movie.popularity
    }));

    res.json({
      results: movies,
      totalResults: data.total_results,
      totalPages: data.total_pages,
      currentPage: data.page
    });

  } catch (error) {
    console.error('Get trending movies error:', error);
    res.status(500).json({ error: 'Failed to get trending movies' });
  }
});

// Discover movies with filters
router.get('/discover/movie', authenticateToken, async (req, res) => {
  const {
    page = 1,
    sortBy = 'popularity.desc',
    withGenres,
    year,
    primaryReleaseYear,
    voteAverageGte,
    voteAverageLte,
    withRuntimeGte,
    withRuntimeLte
  } = req.query;

  try {
    const params = {
      page: parseInt(page),
      sort_by: sortBy
    };

    if (withGenres) params.with_genres = withGenres;
    if (year) params.year = year;
    if (primaryReleaseYear) params.primary_release_year = primaryReleaseYear;
    if (voteAverageGte) params['vote_average.gte'] = voteAverageGte;
    if (voteAverageLte) params['vote_average.lte'] = voteAverageLte;
    if (withRuntimeGte) params['with_runtime.gte'] = withRuntimeGte;
    if (withRuntimeLte) params['with_runtime.lte'] = withRuntimeLte;

    const data = await tmdbRequest('/discover/movie', params);

    const movies = data.results.map(movie => ({
      id: movie.id,
      title: movie.title,
      year: movie.release_date ? new Date(movie.release_date).getFullYear() : null,
      releaseDate: movie.release_date,
      overview: movie.overview,
      posterPath: movie.poster_path ? `${IMAGE_BASE_URL}${movie.poster_path}` : null,
      backdropPath: movie.backdrop_path ? `${IMAGE_BASE_URL}${movie.backdrop_path}` : null,
      genreIds: movie.genre_ids,
      voteAverage: movie.vote_average,
      voteCount: movie.vote_count,
      popularity: movie.popularity
    }));

    res.json({
      results: movies,
      totalResults: data.total_results,
      totalPages: data.total_pages,
      currentPage: data.page
    });

  } catch (error) {
    console.error('Discover movies error:', error);
    res.status(500).json({ error: 'Failed to discover movies' });
  }
});

module.exports = router;