-- Ocularr Database Schema
-- Enhanced version with individual club display names and password reset

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    bio TEXT,
    profile_picture VARCHAR(255),
    favorite_genre VARCHAR(100),
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Clubs table
CREATE TABLE clubs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    creator_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    invite_code VARCHAR(10) UNIQUE NOT NULL,
    is_public BOOLEAN DEFAULT false,
    password_hash VARCHAR(255),
    club_picture VARCHAR(255),
    max_members INTEGER DEFAULT 50,
    url_slug VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Club membership with roles and individual club display names
CREATE TYPE club_role AS ENUM ('critic', 'director', 'producer');

CREATE TABLE club_members (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
    role club_role DEFAULT 'critic',
    club_display_name VARCHAR(100), -- NEW: Individual display name per club
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(user_id, club_id)
);

-- Theme pool for clubs
CREATE TABLE themes (
    id SERIAL PRIMARY KEY,
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
    submitted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    theme_text VARCHAR(200) NOT NULL,
    is_used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Movie cycles
CREATE TYPE cycle_phase AS ENUM ('idle', 'nomination', 'watching', 'ranking', 'results');

CREATE TABLE cycles (
    id SERIAL PRIMARY KEY,
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
    theme_id INTEGER REFERENCES themes(id) ON DELETE SET NULL,
    theme_text VARCHAR(200),
    phase cycle_phase DEFAULT 'nomination',
    cycle_number INTEGER NOT NULL,
    season_year INTEGER NOT NULL,
    started_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    nomination_deadline TIMESTAMP,
    watching_deadline TIMESTAMP,
    ranking_deadline TIMESTAMP,
    completed_at TIMESTAMP,
    winner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    winner_movie_id INTEGER,
    winner_points DECIMAL(5,2)
);

-- Movie nominations for cycles
CREATE TABLE nominations (
    id SERIAL PRIMARY KEY,
    cycle_id INTEGER REFERENCES cycles(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    tmdb_id INTEGER NOT NULL, -- Changed from tmdb_movie_id to tmdb_id for consistency
    title VARCHAR(255) NOT NULL,
    year INTEGER,
    poster_path VARCHAR(255),
    overview TEXT,
    release_date DATE, -- Added release_date field
    genre_ids INTEGER[],
    director VARCHAR(255),
    runtime INTEGER,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cycle_id, user_id)
);

-- User progress tracking movies they've watched
CREATE TABLE watch_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    cycle_id INTEGER REFERENCES cycles(id) ON DELETE CASCADE,
    nomination_id INTEGER REFERENCES nominations(id) ON DELETE CASCADE,
    watched BOOLEAN DEFAULT false,
    watched_at TIMESTAMP,
    rating DECIMAL(2,1) CHECK (rating >= 0 AND rating <= 10),
    personal_notes TEXT,
    UNIQUE(user_id, cycle_id, nomination_id)
);

-- User guesses for who nominated what movie
CREATE TABLE guesses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    cycle_id INTEGER REFERENCES cycles(id) ON DELETE CASCADE,
    nomination_id INTEGER REFERENCES nominations(id) ON DELETE CASCADE,
    guessed_nominator_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    is_correct BOOLEAN,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, cycle_id, nomination_id)
);

-- Movie rankings submitted by users
CREATE TABLE rankings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    cycle_id INTEGER REFERENCES cycles(id) ON DELETE CASCADE,
    nomination_id INTEGER REFERENCES nominations(id) ON DELETE CASCADE,
    rank_position INTEGER NOT NULL CHECK (rank_position > 0),
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, cycle_id, nomination_id),
    UNIQUE(user_id, cycle_id, rank_position)
);

-- Final cycle results and points
CREATE TABLE cycle_results (
    id SERIAL PRIMARY KEY,
    cycle_id INTEGER REFERENCES cycles(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    nomination_id INTEGER REFERENCES nominations(id) ON DELETE CASCADE,
    final_rank INTEGER NOT NULL,
    average_rank DECIMAL(4,2),
    points_earned DECIMAL(5,2) DEFAULT 0,
    guess_accuracy DECIMAL(4,2) DEFAULT 0,
    total_votes_received INTEGER DEFAULT 0,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cycle_id, user_id)
);

-- User season statistics and leaderboards
CREATE TABLE user_season_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
    season_year INTEGER NOT NULL,
    cycles_participated INTEGER DEFAULT 0,
    cycles_won INTEGER DEFAULT 0,
    total_points DECIMAL(8,2) DEFAULT 0,
    average_points DECIMAL(5,2) DEFAULT 0,
    average_rank DECIMAL(4,2) DEFAULT 0,
    guess_accuracy DECIMAL(4,2) DEFAULT 0,
    movies_watched INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, club_id, season_year)
);

-- User favorite movies (final version)
CREATE TABLE favorite_movies (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tmdb_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    poster_path VARCHAR(255),
    release_year INTEGER,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, tmdb_id)
);

-- User watchlist (final version)
CREATE TABLE watchlist (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tmdb_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    poster_path VARCHAR(255),
    release_year INTEGER,
    is_watched BOOLEAN DEFAULT FALSE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, tmdb_id)
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_reset_token ON users(reset_token);
CREATE INDEX idx_clubs_creator ON clubs(creator_id);
CREATE INDEX idx_clubs_invite_code ON clubs(invite_code);
CREATE INDEX idx_clubs_url_slug ON clubs(url_slug);
CREATE INDEX idx_club_members_user ON club_members(user_id);
CREATE INDEX idx_club_members_club ON club_members(club_id);
CREATE INDEX idx_club_members_active ON club_members(club_id, is_active);
CREATE INDEX idx_themes_club ON themes(club_id);
CREATE INDEX idx_themes_unused ON themes(club_id, is_used);
CREATE INDEX idx_cycles_club ON cycles(club_id);
CREATE INDEX idx_cycles_club_phase ON cycles(club_id, phase);
CREATE INDEX idx_cycles_season ON cycles(club_id, season_year);
CREATE INDEX idx_nominations_cycle ON nominations(cycle_id);
CREATE INDEX idx_nominations_user ON nominations(user_id);
CREATE INDEX idx_nominations_tmdb_id ON nominations(tmdb_id);
CREATE INDEX idx_watch_progress_user_cycle ON watch_progress(user_id, cycle_id);
CREATE INDEX idx_guesses_user_cycle ON guesses(user_id, cycle_id);
CREATE INDEX idx_rankings_user_cycle ON rankings(user_id, cycle_id);
CREATE INDEX idx_cycle_results_cycle ON cycle_results(cycle_id);
CREATE INDEX idx_cycle_results_user ON cycle_results(user_id);
CREATE INDEX idx_user_season_stats_user_club ON user_season_stats(user_id, club_id);
CREATE INDEX idx_user_season_stats_club_season ON user_season_stats(club_id, season_year);
CREATE INDEX idx_favorite_movies_user_id ON favorite_movies(user_id);
CREATE INDEX idx_watchlist_user_id ON watchlist(user_id);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clubs_updated_at BEFORE UPDATE ON clubs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_season_stats_updated_at BEFORE UPDATE ON user_season_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();