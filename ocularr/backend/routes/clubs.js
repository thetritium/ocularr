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

// Get user's clubs
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.name, c.description, c.club_picture, c.is_public, c.max_members, c.created_at,
              cm.role, cm.joined_at,
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
      SELECT c.id, c.name, c.description, c.club_picture, c.max_members, c.created_at,
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

    query += ` ORDER BY member_count DESC, c.created_at DESC LIMIT ${params.length + 1} OFFSET ${params.length + 2}`;
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
      `INSERT INTO clubs (name, description, creator_id, invite_code, is_public, password_hash, club_picture, max_members)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, description, invite_code, is_public, club_picture, max_members, created_at`,
      [
        name.trim(),
        description?.trim() || null,
        req.user.id,
        inviteCode,
        isPublic === 'true' || isPublic === true,
        passwordHash,
        clubPicture,
        parseInt(maxMembers) || 50
      ]
    );

    const club = clubResult.rows[0];

    // Add creator as producer
    await client.query(
      'INSERT INTO club_members (user_id, club_id, role) VALUES ($1, $2, $3)',
      [req.user.id, club.id, 'producer']
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
      'SELECT id, name, password_hash, max_members FROM clubs WHERE invite_code = $1',
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

        return res.json({ message: 'Successfully rejoined the club' });
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
      'INSERT INTO club_members (user_id, club_id, role) VALUES ($1, $2, $3)',
      [req.user.id, club.id, 'critic']
    );

    res.json({ message: `Successfully joined ${club.name}` });

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
      `SELECT c.id, c.name, c.description, c.club_picture, c.is_public, c.max_members, c.created_at, c.invite_code,
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

// Get club members
router.get('/:id/members', authenticateToken, requireClubMembership, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT cm.role, cm.joined_at, cm.is_active,
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
      updateFields.push(`name = ${paramCount++}`);
      params.push(name.trim());
    }

    if (description !== undefined) {
      updateFields.push(`description = ${paramCount++}`);
      params.push(description?.trim() || null);
    }

    if (isPublic !== undefined) {
      updateFields.push(`is_public = ${paramCount++}`);
      params.push(isPublic === 'true' || isPublic === true);
    }

    if (maxMembers !== undefined) {
      updateFields.push(`max_members = ${paramCount++}`);
      params.push(parseInt(maxMembers) || 50);
    }

    // Handle password update
    if (password !== undefined) {
      if (password.trim().length === 0) {
        updateFields.push(`password_hash = NULL`);
      } else {
        const passwordHash = await bcrypt.hash(password.trim(), 12);
        updateFields.push(`password_hash = ${paramCount++}`);
        params.push(passwordHash);
      }
    }

    // Handle club picture
    if (req.file) {
      // Get old picture to delete it
      const oldPictureResult = await pool.query('SELECT club_picture FROM clubs WHERE id = $1', [id]);
      
      updateFields.push(`club_picture = ${paramCount++}`);
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

    const query = `UPDATE clubs SET ${updateFields.join(', ')} WHERE id = ${paramCount} RETURNING *`;

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
              u.username as submitted_by_username, u.display_name as submitted_by_display_name
       FROM themes t
       LEFT JOIN users u ON t.submitted_by = u.id
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