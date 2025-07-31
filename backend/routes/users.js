const express = require('express');
const router = express.Router();
const pool = require('../db/db');
const { authenticateToken } = require('../middleware/auth');

// Get user profile
router.get('/:userId/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Get user info with stats
    const userResult = await pool.query(
      `SELECT id, username, email, bio, created_at,
       (SELECT COALESCE(SUM(points), 0) FROM cycle_results WHERE user_id = $1) as total_points,
       (SELECT COUNT(DISTINCT cycle_id) FROM nominations WHERE user_id = $1) as cycles_participated,
       (SELECT COUNT(*) FROM cycle_results WHERE user_id = $1 AND rank = 1) as cycles_won,
       (SELECT COUNT(*) FROM guesses WHERE user_id = $1 AND is_correct = true) as perfect_guesses
       FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get favorite movies
    const favoritesResult = await pool.query(
      'SELECT * FROM user_favorite_movies WHERE user_id = $1 ORDER BY added_at DESC',
      [userId]
    );

    // Get watchlist
    const watchlistResult = await pool.query(
      'SELECT * FROM user_watchlist WHERE user_id = $1 ORDER BY added_at DESC',
      [userId]
    );

    res.json({
      profile: userResult.rows[0],
      favoriteMovies: favoritesResult.rows,
      watchlist: watchlistResult.rows
    });
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, bio } = req.body;

    const result = await pool.query(
      'UPDATE users SET username = $1, bio = $2 WHERE id = $3 RETURNING id, username, email, bio, created_at',
      [username, bio, userId]
    );

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Error updating profile:', err);
    if (err.code === '23505') { // Unique constraint violation
      res.status(400).json({ error: 'Username already taken' });
    } else {
      res.status(500).json({ error: 'Server error' });
    }
  }
});

// Add favorite movie
router.post('/favorite-movies', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { tmdbId, title, posterPath, releaseDate } = req.body;

    // Check if already favorited
    const existing = await pool.query(
      'SELECT * FROM user_favorite_movies WHERE user_id = $1 AND tmdb_id = $2',
      [userId, tmdbId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Movie already in favorites' });
    }

    // Limit to 12 favorites
    const count = await pool.query(
      'SELECT COUNT(*) FROM user_favorite_movies WHERE user_id = $1',
      [userId]
    );

    if (parseInt(count.rows[0].count) >= 12) {
      return res.status(400).json({ error: 'Maximum 12 favorite movies allowed' });
    }

    await pool.query(
      'INSERT INTO user_favorite_movies (user_id, tmdb_id, title, poster_path, release_date) VALUES ($1, $2, $3, $4, $5)',
      [userId, tmdbId, title, posterPath, releaseDate]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error adding favorite:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove favorite movie
router.delete('/favorite-movies/:movieId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const movieId = req.params.movieId;

    await pool.query(
      'DELETE FROM user_favorite_movies WHERE id = $1 AND user_id = $2',
      [movieId, userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error removing favorite:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add to watchlist
router.post('/watchlist', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { tmdbId, title, posterPath, releaseDate, overview } = req.body;

    // Check if already in watchlist
    const existing = await pool.query(
      'SELECT * FROM user_watchlist WHERE user_id = $1 AND tmdb_id = $2',
      [userId, tmdbId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Movie already in watchlist' });
    }

    await pool.query(
      'INSERT INTO user_watchlist (user_id, tmdb_id, title, poster_path, release_date, overview) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId, tmdbId, title, posterPath, releaseDate, overview]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error adding to watchlist:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark as watched
router.put('/watchlist/:movieId/watched', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const movieId = req.params.movieId;

    await pool.query(
      'UPDATE user_watchlist SET watched = NOT watched, watched_at = CASE WHEN watched = false THEN NOW() ELSE NULL END WHERE id = $1 AND user_id = $2',
      [movieId, userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating watch status:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove from watchlist
router.delete('/watchlist/:movieId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const movieId = req.params.movieId;

    await pool.query(
      'DELETE FROM user_watchlist WHERE id = $1 AND user_id = $2',
      [movieId, userId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error removing from watchlist:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user stats (for leaderboards, etc.)
router.get('/:userId/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const stats = await pool.query(
      `SELECT 
        u.id,
        u.username,
        COALESCE(SUM(cr.points), 0) as total_points,
        COUNT(DISTINCT cr.cycle_id) as cycles_participated,
        COUNT(DISTINCT CASE WHEN cr.rank = 1 THEN cr.cycle_id END) as cycles_won,
        COUNT(DISTINCT g.id) FILTER (WHERE g.is_correct = true) as perfect_guesses,
        COALESCE(AVG(cr.rank), 0) as average_rank
      FROM users u
      LEFT JOIN cycle_results cr ON u.id = cr.user_id
      LEFT JOIN guesses g ON u.id = g.user_id
      WHERE u.id = $1
      GROUP BY u.id, u.username`,
      [userId]
    );

    if (stats.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ stats: stats.rows[0] });
  } catch (err) {
    console.error('Error fetching user stats:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;