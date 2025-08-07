const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Register user
router.post('/register', async (req, res) => {
  const { username, email, password, displayName } = req.body;

  // Basic validation
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  if (username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters long' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  // Validate username format (alphanumeric, underscore, hyphen)
  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!usernameRegex.test(username)) {
    return res.status(400).json({ error: 'Username can only contain letters, numbers, underscores, and hyphens' });
  }

  try {
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR (email IS NOT NULL AND email = $2)',
      [username.toLowerCase(), email?.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, display_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, email, display_name, created_at`,
      [username.toLowerCase(), email?.toLowerCase() || null, passwordHash, displayName?.trim() || null]
    );

    const user = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Don't send password hash
    delete user.password_hash;

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login user - supports both username and email
router.post('/login', async (req, res) => {
  // DEBUG: Log what we're receiving
  console.log('🔍 Backend Login Debug - Full request body:', req.body);
  console.log('🔍 Backend Login Debug - Content-Type:', req.headers['content-type']);
  console.log('🔍 Backend Login Debug - Request keys:', Object.keys(req.body));
  
  const { username, password, rememberMe } = req.body; // Extract all parameters including rememberMe
  
  console.log('🔍 Backend Login Debug - Extracted values:', {
    username: username,
    usernameType: typeof username,
    usernameLength: username?.length,
    hasPassword: !!password,
    passwordType: typeof password,
    passwordLength: password?.length,
    rememberMe: rememberMe,
    rememberMeType: typeof rememberMe
  });

  if (!username || !password) {
    console.error('❌ Backend Login Debug - Missing required fields');
    return res.status(400).json({ error: 'Username/email and password are required' });
  }

  try {
    console.log('🚀 Backend Login Debug - Proceeding with database lookup for:', username);
    
    // Find user by username or email
    const result = await pool.query(
      'SELECT id, username, email, password_hash, display_name FROM users WHERE username = $1 OR email = $1',
      [username]
    );

    if (result.rows.length === 0) {
      console.log('❌ Backend Login Debug - User not found in database');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    console.log('✅ Backend Login Debug - User found:', user.username);

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      console.log('❌ Backend Login Debug - Invalid password for user:', user.username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('✅ Backend Login Debug - Password valid, creating token with rememberMe:', rememberMe);

    // Create JWT token with appropriate expiration based on rememberMe
    const tokenExpiration = rememberMe ? '30d' : '1d';
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: tokenExpiration }
    );

    // Don't send password hash
    delete user.password_hash;

    console.log('✅ Backend Login Debug - Login successful, sending response');

    res.json({
      message: 'Login successful',
      token,
      user,
      expiresIn: rememberMe ? '30 days' : '24 hours'
    });

  } catch (error) {
    console.error('❌ Backend Login Debug - Database/Server error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, display_name, bio, profile_picture, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Forgot password - Send reset email
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email address is required' });
  }

  try {
    // Find user by email
    const userResult = await pool.query(
      'SELECT id, username, email FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    // Always return success message for security (don't reveal if email exists)
    if (userResult.rows.length === 0) {
      return res.json({ 
        message: 'If an account with that email exists, we\'ve sent a password reset link.' 
      });
    }

    const user = userResult.rows[0];

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store reset token in database
    await pool.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [resetTokenHash, resetTokenExpires, user.id]
    );

    // In a real application, you would send an email here
    // For now, we'll just log the reset URL (for development)
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/reset-password/${resetToken}`;
    console.log(`Password reset URL for ${user.email}: ${resetUrl}`);

    // TODO: Send email with reset link
    // await sendPasswordResetEmail(user.email, resetUrl);

    res.json({ 
      message: 'If an account with that email exists, we\'ve sent a password reset link.',
      // In development, include the reset URL
      ...(process.env.NODE_ENV === 'development' && { resetUrl })
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset password with token
router.post('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  try {
    // Hash the provided token to match stored hash
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid reset token
    const userResult = await pool.query(
      'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > $2',
      [resetTokenHash, new Date()]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const user = userResult.rows[0];

    // Hash new password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Update password and clear reset token
    await pool.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [passwordHash, user.id]
    );

    res.json({ message: 'Password reset successfully' });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Change password (for logged in users)
router.post('/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }

  try {
    // Get user's current password hash
    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, req.user.id]
    );

    res.json({ message: 'Password changed successfully' });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
