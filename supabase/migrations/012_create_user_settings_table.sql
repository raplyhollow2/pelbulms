-- ============================================================
-- USER SETTINGS TABLE
-- ============================================================
-- Stores user preferences and settings

CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Notification Settings
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  course_updates BOOLEAN DEFAULT true,
  announcement_notifications BOOLEAN DEFAULT true,
  message_notifications BOOLEAN DEFAULT true,

  -- Appearance Settings
  theme VARCHAR(20) DEFAULT 'system', -- 'light', 'dark', 'system'
  language VARCHAR(10) DEFAULT 'en',
  timezone VARCHAR(50) DEFAULT 'UTC',

  -- Privacy Settings
  profile_visibility VARCHAR(20) DEFAULT 'public', -- 'public', 'private', 'connections'
  show_progress BOOLEAN DEFAULT true,
  show_certificates BOOLEAN DEFAULT true,

  -- Learning Preferences
  auto_play_video BOOLEAN DEFAULT false,
  video_quality VARCHAR(20) DEFAULT 'auto', -- 'auto', '1080p', '720p', '480p'
  playback_speed DECIMAL(3,2) DEFAULT 1.00,
  subtitle_language VARCHAR(10) DEFAULT 'en',

  -- Email Digest Settings
  digest_frequency VARCHAR(20) DEFAULT 'weekly', -- 'daily', 'weekly', 'monthly'

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_user_settings UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own settings"
  ON user_settings FOR DELETE
  USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_settings_updated_at();

-- Create default settings for existing users
INSERT INTO user_settings (user_id)
SELECT id FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM user_settings WHERE user_settings.user_id = auth.users.id
);

-- Verify table creation
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'user_settings'
ORDER BY ordinal_position;

SELECT 'user_settings table created successfully' as result;