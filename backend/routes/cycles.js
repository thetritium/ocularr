const express = require('express');
const pool = require('../db/db');
const { authenticateToken, requireClubMembership, requireDirectorRole } = require('../middleware/auth');

const router = express.Router();

// Start new cycle
router.post('/:clubId/start', authenticateToken, requireDirectorRole, async (req, res) => {
  const { clubId } = req.params;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if there's already an active cycle
    const activeCycleResult = await client.query(
      'SELECT id FROM cycles WHERE club_id = $1 AND phase != $2',
      [clubId, 'idle']
    );

    if (activeCycleResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'There is already an active cycle for this club' });
    }

    // Get unused themes
    const themesResult = await client.query(
      'SELECT id, theme_text FROM themes WHERE club_id = $1 AND is_used = false',
      [clubId]
    );

    if (themesResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No unused themes available. Please add more themes to the pool.' });
    }

    // Select random theme
    const randomTheme = themesResult.rows[Math.floor(Math.random() * themesResult.rows.length)];

    // Mark theme as used
    await client.query(
      'UPDATE themes SET is_used = true WHERE id = $1',
      [randomTheme.id]
    );

    // Get cycle number for this club
    const cycleCountResult = await client.query(
      'SELECT COUNT(*) as count FROM cycles WHERE club_id = $1',
      [clubId]
    );
    const cycleNumber = parseInt(cycleCountResult.rows[0].count) + 1;

    // Create new cycle
    const currentYear = new Date().getFullYear();
    const cycleResult = await client.query(
      `INSERT INTO cycles (club_id, theme_id, theme_text, phase, cycle_number, season_year, started_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, theme_text, phase, cycle_number, season_year, started_at`,
      [clubId, randomTheme.id, randomTheme.theme_text, 'nomination', cycleNumber, currentYear, req.user.id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'New cycle started successfully',
      cycle: cycleResult.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Start cycle error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// Get current cycle for club
router.get('/:clubId/current', authenticateToken, requireClubMembership, async (req, res) => {
  const { clubId } = req.params;

  try {
    const result = await pool.query(
      `SELECT c.id, c.theme_text, c.phase, c.cycle_number, c.season_year, c.started_at,
              c.nomination_deadline, c.watching_deadline, c.ranking_deadline,
              u.username as started_by_username, u.display_name as started_by_display_name
       FROM cycles c
       LEFT JOIN users u ON c.started_by = u.id
       WHERE c.club_id = $1 AND c.phase != 'idle'
       ORDER BY c.started_at DESC
       LIMIT 1`,
      [clubId]
    );

    if (result.rows.length === 0) {
      return res.json({ cycle: null });
    }

    const cycle = result.rows[0];

    // Get nominations for this cycle
    const nominationsResult = await pool.query(
      `SELECT n.id, n.tmdb_movie_id, n.title, n.year, n.poster_path, n.overview, 
              n.genre_ids, n.director, n.runtime, n.submitted_at,
              u.username, u.display_name, u.id as user_id
       FROM nominations n
       JOIN users u ON n.user_id = u.id
       WHERE n.cycle_id = $1
       ORDER BY n.submitted_at`,
      [cycle.id]
    );

    cycle.nominations = nominationsResult.rows;

    // Get user's progress for this cycle
    const progressResult = await pool.query(
      `SELECT nomination_id, watched, rating, personal_notes
       FROM watch_progress 
       WHERE user_id = $1 AND cycle_id = $2`,
      [req.user.id, cycle.id]
    );

    cycle.user_progress = progressResult.rows;

    // Get member count for context
    const memberCountResult = await pool.query(
      'SELECT COUNT(*) FROM club_members WHERE club_id = $1 AND is_active = true',
      [clubId]
    );

    cycle.total_members = parseInt(memberCountResult.rows[0].count);

    res.json({ cycle });

  } catch (error) {
    console.error('Get current cycle error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});
// Progress cycle to next phase
router.put('/:cycleId/phase', authenticateToken, requireDirectorRole, async (req, res) => {
  const { cycleId } = req.params;
  const { action } = req.body; // 'next' or 'previous'

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get current cycle
    const cycleResult = await client.query(
      'SELECT id, club_id, phase FROM cycles WHERE id = $1',
      [cycleId]
    );

    if (cycleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cycle not found' });
    }

    const cycle = cycleResult.rows[0];
    const phases = ['nomination', 'watching', 'ranking', 'results', 'idle'];
    const currentPhaseIndex = phases.indexOf(cycle.phase);

    let newPhaseIndex;
    if (action === 'next') {
      newPhaseIndex = Math.min(currentPhaseIndex + 1, phases.length - 1);
    } else if (action === 'previous') {
      newPhaseIndex = Math.max(currentPhaseIndex - 1, 0);
    } else {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid action. Use "next" or "previous"' });
    }

    const newPhase = phases[newPhaseIndex];

    // Validation checks before progressing
    if (action === 'next') {
      if (cycle.phase === 'nomination') {
        // Check if all members have nominated
        const memberCount = await client.query(
          'SELECT COUNT(*) FROM club_members WHERE club_id = $1 AND is_active = true',
          [cycle.club_id]
        );

        const nominationCount = await client.query(
          'SELECT COUNT(*) FROM nominations WHERE cycle_id = $1',
          [cycleId]
        );

        if (parseInt(nominationCount.rows[0].count) < parseInt(memberCount.rows[0].count)) {
          await client.query('ROLLBACK');
          return res.status(400).json({ 
            error: 'Cannot progress to watching phase. Not all members have nominated movies.' 
          });
        }
      } else if (cycle.phase === 'watching') {
        // Initialize watch progress for all members if not exists
        const members = await client.query(
          'SELECT user_id FROM club_members WHERE club_id = $1 AND is_active = true',
          [cycle.club_id]
        );

        const nominations = await client.query(
          'SELECT id, user_id FROM nominations WHERE cycle_id = $1',
          [cycleId]
        );

        for (const member of members.rows) {
          for (const nomination of nominations.rows) {
            // Auto-mark own nomination as watched
            const watched = nomination.user_id === member.user_id;

            await client.query(
              `INSERT INTO watch_progress (user_id, cycle_id, nomination_id, watched)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (user_id, cycle_id, nomination_id) DO NOTHING`,
              [member.user_id, cycleId, nomination.id, watched]
            );
          }
        }
      } else if (cycle.phase === 'ranking') {
        // Calculate results when moving to results phase
        await calculateCycleResults(client, cycleId);
      }
    }

    // Update cycle phase
    await client.query(
      'UPDATE cycles SET phase = $1 WHERE id = $2',
      [newPhase, cycleId]
    );

    // Mark cycle as completed if moving to idle
    if (newPhase === 'idle') {
      await client.query(
        'UPDATE cycles SET completed_at = CURRENT_TIMESTAMP WHERE id = $1',
        [cycleId]
      );
    }

    await client.query('COMMIT');

    res.json({
      message: `Cycle phase updated to ${newPhase}`,
      phase: newPhase
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update cycle phase error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// Replace your existing nominate route with this one:
router.post('/:cycleId/nominate', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cycleId = req.params.cycleId;
    const userId = req.user.id;
    const { tmdbId, title, releaseDate, posterPath, overview } = req.body;

    // Verify cycle exists and is in nomination phase
    const cycle = await client.query(
      'SELECT * FROM cycles WHERE id = $1 AND phase = $2',
      [cycleId, 'nomination']
    );

    if (cycle.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cycle not in nomination phase' });
    }

    // Check if user already nominated
    const existing = await client.query(
      'SELECT * FROM nominations WHERE cycle_id = $1 AND user_id = $2',
      [cycleId, userId]
    );

    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You have already nominated a movie' });
    }

    // NEW: Check if this movie (by TMDB ID) has already been nominated in this cycle
    const duplicateMovie = await client.query(
      'SELECT n.*, u.username FROM nominations n JOIN users u ON n.user_id = u.id WHERE n.cycle_id = $1 AND n.tmdb_id = $2',
      [cycleId, tmdbId]
    );

    if (duplicateMovie.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: `This movie has already been nominated by ${duplicateMovie.rows[0].username}` 
      });
    }

    // Insert nomination
    await client.query(
      `INSERT INTO nominations (cycle_id, user_id, tmdb_id, title, release_date, poster_path, overview)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [cycleId, userId, tmdbId, title, releaseDate, posterPath, overview]
    );

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Nomination error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});
// Update watch progress
router.put('/:cycleId/watch/:movieId', authenticateToken, requireClubMembership, async (req, res) => {
  const { cycleId, movieId } = req.params;
  const { watched, rating, personalNotes } = req.body;

  try {
    // Check if cycle is in watching phase
    const cycleResult = await pool.query(
      'SELECT phase FROM cycles WHERE id = $1',
      [cycleId]
    );

    if (cycleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cycle not found' });
    }

    if (cycleResult.rows[0].phase !== 'watching') {
      return res.status(400).json({ error: 'Cycle is not in watching phase' });
    }

    // Check if user nominated this movie (can't mark own nomination)
    const nominationCheck = await pool.query(
      'SELECT user_id FROM nominations WHERE id = $1 AND cycle_id = $2',
      [movieId, cycleId]
    );

    if (nominationCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Movie nomination not found' });
    }

    if (nominationCheck.rows[0].user_id === req.user.id) {
      return res.status(400).json({ error: 'Cannot update watch progress for your own nomination' });
    }

    // Update or insert watch progress
    const result = await pool.query(
      `INSERT INTO watch_progress (user_id, cycle_id, nomination_id, watched, rating, personal_notes, watched_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, cycle_id, nomination_id)
       DO UPDATE SET 
         watched = EXCLUDED.watched,
         rating = EXCLUDED.rating,
         personal_notes = EXCLUDED.personal_notes,
         watched_at = CASE WHEN EXCLUDED.watched = true AND watch_progress.watched = false 
                          THEN CURRENT_TIMESTAMP 
                          ELSE watch_progress.watched_at END
       RETURNING *`,
      [req.user.id, cycleId, movieId, watched, rating, personalNotes, watched ? new Date() : null]
    );

    res.json({
      message: 'Watch progress updated successfully',
      progress: result.rows[0]
    });

  } catch (error) {
    console.error('Update watch progress error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Submit guesses and rankings
router.post('/:cycleId/submit-rankings', authenticateToken, requireClubMembership, async (req, res) => {
  const { cycleId } = req.params;
  const { guesses, rankings } = req.body;

  if (!guesses || !rankings || !Array.isArray(guesses) || !Array.isArray(rankings)) {
    return res.status(400).json({ error: 'Guesses and rankings are required as arrays' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if cycle is in ranking phase
    const cycleResult = await client.query(
      'SELECT phase FROM cycles WHERE id = $1',
      [cycleId]
    );

    if (cycleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cycle not found' });
    }

    if (cycleResult.rows[0].phase !== 'ranking') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cycle is not in ranking phase' });
    }

    // Check if user already submitted rankings
    const existingRankings = await client.query(
      'SELECT id FROM rankings WHERE user_id = $1 AND cycle_id = $2',
      [req.user.id, cycleId]
    );

    if (existingRankings.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'You have already submitted rankings for this cycle' });
    }

    // Get all nominations for this cycle
    const nominations = await client.query(
      'SELECT id, user_id FROM nominations WHERE cycle_id = $1',
      [cycleId]
    );

    const nominationMap = new Map(nominations.rows.map(n => [n.id, n.user_id]));

    // Validate and insert guesses
    for (const guess of guesses) {
      const { nominationId, guessedNominatorId } = guess;

      if (!nominationMap.has(nominationId)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Invalid nomination ID: ${nominationId}` });
      }

      // Check if guessing for own nomination (not allowed)
      if (nominationMap.get(nominationId) === req.user.id) {
        continue; // Skip own nominations
      }

      const isCorrect = nominationMap.get(nominationId) === guessedNominatorId;

      await client.query(
        `INSERT INTO guesses (user_id, cycle_id, nomination_id, guessed_nominator_id, is_correct)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.id, cycleId, nominationId, guessedNominatorId, isCorrect]
      );
    }

    // Validate and insert rankings
    const rankPositions = new Set();
    for (const ranking of rankings) {
      const { nominationId, rankPosition } = ranking;

      if (!nominationMap.has(nominationId)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Invalid nomination ID: ${nominationId}` });
      }

      // Check if ranking own nomination (not allowed)
      if (nominationMap.get(nominationId) === req.user.id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Cannot rank your own nomination' });
      }

      if (rankPositions.has(rankPosition)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Duplicate rank position: ${rankPosition}` });
      }

      rankPositions.add(rankPosition);

      await client.query(
        `INSERT INTO rankings (user_id, cycle_id, nomination_id, rank_position)
         VALUES ($1, $2, $3, $4)`,
        [req.user.id, cycleId, nominationId, rankPosition]
      );
    }

    await client.query('COMMIT');

    res.json({ message: 'Rankings submitted successfully' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Submit rankings error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});
// Get cycle history for club
router.get('/:clubId/history', authenticateToken, requireClubMembership, async (req, res) => {
  const { clubId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const result = await pool.query(
      `SELECT c.id, c.theme_text, c.cycle_number, c.season_year, c.started_at, c.completed_at,
              c.winner_user_id, c.winner_movie_id, c.winner_points,
              u.username as winner_username, u.display_name as winner_display_name,
              n.title as winning_movie_title, n.poster_path as winning_movie_poster
       FROM cycles c
       LEFT JOIN users u ON c.winner_user_id = u.id
       LEFT JOIN nominations n ON c.winner_movie_id = n.id
       WHERE c.club_id = $1 AND c.phase = 'idle'
       ORDER BY c.completed_at DESC
       LIMIT $2 OFFSET $3`,
      [clubId, parseInt(limit), offset]
    );

    // Get total count for pagination
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM cycles WHERE club_id = $1 AND phase = $2',
      [clubId, 'idle']
    );

    const totalCount = parseInt(countResult.rows[0].count);

    res.json({
      cycles: result.rows,
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

// Get detailed cycle results
router.get('/:cycleId/results', authenticateToken, requireClubMembership, async (req, res) => {
  const { cycleId } = req.params;

  try {
    // Get cycle info
    const cycleResult = await pool.query(
      'SELECT id, theme_text, cycle_number, season_year, completed_at FROM cycles WHERE id = $1',
      [cycleId]
    );

    if (cycleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cycle not found' });
    }

    const cycle = cycleResult.rows[0];

    // Get results with nominations and user info
    const resultsQuery = await pool.query(
      `SELECT cr.final_rank, cr.average_rank, cr.points_earned, cr.guess_accuracy, cr.total_votes_received,
              u.id as user_id, u.username, u.display_name, u.profile_picture,
              n.id as nomination_id, n.tmdb_movie_id, n.title, n.year, n.poster_path, n.director, n.runtime
       FROM cycle_results cr
       JOIN users u ON cr.user_id = u.id
       JOIN nominations n ON cr.nomination_id = n.id
       WHERE cr.cycle_id = $1
       ORDER BY cr.final_rank ASC`,
      [cycleId]
    );

    cycle.results = resultsQuery.rows;

    // Get all guesses for this cycle (for transparency)
    const guessesQuery = await pool.query(
      `SELECT g.user_id, g.nomination_id, g.guessed_nominator_id, g.is_correct,
              u.username as guesser_username,
              n.title as movie_title,
              gn.username as guessed_username
       FROM guesses g
       JOIN users u ON g.user_id = u.id
       JOIN nominations n ON g.nomination_id = n.id
       JOIN users gn ON g.guessed_nominator_id = gn.id
       WHERE g.cycle_id = $1
       ORDER BY g.user_id, g.nomination_id`,
      [cycleId]
    );

    cycle.guesses = guessesQuery.rows;

    // Get all rankings for this cycle
    const rankingsQuery = await pool.query(
      `SELECT r.user_id, r.nomination_id, r.rank_position,
              u.username as ranker_username,
              n.title as movie_title
       FROM rankings r
       JOIN users u ON r.user_id = u.id
       JOIN nominations n ON r.nomination_id = n.id
       WHERE r.cycle_id = $1
       ORDER BY r.user_id, r.rank_position`,
      [cycleId]
    );

    cycle.rankings = rankingsQuery.rows;

    res.json({ cycle });

  } catch (error) {
    console.error('Get cycle results error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper function to calculate cycle results
async function calculateCycleResults(client, cycleId) {
  try {
    // Get all nominations for this cycle
    const nominations = await client.query(
      'SELECT id, user_id FROM nominations WHERE cycle_id = $1',
      [cycleId]
    );

    // Get all club members for this cycle
    const cycleInfo = await client.query(
      'SELECT club_id FROM cycles WHERE id = $1',
      [cycleId]
    );

    const members = await client.query(
      'SELECT user_id FROM club_members WHERE club_id = $1 AND is_active = true',
      [cycleInfo.rows[0].club_id]
    );

    const memberCount = members.rows.length;

    // Calculate results for each nomination
    for (const nomination of nominations.rows) {
      // Get all rankings for this nomination (excluding the nominator's own ranking)
      const rankings = await client.query(
        `SELECT rank_position FROM rankings 
         WHERE cycle_id = $1 AND nomination_id = $2 AND user_id != $3
         ORDER BY rank_position`,
        [cycleId, nomination.id, nomination.user_id]
      );

      if (rankings.rows.length === 0) {
        continue; // No rankings for this nomination
      }

      // Calculate average rank
      const totalRank = rankings.rows.reduce((sum, r) => sum + r.rank_position, 0);
      const averageRank = totalRank / rankings.rows.length;

      // Calculate final rank (lower average = better rank)
      const allAverages = await client.query(
        `SELECT nomination_id, AVG(rank_position) as avg_rank
         FROM rankings r
         JOIN nominations n ON r.nomination_id = n.id
         WHERE r.cycle_id = $1 AND r.user_id != n.user_id
         GROUP BY nomination_id
         ORDER BY avg_rank ASC`,
        [cycleId]
      );

      const finalRank = allAverages.rows.findIndex(avg => avg.nomination_id === nomination.id) + 1;

      // Calculate points (2 points for each member you beat)
      const pointsEarned = (memberCount - finalRank) * 2;

      // Calculate guess accuracy for this user
      const guesses = await client.query(
        'SELECT COUNT(*) as total, SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct FROM guesses WHERE cycle_id = $1 AND user_id = $2',
        [cycleId, nomination.user_id]
      );

      const guessAccuracy = guesses.rows[0].total > 0 
        ? (guesses.rows[0].correct / guesses.rows[0].total) * 100 
        : 0;

      // Insert or update cycle results
      await client.query(
        `INSERT INTO cycle_results (cycle_id, user_id, nomination_id, final_rank, average_rank, points_earned, guess_accuracy, total_votes_received)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (cycle_id, user_id)
         DO UPDATE SET 
           final_rank = EXCLUDED.final_rank,
           average_rank = EXCLUDED.average_rank,
           points_earned = EXCLUDED.points_earned,
           guess_accuracy = EXCLUDED.guess_accuracy,
           total_votes_received = EXCLUDED.total_votes_received,
           calculated_at = CURRENT_TIMESTAMP`,
        [cycleId, nomination.user_id, nomination.id, finalRank, averageRank, pointsEarned, guessAccuracy, rankings.rows.length]
      );
    }

    // Update cycle with winner information
    const winnerResult = await client.query(
      `SELECT cr.user_id, cr.nomination_id, cr.points_earned
       FROM cycle_results cr
       WHERE cr.cycle_id = $1
       ORDER BY cr.final_rank ASC
       LIMIT 1`,
      [cycleId]
    );

    if (winnerResult.rows.length > 0) {
      const winner = winnerResult.rows[0];
      await client.query(
        'UPDATE cycles SET winner_user_id = $1, winner_movie_id = $2, winner_points = $3 WHERE id = $4',
        [winner.user_id, winner.nomination_id, winner.points_earned, cycleId]
      );
    }

    // Update user season stats
    await updateUserSeasonStats(client, cycleId);

  } catch (error) {
    console.error('Calculate cycle results error:', error);
    throw error;
  }
}

// Helper function to update user season statistics
async function updateUserSeasonStats(client, cycleId) {
  try {
    const cycleInfo = await client.query(
      'SELECT club_id, season_year FROM cycles WHERE id = $1',
      [cycleId]
    );

    const { club_id, season_year } = cycleInfo.rows[0];

    const results = await client.query(
      'SELECT user_id, final_rank, points_earned FROM cycle_results WHERE cycle_id = $1',
      [cycleId]
    );

    for (const result of results.rows) {
      const { user_id, final_rank, points_earned } = result;

      // Get current season stats
      const currentStats = await client.query(
        'SELECT * FROM user_season_stats WHERE user_id = $1 AND club_id = $2 AND season_year = $3',
        [user_id, club_id, season_year]
      );

      if (currentStats.rows.length === 0) {
        // Create new season stats
        await client.query(
          `INSERT INTO user_season_stats (user_id, club_id, season_year, cycles_participated, cycles_won, total_points, average_points)
           VALUES ($1, $2, $3, 1, $4, $5, $5)`,
          [user_id, club_id, season_year, final_rank === 1 ? 1 : 0, points_earned]
        );
      } else {
        // Update existing season stats
        const stats = currentStats.rows[0];
        const newCyclesParticipated = stats.cycles_participated + 1;
        const newCyclesWon = stats.cycles_won + (final_rank === 1 ? 1 : 0);
        const newTotalPoints = parseFloat(stats.total_points) + points_earned;
        const newAveragePoints = newTotalPoints / newCyclesParticipated;

        await client.query(
          `UPDATE user_season_stats 
           SET cycles_participated = $1, cycles_won = $2, total_points = $3, average_points = $4, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $5 AND club_id = $6 AND season_year = $7`,
          [newCyclesParticipated, newCyclesWon, newTotalPoints, newAveragePoints, user_id, club_id, season_year]
        );
      }
    }
  } catch (error) {
    console.error('Update user season stats error:', error);
    throw error;
  }
}

module.exports = router;