const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db/db');
const { authenticateToken, requireClubMembership, requireDirectorRole, requireProducerRole } = require('../middleware/auth');

const router = express.Router();

// Configure multer for club picture uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/clubs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'club-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit for club pictures
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

// Generate unique invite code
const generateInviteCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Generate URL-friendly slug from club name
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')  // Remove special characters
    .replace(/\s+/g, '-')          // Replace spaces with hyphens
    .replace(/-+/g, '-')           // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, '')       // Remove leading/trailing hyphens
    .substring(0, 50);             // Limit length
};

// Ensure slug is unique by appending numbers if needed
const ensureUniqueSlug = async (baseSlug, clubId = null) => {
  let slug = baseSlug;
  let counter = 1;
  
  while (true) {
    const query = clubId 
      ? 'SELECT id FROM clubs WHERE url_slug = $1 AND id != $2'
      : 'SELECT id FROM clubs WHERE url_slug = $1';
    const params = clubId ? [slug, clubId] : [slug];
    
    const existing = await pool.query(query, params);
    
    if (existing.rows.length === 0) {
      return slug;
    }
    
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
};

// Get user's clubs
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.name, c.description, c.club_picture, c.is_public, c.max_members, c.created_at, c.url_slug,
              cm.role, cm.joined_at, cm.club_display_name,
              (SELECT COUNT(*) FROM club_members WHERE club_id = c.id AND is_active = true) as member_count,
              (SELECT COUNT(*) FROM cycles WHERE club_id = c.id) as total_cycles,
              (SELECT phase FROM cycles WHERE club_id = c.id ORDER BY started_at DESC LIMIT 1) as current_phase
       FROM clubs c
       JOIN club_members cm ON c.id = cm.club_id
       WHERE cm.user_id = $1 AND cm.is_active = true
       ORDER BY cm.joined_at DESC`,
      [req.user.id]
    );

    res.json({ clubs: result.rows });

  } catch (error) {
    console.error('Get user clubs error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get public clubs
router.get('/public', authenticateToken, async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let query = `
      SELECT c.id, c.name, c.description, c.club_picture, c.max_members, c.created_at, c.url_slug, c.invite_code,
             (SELECT COUNT(*) FROM club_members WHERE club_id = c.id AND is_active = true) as member_count,
             (SELECT COUNT(*) FROM cycles WHERE club_id = c.id) as total_cycles,
             CASE WHEN cm.user_id IS NOT NULL THEN true ELSE false END as is_member
      FROM clubs c
      LEFT JOIN club_members cm ON c.id = cm.club_id AND cm.user_id = $1 AND cm.is_active = true
      WHERE c.is_public = true
    `;

    const params = [req.user.id];

    if (search) {
      query += ` AND (c.name ILIKE $${params.length + 1} OR c.description ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY member_count DESC, c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) FROM clubs WHERE is_public = true';
    const countParams = [];

    if (search) {
      countQuery += ` AND (name ILIKE $1 OR description ILIKE $1)`;
      countParams.push(`%${search}%`);
    }

    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      clubs: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get public clubs error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get club by URL name/slug - MUST COME BEFORE /:id route
router.get('/by-name/:clubname', authenticateToken, async (req, res) => {
  const { clubname } = req.params;

  try {
    // First, find the club by its URL slug
    const clubResult = await pool.query(
      'SELECT id FROM clubs WHERE url_slug = $1',
      [clubname]
    );

    if (clubResult.rows.length === 0) {
      return res.status(404).json({ error: 'Club not found' });
    }

    const clubId = clubResult.rows[0].id;

    // Check if user is a member
    const membershipResult = await pool.query(
      'SELECT role, club_display_name FROM club_members WHERE club_id = $1 AND user_id = $2 AND is_active = true',
      [clubId, req.user.id]
    );

    if (membershipResult.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this club' });
    }

    // Get full club details
    const result = await pool.query(
      `SELECT c.id, c.name, c.description, c.club_picture, c.is_public, c.max_members, 
              c.created_at, c.invite_code, c.url_slug,
              CASE WHEN c.password_hash IS NOT NULL THEN true ELSE false END as has_password,
              (SELECT COUNT(*) FROM club_members WHERE club_id = c.id AND is_active = true) as member_count,
              (SELECT COUNT(*) FROM cycles WHERE club_id = c.id) as total_cycles,
              u.username as creator_username, u.display_name as creator_display_name
       FROM clubs c
       JOIN users u ON c.creator_id = u.id
       WHERE c.id = $1`,
      [clubId]
    );

    const club = result.rows[0];
    club.user_role = membershipResult.rows[0].role;
    club.user_club_display_name = membershipResult.rows[0].club_display_name;

    // Get current cycle info
    const cycleResult = await pool.query(
      `SELECT id, theme_text, phase, cycle_number, season_year, started_at
       FROM cycles 
       WHERE club_id = $1 AND phase != 'idle'
       ORDER BY started_at DESC 
       LIMIT 1`,
      [clubId]
    );

    if (cycleResult.rows.length > 0) {
      club.current_cycle = cycleResult.rows[0];
    }

    res.json({ club });

  } catch (error) {
    console.error('Get club by name error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get club statistics - NEW ROUTE
router.get('/:id/stats', authenticateToken, requireClubMembership, async (req, res) => {
  const { id } = req.params;
  const { season } = req.query;
  const currentYear = new Date().getFullYear();
  const targetSeason = season ? parseInt(season) : currentYear;

  try {
    // Get season statistics for all users in the club
    const seasonStatsResult = await pool.query(
      `SELECT uss.*, 
              u.username, u.display_name, u.profile_picture,
              cm.club_display_name
       FROM user_season_stats uss
       JOIN users u ON uss.user_id = u.id
       LEFT JOIN club_members cm ON cm.user_id = u.id AND cm.club_id = uss.club_id AND cm.is_active = true
       WHERE uss.club_id = $1 AND uss.season_year = $2
       ORDER BY uss.total_points DESC, uss.average_points DESC`,
      [id, targetSeason]
    );

    // Get overall club statistics
    const overallStatsResult = await pool.query(
      `SELECT 
         (SELECT COUNT(*) FROM cycles WHERE club_id = $1 AND phase = 'idle') as total_cycles,
         (SELECT COUNT(*) FROM nominations n JOIN cycles c ON n.cycle_id = c.id WHERE c.club_id = $1) as total_movies,
         (SELECT COUNT(DISTINCT user_id) FROM club_members WHERE club_id = $1 AND is_active = true) as active_members,
         (SELECT COUNT(*) FROM themes WHERE club_id = $1 AND is_used = false) as available_themes`,
      [id]
    );

    // Get recent cycle winners
    const recentWinnersResult = await pool.query(
      `SELECT c.id, c.cycle_number, c.theme_text, c.completed_at,
              u.username as winner_username, u.display_name as winner_display_name,
              cm.club_display_name as winner_club_display_name,
              n.title as winning_movie_title, n.poster_path as winning_movie_poster
       FROM cycles c
       LEFT JOIN users u ON c.winner_user_id = u.id
       LEFT JOIN club_members cm ON cm.user_id = u.id AND cm.club_id = c.club_id AND cm.is_active = true
       LEFT JOIN nominations n ON c.winner_movie_id = n.id
       WHERE c.club_id = $1 AND c.phase = 'idle'
       ORDER BY c.completed_at DESC
       LIMIT 5`,
      [id]
    );

    res.json({
      seasonStats: seasonStatsResult.rows,
      overallStats: overallStatsResult.rows[0],
      recentWinners: recentWinnersResult.rows,
      currentSeason: targetSeason
    });

  } catch (error) {
    console.error('Get club stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user's club display name - NEW ROUTE
router.put('/:clubId/my-display-name', authenticateToken, requireClubMembership, async (req, res) => {
  const { clubId } = req.params;
  const { displayName } = req.body;

  try {
    // Validate display name
    if (displayName && displayName.length > 100) {
      return res.status(400).json({ error: 'Display name must be 100 characters or less' });
    }

    // Update the club display name for this user in this club
    const result = await pool.query(
      'UPDATE club_members SET club_display_name = $1 WHERE club_id = $2 AND user_id = $3 AND is_active = true RETURNING *',
      [displayName?.trim() || null, clubId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Club membership not found' });
    }

    res.json({
      message: 'Club display name updated successfully',
      club_display_name: result.rows[0].club_display_name
    });

  } catch (error) {
    console.error('Update club display name error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new club
router.post('/', authenticateToken, upload.single('clubPicture'), async (req, res) => {
  const { name, description, isPublic, password, maxMembers } = req.body;

  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'Club name is required' });
  }

  if (name.length > 100) {
    return res.status(400).json({ error: 'Club name must be 100 characters or less' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Generate unique invite code
    let inviteCode;
    let codeExists = true;
    
    while (codeExists) {
      inviteCode = generateInviteCode();
      const codeCheck = await client.query('SELECT id FROM clubs WHERE invite_code = $1', [inviteCode]);
      codeExists = codeCheck.rows.length > 0;
    }

    // Generate URL slug
    const baseSlug = generateSlug(name.trim());
    const urlSlug = await ensureUniqueSlug(baseSlug);

    // Hash password if provided
    let passwordHash = null;
    if (password && password.trim().length > 0) {
      passwordHash = await bcrypt.hash(password.trim(), 12);
    }

    // Handle club picture
    let clubPicture = null;
    if (req.file) {
      clubPicture = `/uploads/clubs/${req.file.filename}`;
    }

    // Create club
    const clubResult = await client.query(
      `INSERT INTO clubs (name, description, creator_id, invite_code, is_public, password_hash, club_picture, max_members, url_slug)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, description, invite_code, is_public, club_picture, max_members, created_at, url_slug`,
      [
        name.trim(),
        description?.trim() || null,
        req.user.id,
        inviteCode,
        isPublic === 'true' || isPublic === true,
        passwordHash,
        clubPicture,
        parseInt(maxMembers) || 50,
        urlSlug
      ]
    );

    const club = clubResult.rows[0];

    // Add creator as producer
    await client.query(
      'INSERT INTO club_members (user_id, club_id, role, club_display_name) VALUES ($1, $2, $3, $4)',
      [req.user.id, club.id, 'producer', null] // null means use default display name
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Club created successfully',
      club: {
        ...club,
        role: 'producer',
        member_count: 1
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create club error:', error);

    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// Join club by invite code
router.post('/join', authenticateToken, async (req, res) => {
  const { inviteCode, password } = req.body;

  if (!inviteCode || inviteCode.trim().length === 0) {
    return res.status(400).json({ error: 'Invite code is required' });
  }

  try {
    // Find club by invite code
    const clubResult = await pool.query(
      'SELECT id, name, password_hash, max_members, url_slug FROM clubs WHERE invite_code = $1',
      [inviteCode.trim().toUpperCase()]
    );

    if (clubResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid invite code' });
    }

    const club = clubResult.rows[0];

    // Check password if club is password protected
    if (club.password_hash) {
      if (!password) {
        return res.status(401).json({ error: 'Password required for this club' });
      }

      const validPassword = await bcrypt.compare(password, club.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Incorrect password' });
      }
    }

    // Check if user is already a member
    const membershipResult = await pool.query(
      'SELECT id, is_active FROM club_members WHERE user_id = $1 AND club_id = $2',
      [req.user.id, club.id]
    );

    if (membershipResult.rows.length > 0) {
      if (membershipResult.rows[0].is_active) {
        return res.status(409).json({ error: 'You are already a member of this club' });
      } else {
        // Reactivate membership
        await pool.query(
          'UPDATE club_members SET is_active = true, joined_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND club_id = $2',
          [req.user.id, club.id]
        );

        return res.json({ 
          message: 'Successfully rejoined the club',
          club: { url_slug: club.url_slug }
        });
      }
    }

    // Check member limit
    const memberCountResult = await pool.query(
      'SELECT COUNT(*) FROM club_members WHERE club_id = $1 AND is_active = true',
      [club.id]
    );

    const currentMemberCount = parseInt(memberCountResult.rows[0].count);
    if (currentMemberCount >= club.max_members) {
      return res.status(403).json({ error: 'Club is at maximum capacity' });
    }

    // Add user as member
    await pool.query(
      'INSERT INTO club_members (user_id, club_id, role, club_display_name) VALUES ($1, $2, $3, $4)',
      [req.user.id, club.id, 'critic', null] // null means use default display name
    );

    res.json({ 
      message: `Successfully joined ${club.name}`,
      club: { url_slug: club.url_slug }
    });

  } catch (error) {
    console.error('Join club error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get club details
router.get('/:id', authenticateToken, requireClubMembership, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT c.id, c.name, c.description, c.club_picture, c.is_public, c.max_members, c.created_at, c.invite_code, c.url_slug,
              CASE WHEN c.password_hash IS NOT NULL THEN true ELSE false END as has_password,
              (SELECT COUNT(*) FROM club_members WHERE club_id = c.id AND is_active = true) as member_count,
              (SELECT COUNT(*) FROM cycles WHERE club_id = c.id) as total_cycles,
              u.username as creator_username, u.display_name as creator_display_name
       FROM clubs c
       JOIN users u ON c.creator_id = u.id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Club not found' });
    }

    const club = result.rows[0];
    club.user_role = req.userRole;

    // Get current cycle info
    const cycleResult = await pool.query(
      `SELECT id, theme_text, phase, cycle_number, season_year, started_at
       FROM cycles 
       WHERE club_id = $1 AND phase != 'idle'
       ORDER BY started_at DESC 
       LIMIT 1`,
      [id]
    );

    if (cycleResult.rows.length > 0) {
      club.current_cycle = cycleResult.rows[0];
    }

    res.json({ club });

  } catch (error) {
    console.error('Get club details error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get club members - ENHANCED with club display names
router.get('/:id/members', authenticateToken, requireClubMembership, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT cm.role, cm.joined_at, cm.is_active, cm.club_display_name,
              u.id, u.username, u.display_name, u.profile_picture,
              (SELECT COUNT(*) FROM cycle_results cr JOIN cycles cy ON cr.cycle_id = cy.id 
               WHERE cy.club_id = $1 AND cr.user_id = u.id AND cr.final_rank = 1) as cycles_won,
              (SELECT COALESCE(AVG(cr.points_earned), 0) FROM cycle_results cr JOIN cycles cy ON cr.cycle_id = cy.id 
               WHERE cy.club_id = $1 AND cr.user_id = u.id) as average_points
       FROM club_members cm
       JOIN users u ON cm.user_id = u.id
       WHERE cm.club_id = $1 AND cm.is_active = true
       ORDER BY 
         CASE cm.role 
           WHEN 'producer' THEN 1 
           WHEN 'director' THEN 2 
           WHEN 'critic' THEN 3 
         END,
         cm.joined_at ASC`,
      [id]
    );

    res.json({ members: result.rows });

  } catch (error) {
    console.error('Get club members error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update club details
router.put('/:id', authenticateToken, requireDirectorRole, upload.single('clubPicture'), async (req, res) => {
  const { id } = req.params;
  const { name, description, isPublic, password, maxMembers } = req.body;

  if (name && name.length > 100) {
    return res.status(400).json({ error: 'Club name must be 100 characters or less' });
  }

  try {
    let updateFields = [];
    let params = [];
    let paramCount = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${paramCount++}`);
      params.push(name.trim());
      
      // Also update slug if name changes
      const baseSlug = generateSlug(name.trim());
      const urlSlug = await ensureUniqueSlug(baseSlug, id);
      updateFields.push(`url_slug = $${paramCount++}`);
      params.push(urlSlug);
    }

    if (description !== undefined) {
      updateFields.push(`description = $${paramCount++}`);
      params.push(description?.trim() || null);
    }

    if (isPublic !== undefined) {
      updateFields.push(`is_public = $${paramCount++}`);
      params.push(isPublic === 'true' || isPublic === true);
    }

    if (maxMembers !== undefined) {
      updateFields.push(`max_members = $${paramCount++}`);
      params.push(parseInt(maxMembers) || 50);
    }

    // Handle password update
    if (password !== undefined) {
      if (password.trim().length === 0) {
        updateFields.push(`password_hash = NULL`);
      } else {
        const passwordHash = await bcrypt.hash(password.trim(), 12);
        updateFields.push(`password_hash = $${paramCount++}`);
        params.push(passwordHash);
      }
    }

    // Handle club picture
    if (req.file) {
      // Get old picture to delete it
      const oldPictureResult = await pool.query('SELECT club_picture FROM clubs WHERE id = $1', [id]);
      
      updateFields.push(`club_picture = $${paramCount++}`);
      params.push(`/uploads/clubs/${req.file.filename}`);

      // Delete old picture file
      if (oldPictureResult.rows[0]?.club_picture) {
        const oldFilePath = path.join(__dirname, '..', oldPictureResult.rows[0].club_picture);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const query = `UPDATE clubs SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Club not found' });
    }

    res.json({
      message: 'Club updated successfully',
      club: result.rows[0]
    });

  } catch (error) {
    console.error('Update club error:', error);

    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ error: 'Server error' });
  }
});

// Get club themes
router.get('/:id/themes', authenticateToken, requireClubMembership, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT t.id, t.theme_text, t.is_used, t.created_at,
              u.username as submitted_by_username, u.display_name as submitted_by_display_name,
              cm.club_display_name as submitted_by_club_display_name
       FROM themes t
       LEFT JOIN users u ON t.submitted_by = u.id
       LEFT JOIN club_members cm ON cm.user_id = u.id AND cm.club_id = t.club_id AND cm.is_active = true
       WHERE t.club_id = $1
       ORDER BY t.is_used ASC, t.created_at DESC`,
      [id]
    );

    res.json({ themes: result.rows });

  } catch (error) {
    console.error('Get club themes error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Submit theme to club pool
router.post('/:id/themes', authenticateToken, requireClubMembership, async (req, res) => {
  const { id } = req.params;
  const { themeText } = req.body;

  if (!themeText || themeText.trim().length === 0) {
    return res.status(400).json({ error: 'Theme text is required' });
  }

  if (themeText.length > 200) {
    return res.status(400).json({ error: 'Theme must be 200 characters or less' });
  }

  try {
    // Check if theme already exists in club
    const existingTheme = await pool.query(
      'SELECT id FROM themes WHERE club_id = $1 AND LOWER(theme_text) = LOWER($2)',
      [id, themeText.trim()]
    );

    if (existingTheme.rows.length > 0) {
      return res.status(409).json({ error: 'This theme already exists in the club' });
    }

    const result = await pool.query(
      'INSERT INTO themes (club_id, submitted_by, theme_text) VALUES ($1, $2, $3) RETURNING *',
      [id, req.user.id, themeText.trim()]
    );

    res.status(201).json({
      message: 'Theme submitted successfully',
      theme: result.rows[0]
    });

  } catch (error) {
    console.error('Submit theme error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update member role (Producer only)
router.put('/:clubId/members/:userId/role', authenticateToken, requireProducerRole, async (req, res) => {
  const { clubId, userId } = req.params;
  const { role } = req.body;

  if (!['critic', 'director', 'producer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  if (parseInt(userId) === req.user.id) {
    return res.status(400).json({ error: 'Cannot change your own role' });
  }

  try {
    const result = await pool.query(
      'UPDATE club_members SET role = $1 WHERE club_id = $2 AND user_id = $3 AND is_active = true RETURNING *',
      [role, clubId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    res.json({ message: 'Member role updated successfully' });

  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove member from club (Director/Producer only)
router.delete('/:clubId/members/:userId', authenticateToken, requireDirectorRole, async (req, res) => {
  const { clubId, userId } = req.params;

  if (parseInt(userId) === req.user.id) {
    return res.status(400).json({ error: 'Cannot remove yourself from the club' });
  }

  try {
    // Check if user trying to remove someone with same or higher role
    const memberRoles = await pool.query(
      `SELECT user_id, role FROM club_members 
       WHERE club_id = $1 AND user_id IN ($2, $3) AND is_active = true`,
      [clubId, req.user.id, userId]
    );

    const currentUserRole = memberRoles.rows.find(m => m.user_id === req.user.id)?.role;
    const targetUserRole = memberRoles.rows.find(m => m.user_id == userId)?.role;

    if (!targetUserRole) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const roleHierarchy = { critic: 1, director: 2, producer: 3 };
    
    if (roleHierarchy[targetUserRole] >= roleHierarchy[currentUserRole]) {
      return res.status(403).json({ error: 'Cannot remove member with same or higher role' });
    }

    await pool.query(
      'UPDATE club_members SET is_active = false WHERE club_id = $1 AND user_id = $2',
      [clubId, userId]
    );

    res.json({ message: 'Member removed successfully' });

  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Leave club
router.post('/:id/leave', authenticateToken, requireClubMembership, async (req, res) => {
  const { id } = req.params;

  try {
    // Check if user is the only producer
    if (req.userRole === 'producer') {
      const producerCount = await pool.query(
        'SELECT COUNT(*) FROM club_members WHERE club_id = $1 AND role = $2 AND is_active = true',
        [id, 'producer']
      );

      if (parseInt(producerCount.rows[0].count) === 1) {
        return res.status(400).json({ 
          error: 'Cannot leave club as the only producer. Transfer ownership first.' 
        });
      }
    }

    await pool.query(
      'UPDATE club_members SET is_active = false WHERE user_id = $1 AND club_id = $2',
      [req.user.id, id]
    );

    res.json({ message: 'Successfully left the club' });

  } catch (error) {
    console.error('Leave club error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;