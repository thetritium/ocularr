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
    cb(null, 'profile-' + req.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
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

// Get user profile
router.get('/profile/:userId?', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;
    
    const result = await pool.query(
      `SELECT id, username, display_name, bio, profile_picture, favorite_genre, created_at,
       (SELECT COUNT(*) FROM club_members WHERE user_id = $1 AND is_active = true) as clubs_count
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    
    // Get user's recent activity if it's their own profile
    if (parseInt(userId) === req.user.id) {
      const activityResult = await pool.query(
        `SELECT 'cycle_win' as type, c.name as club_name, cr.points_earned, cr.calculated_at as date
         FROM cycle_results cr
         JOIN cycles cy ON cr.cycle_id = cy.id
         JOIN clubs c ON cy.club_id = c.id
         WHERE cr.user_id = $1 AND cr.final_rank = 1
         ORDER BY cr.calculated_at DESC
         LIMIT 10`,
        [userId]
      );
      
      user.recent_activity = activityResult.rows;
    }

    res.json({ user });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  const { displayName, bio, favoriteGenre } = req.body;

  try {
    const result = await pool.query(
      `UPDATE users 
       SET display_name = COALESCE($1, display_name),
           bio = COALESCE($2, bio),
           favorite_genre = COALESCE($3, favorite_genre),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, username, display_name, bio, favorite_genre, updated_at`,
      [displayName, bio, favoriteGenre, req.user.id]
    );

    res.json({
      message: 'Profile updated successfully',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Upload profile picture
router.post('/profile/picture', authenticateToken, upload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const picturePath = `/uploads/profiles/${req.file.filename}`;

    // Get old picture path to delete it
    const oldPictureResult = await pool.query(
      'SELECT profile_picture FROM users WHERE id = $1',
      [req.user.id]
    );

    // Update database with new picture path
    await pool.query(
      'UPDATE users SET profile_picture = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [picturePath, req.user.id]
    );

    // Delete old picture file if it exists
    if (oldPictureResult.rows[0]?.profile_picture) {
      const oldFilePath = path.join(__dirname, '..', oldPictureResult.rows[0].profile_picture);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    res.json({
      message: 'Profile picture updated successfully',
      profilePicture: picturePath
    });

  } catch (error) {
    console.error('Upload profile picture error:', error);
    
    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's watchlist
router.get('/watchlist', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, tmdb_movie_id, title, poster_path, added_at, watched, personal_rating, notes
       FROM user_watchlists 
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

// Add movie to watchlist
router.post('/watchlist', authenticateToken, async (req, res) => {
  const { tmdbMovieId, title, posterPath } = req.body;

  if (!tmdbMovieId || !title) {
    return res.status(400).json({ error: 'Movie ID and title are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO user_watchlists (user_id, tmdb_movie_id, title, poster_path)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, tmdb_movie_id) DO NOTHING
       RETURNING id`,
      [req.user.id, tmdbMovieId, title, posterPath]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'Movie already in watchlist' });
    }

    res.status(201).json({ message: 'Movie added to watchlist' });

  } catch (error) {
    console.error('Add to watchlist error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update watchlist item
router.put('/watchlist/:movieId', authenticateToken, async (req, res) => {
  const { movieId } = req.params;
  const { watched, personalRating, notes } = req.body;

  try {
    const result = await pool.query(
      `UPDATE user_watchlists 
       SET watched = COALESCE($1, watched),
           personal_rating = COALESCE($2, personal_rating),
           notes = COALESCE($3, notes)
       WHERE id = $4 AND user_id = $5
       RETURNING id`,
      [watched, personalRating, notes, movieId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Watchlist item not found' });
    }

    res.json({ message: 'Watchlist item updated' });

  } catch (error) {
    console.error('Update watchlist error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove movie from watchlist
router.delete('/watchlist/:movieId', authenticateToken, async (req, res) => {
  const { movieId } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM user_watchlists WHERE id = $1 AND user_id = $2 RETURNING id',
      [movieId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Watchlist item not found' });
    }

    res.json({ message: 'Movie removed from watchlist' });

  } catch (error) {
    console.error('Remove from watchlist error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new passwords are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }

  try {
    // Get current password hash
    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, req.user.id]
    );

    res.json({ message: 'Password changed successfully' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;