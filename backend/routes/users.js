const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/profiles');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for profile pictures
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

// Get user by username
router.get('/by-username/:username', authenticateToken, async (req, res) => {
  const { username } = req.params;

  try {
    const result = await pool.query(
      'SELECT id, username, display_name, profile_picture FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });

  } catch (error) {
    console.error('Get user by username error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user profile
router.get('/profile/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Get user info
    const userResult = await pool.query(
      `SELECT id, username, display_name, bio, profile_picture, created_at
       FROM users
       WHERE id = $1`,
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    user.is_own_profile = user.id === req.user.id;

    // Get user stats
    const statsResult = await pool.query(
      `SELECT 
        (SELECT COUNT(*) FROM club_members WHERE user_id = $1 AND is_active = true) as clubs_joined,
        (SELECT COUNT(*) FROM cycle_results WHERE user_id = $1) as cycles_completed,
        (SELECT COUNT(*) FROM cycle_results WHERE user_id = $1 AND final_rank = 1) as cycles_won,
        (SELECT COALESCE(AVG(points_earned), 0) FROM cycle_results WHERE user_id = $1) as average_points`,
      [id]
    );

    user.stats = statsResult.rows[0];

    // Get favorite movies
    const favoritesResult = await pool.query(
      `SELECT tmdb_id, title, poster_path, release_year
       FROM favorite_movies
       WHERE user_id = $1
       ORDER BY added_at DESC
       LIMIT 5`,
      [id]
    );

    user.favorite_movies = favoritesResult.rows;

    // Get watchlist
    const watchlistResult = await pool.query(
      `SELECT tmdb_id, title, poster_path, release_year
       FROM watchlist
       WHERE user_id = $1
       ORDER BY added_at DESC
       LIMIT 5`,
      [id]
    );

    user.watchlist = watchlistResult.rows;

    // Get recent clubs (only if viewing own profile or public clubs)
    if (user.is_own_profile) {
      const clubsResult = await pool.query(
        `SELECT c.id, c.name, c.club_picture, cm.role
         FROM clubs c
         JOIN club_members cm ON c.id = cm.club_id
         WHERE cm.user_id = $1 AND cm.is_active = true
         ORDER BY cm.joined_at DESC
         LIMIT 5`,
        [id]
      );
      user.recent_clubs = clubsResult.rows;
    }

    res.json({ user });

  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, upload.single('profilePicture'), async (req, res) => {
  const { displayName, bio } = req.body;

  try {
    let updateFields = [];
    let params = [];
    let paramCount = 1;

    if (displayName !== undefined) {
      updateFields.push(`display_name = $${paramCount++}`);
      params.push(displayName.trim() || null);
    }

    if (bio !== undefined) {
      updateFields.push(`bio = $${paramCount++}`);
      params.push(bio.trim() || null);
    }

    // Handle profile picture
    if (req.file) {
      // Get old picture to delete it
      const oldPictureResult = await pool.query('SELECT profile_picture FROM users WHERE id = $1', [req.user.id]);
      
      updateFields.push(`profile_picture = $${paramCount++}`);
      params.push(`/uploads/profiles/${req.file.filename}`);

      // Delete old picture file
      if (oldPictureResult.rows[0]?.profile_picture) {
        const oldFilePath = path.join(__dirname, '..', oldPictureResult.rows[0].profile_picture);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(req.user.id);

    const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING id, username, display_name, bio, profile_picture`;

    const result = await pool.query(query, params);

    res.json({
      message: 'Profile updated successfully',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Update profile error:', error);

    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ error: 'Server error' });
  }
});

// Add movie to favorites
router.post('/favorites', authenticateToken, async (req, res) => {
  const { tmdbId, title, posterPath, releaseYear } = req.body;

  if (!tmdbId || !title) {
    return res.status(400).json({ error: 'Movie ID and title are required' });
  }

  try {
    // Check if already in favorites
    const existingResult = await pool.query(
      'SELECT id FROM favorite_movies WHERE user_id = $1 AND tmdb_id = $2',
      [req.user.id, tmdbId]
    );

    if (existingResult.rows.length > 0) {
      return res.status(409).json({ error: 'Movie already in favorites' });
    }

    // Check limit (12 favorites max)
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM favorite_movies WHERE user_id = $1',
      [req.user.id]
    );

    if (parseInt(countResult.rows[0].count) >= 12) {
      return res.status(400).json({ error: 'Maximum 12 favorite movies allowed' });
    }

    // Add to favorites
    await pool.query(
      'INSERT INTO favorite_movies (user_id, tmdb_id, title, poster_path, release_year) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, tmdbId, title, posterPath, releaseYear]
    );

    res.status(201).json({ message: 'Added to favorites' });

  } catch (error) {
    console.error('Add to favorites error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove movie from favorites
router.delete('/favorites/:tmdbId', authenticateToken, async (req, res) => {
  const { tmdbId } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM favorite_movies WHERE user_id = $1 AND tmdb_id = $2 RETURNING id',
      [req.user.id, tmdbId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Movie not found in favorites' });
    }

    res.json({ message: 'Removed from favorites' });

  } catch (error) {
    console.error('Remove from favorites error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's favorite movies
router.get('/favorites', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT tmdb_id, title, poster_path, release_year, added_at
       FROM favorite_movies
       WHERE user_id = $1
       ORDER BY added_at DESC`,
      [req.user.id]
    );

    res.json({ favorites: result.rows });

  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add movie to watchlist
router.post('/watchlist', authenticateToken, async (req, res) => {
  const { tmdbId, title, posterPath, releaseYear } = req.body;

  if (!tmdbId || !title) {
    return res.status(400).json({ error: 'Movie ID and title are required' });
  }

  try {
    // Check if already in watchlist
    const existingResult = await pool.query(
      'SELECT id FROM watchlist WHERE user_id = $1 AND tmdb_id = $2',
      [req.user.id, tmdbId]
    );

    if (existingResult.rows.length > 0) {
      return res.status(409).json({ error: 'Movie already in watchlist' });
    }

    // Add to watchlist
    await pool.query(
      'INSERT INTO watchlist (user_id, tmdb_id, title, poster_path, release_year) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, tmdbId, title, posterPath, releaseYear]
    );

    res.status(201).json({ message: 'Added to watchlist' });

  } catch (error) {
    console.error('Add to watchlist error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove movie from watchlist
router.delete('/watchlist/:tmdbId', authenticateToken, async (req, res) => {
  const { tmdbId } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM watchlist WHERE user_id = $1 AND tmdb_id = $2 RETURNING id',
      [req.user.id, tmdbId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Movie not found in watchlist' });
    }

    res.json({ message: 'Removed from watchlist' });

  } catch (error) {
    console.error('Remove from watchlist error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's watchlist
router.get('/watchlist', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT tmdb_id, title, poster_path, release_year, added_at, is_watched
       FROM watchlist
       WHERE user_id = $1
       ORDER BY added_at DESC`,
      [req.user.id]
    );

    res.json({ watchlist: result.rows });

  } catch (error) {
    console.error('Get watchlist error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark watchlist item as watched
router.put('/watchlist/:tmdbId/watched', authenticateToken, async (req, res) => {
  const { tmdbId } = req.params;

  try {
    const result = await pool.query(
      'UPDATE watchlist SET is_watched = NOT is_watched WHERE user_id = $1 AND tmdb_id = $2 RETURNING *',
      [req.user.id, tmdbId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Movie not found in watchlist' });
    }

    res.json({ message: 'Watch status updated' });

  } catch (error) {
    console.error('Mark as watched error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's cycle history
router.get('/history/:userId', authenticateToken, async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const result = await pool.query(
      `SELECT 
        cy.id as cycle_id,
        cy.theme_text,
        cy.cycle_number,
        cy.started_at,
        cy.completed_at,
        c.id as club_id,
        c.name as club_name,
        cr.final_rank,
        cr.points_earned,
        cr.nominated_movie_title,
        cr.nominated_movie_tmdb_id,
        cr.correct_guesses,
        cr.total_guesses
       FROM cycle_results cr
       JOIN cycles cy ON cr.cycle_id = cy.id
       JOIN clubs c ON cy.club_id = c.id
       WHERE cr.user_id = $1
       ORDER BY cy.completed_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit), offset]
    );

    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM cycle_results WHERE user_id = $1',
      [userId]
    );

    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      history: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get cycle history error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Legacy route compatibility - redirect old routes to new ones
router.get('/:userId/profile', authenticateToken, async (req, res) => {
  res.redirect(`/api/users/profile/${req.params.userId}`);
});

// Legacy favorite movies routes
router.post('/favorite-movies', authenticateToken, async (req, res) => {
  res.redirect(307, '/api/users/favorites');
});

router.delete('/favorite-movies/:movieId', authenticateToken, async (req, res) => {
  res.redirect(307, `/api/users/favorites/${req.params.movieId}`);
});

module.exports = router;