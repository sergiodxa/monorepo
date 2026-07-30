-- Migration number: 0002 	 2026-02-16T00:00:00.000Z

-- Add subject_id column to users table for linking to auth.sergiodxa.com
-- This links local blog profiles to centralized auth subjects
-- Note: UNIQUE constraint enforced via index below (SQLite doesn't support ADD COLUMN UNIQUE with existing data)
ALTER TABLE users ADD COLUMN subject_id VARCHAR(36);

-- Create unique index for efficient subject_id lookups during authentication
-- This enforces uniqueness on the column
CREATE UNIQUE INDEX idx_users_subject_id ON users (subject_id) WHERE subject_id IS NOT NULL;

-- Drop connections table (auth handles OAuth connections now)
-- Safe to drop: no other tables reference connections
DROP TABLE IF EXISTS connections;

-- Clean up orphaned index from connections table
DROP INDEX IF EXISTS idx_connections_provider;
