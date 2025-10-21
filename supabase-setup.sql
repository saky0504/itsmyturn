-- 📝 It's My Turn - Community Board Database Setup
-- Run this SQL in your Supabase SQL Editor

-- 1. Create comments table (simplified - no track info needed)
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  author TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  likes INTEGER DEFAULT 0,
  track_id TEXT,
  track_title TEXT,
  track_artist TEXT
);

-- 1.1 If table already exists, make sure track fields are nullable
-- Run this to update existing table:
-- ALTER TABLE comments ALTER COLUMN track_id DROP NOT NULL;
-- ALTER TABLE comments ALTER COLUMN track_title DROP NOT NULL;
-- ALTER TABLE comments ALTER COLUMN track_artist DROP NOT NULL;

-- 2. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_track_id ON comments(track_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- 4. Create policies
-- Allow anyone to read comments
CREATE POLICY "Anyone can read comments"
  ON comments FOR SELECT
  TO public
  USING (true);

-- Allow anyone to insert comments (anonymous posting)
CREATE POLICY "Anyone can insert comments"
  ON comments FOR INSERT
  TO public
  WITH CHECK (true);

-- Allow anyone to update likes
CREATE POLICY "Anyone can update likes"
  ON comments FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- 5. Create a function to increment likes
CREATE OR REPLACE FUNCTION increment_comment_likes(comment_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE comments
  SET likes = likes + 1
  WHERE id = comment_id;
END;
$$ LANGUAGE plpgsql;

-- 6. Optional: Create a view for recent comments
CREATE OR REPLACE VIEW recent_comments AS
  SELECT * FROM comments
  ORDER BY created_at DESC
  LIMIT 100;

-- ✅ Setup complete! Your database is ready for the community board.

