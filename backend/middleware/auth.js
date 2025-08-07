const jwt = require('jsonwebtoken');
const pool = require('../db/db');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify user still exists and get fresh user data
    const userResult = await pool.query(
      'SELECT id, username, email, display_name FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = userResult.rows[0];
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Middleware to check if user is a member of a specific club
const requireClubMembership = async (req, res, next) => {
  try {
    // FIXED: Check ALL possible sources for club ID
    const clubId = req.params.id || req.params.clubId || req.body.clubId || req.params.clubname;
    
    let actualClubId = clubId;
    
    // If clubname (URL slug) provided, convert to club ID
    if (req.params.clubname) {
      const clubResult = await pool.query('SELECT id FROM clubs WHERE url_slug = $1', [req.params.clubname]);
      if (clubResult.rows.length === 0) {
        return res.status(404).json({ error: 'Club not found' });
      }
      actualClubId = clubResult.rows[0].id;
    }
    
    if (!actualClubId) {
      return res.status(400).json({ error: 'Club ID required' });
    }

    const membershipResult = await pool.query(
      'SELECT role FROM club_members WHERE user_id = $1 AND club_id = $2 AND is_active = true',
      [req.user.id, actualClubId]
    );

    if (membershipResult.rows.length === 0) {
      return res.status(403).json({ error: 'Club membership required' });
    }

    req.userRole = membershipResult.rows[0].role;
    req.clubId = actualClubId; // Store actual club ID for easy access
    next();
  } catch (error) {
    console.error('Club membership check error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Middleware to check if user has director or producer role in club
const requireDirectorRole = async (req, res, next) => {
  try {
    // FIXED: Check ALL possible sources for club ID
    const clubId = req.params.id || req.params.clubId || req.body.clubId || req.params.clubname;
    
    let actualClubId = clubId;
    
    // If clubname (URL slug) provided, convert to club ID
    if (req.params.clubname) {
      const clubResult = await pool.query('SELECT id FROM clubs WHERE url_slug = $1', [req.params.clubname]);
      if (clubResult.rows.length === 0) {
        return res.status(404).json({ error: 'Club not found' });
      }
      actualClubId = clubResult.rows[0].id;
    }
    
    if (!actualClubId) {
      return res.status(400).json({ error: 'Club ID required' });
    }

    const membershipResult = await pool.query(
      'SELECT role FROM club_members WHERE user_id = $1 AND club_id = $2 AND is_active = true',
      [req.user.id, actualClubId]
    );

    if (membershipResult.rows.length === 0) {
      return res.status(403).json({ error: 'Club membership required' });
    }

    const role = membershipResult.rows[0].role;
    if (role !== 'director' && role !== 'producer') {
      return res.status(403).json({ error: 'Director or Producer role required' });
    }

    req.userRole = role;
    req.clubId = actualClubId; // Store actual club ID for easy access
    next();
  } catch (error) {
    console.error('Director role check error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Middleware to check if user has producer role in club
const requireProducerRole = async (req, res, next) => {
  try {
    // FIXED: Check ALL possible sources for club ID
    const clubId = req.params.id || req.params.clubId || req.body.clubId || req.params.clubname;
    
    let actualClubId = clubId;
    
    // If clubname (URL slug) provided, convert to club ID
    if (req.params.clubname) {
      const clubResult = await pool.query('SELECT id FROM clubs WHERE url_slug = $1', [req.params.clubname]);
      if (clubResult.rows.length === 0) {
        return res.status(404).json({ error: 'Club not found' });
      }
      actualClubId = clubResult.rows[0].id;
    }
    
    if (!actualClubId) {
      return res.status(400).json({ error: 'Club ID required' });
    }

    const membershipResult = await pool.query(
      'SELECT role FROM club_members WHERE user_id = $1 AND club_id = $2 AND is_active = true',
      [req.user.id, actualClubId]
    );

    if (membershipResult.rows.length === 0) {
      return res.status(403).json({ error: 'Club membership required' });
    }

    const role = membershipResult.rows[0].role;
    if (role !== 'producer') {
      return res.status(403).json({ error: 'Producer role required' });
    }

    req.userRole = role;
    req.clubId = actualClubId; // Store actual club ID for easy access
    next();
  } catch (error) {
    console.error('Producer role check error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  authenticateToken,
  requireClubMembership,
  requireDirectorRole,
  requireProducerRole
};