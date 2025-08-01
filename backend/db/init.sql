-- Ocularr Database Schema
-- Part 1: Users and Clubs

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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Club membership with roles
CREATE TYPE club_role AS ENUM ('critic', 'director', 'producer');

CREATE TABLE club_members (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
    role club_role DEFAULT 'critic',
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
-- Part 2: Cycles and Movies

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
    tmdb_movie_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    year INTEGER,
    poster_path VARCHAR(255),
    overview TEXT,
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
-- Part 3: Rankings and Results

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

-- Personal movie watchlists
CREATE TABLE user_watchlists (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    tmdb_movie_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    poster_path VARCHAR(255),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    watched BOOLEAN DEFAULT false,
    personal_rating DECIMAL(2,1) CHECK (personal_rating >= 0 AND personal_rating <= 10),
    notes TEXT,
    UNIQUE(user_id, tmdb_movie_id)
);
-- Part 4: Statistics and Indexes

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

-- Create indexes for better performance
CREATE INDEX idx_clubs_creator ON clubs(creator_id);
CREATE INDEX idx_clubs_invite_code ON clubs(invite_code);
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
CREATE INDEX idx_watch_progress_user_cycle ON watch_progress(user_id, cycle_id);
CREATE INDEX idx_guesses_user_cycle ON guesses(user_id, cycle_id);
CREATE INDEX idx_rankings_user_cycle ON rankings(user_id, cycle_id);
CREATE INDEX idx_cycle_results_cycle ON cycle_results(cycle_id);
CREATE INDEX idx_cycle_results_user ON cycle_results(user_id);
CREATE INDEX idx_user_watchlists_user ON user_watchlists(user_id);
CREATE INDEX idx_user_season_stats_user_club ON user_season_stats(user_id, club_id);
CREATE INDEX idx_user_season_stats_club_season ON user_season_stats(club_id, season_year);

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

-- User favorite movies
CREATE TABLE IF NOT EXISTS user_favorite_movies (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tmdb_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    poster_path VARCHAR(255),
    release_date DATE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, tmdb_id)
);

-- User watchlist
CREATE TABLE IF NOT EXISTS user_watchlist (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tmdb_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    poster_path VARCHAR(255),
    release_date DATE,
    overview TEXT,
    watched BOOLEAN DEFAULT FALSE,
    watched_at TIMESTAMP,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, tmdb_id)
);

-- Add bio column to users table if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_favorite_movies_user_id ON user_favorite_movies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_watchlist_user_id ON user_watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_nominations_tmdb_id ON nominations(tmdb_id);

-- Create favorite_movies table (what the frontend expects)
CREATE TABLE IF NOT EXISTS favorite_movies (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tmdb_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    poster_path VARCHAR(255),
    release_year INTEGER,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, tmdb_id)
);

-- Create watchlist table (what the frontend expects)
CREATE TABLE IF NOT EXISTS watchlist (
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

-- Create indexes for the new tables
CREATE INDEX IF NOT EXISTS idx_favorite_movies_user_id ON favorite_movies(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist(user_id);