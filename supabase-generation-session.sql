-- ============================================
-- ADD GENERATION SESSION ID TO PORTRAITS TABLE
-- ============================================
-- This column allows tracking and recovering abandoned generations
-- When a user leaves during generation, the portrait still gets created
-- and we can look it up by session ID when they return

-- Add the generation_session_id column
ALTER TABLE portraits 
ADD COLUMN IF NOT EXISTS generation_session_id TEXT;

-- Create an index for fast lookups by session ID
CREATE INDEX IF NOT EXISTS portraits_generation_session_id_idx 
ON portraits (generation_session_id) 
WHERE generation_session_id IS NOT NULL;

-- Create a compound index for the check-generation query
CREATE INDEX IF NOT EXISTS portraits_session_created_idx 
ON portraits (generation_session_id, created_at DESC) 
WHERE generation_session_id IS NOT NULL;

