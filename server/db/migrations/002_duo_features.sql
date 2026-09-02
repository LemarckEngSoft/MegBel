CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id UUID NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image')),
  content TEXT CHECK (char_length(content) <= 4000),
  media_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((message_type = 'text' AND content IS NOT NULL) OR (message_type = 'image' AND media_url IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS messages_pair_created_idx ON messages(pair_id, created_at DESC);

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id UUID NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  description TEXT CHECK (char_length(description) <= 1000),
  event_date DATE NOT NULL,
  event_time TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS calendar_events_pair_date_idx ON calendar_events(pair_id, event_date);

CREATE TABLE IF NOT EXISTS streak_state (
  pair_id UUID PRIMARY KEY REFERENCES pairs(id) ON DELETE CASCADE,
  initial_streak INTEGER NOT NULL DEFAULT 82 CHECK (initial_streak >= 0),
  current_streak INTEGER NOT NULL DEFAULT 82 CHECK (current_streak >= 0),
  started_on DATE NOT NULL DEFAULT '2026-09-01',
  last_completed_on DATE,
  lost_on DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id UUID NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  user_a_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_a_completed BOOLEAN NOT NULL DEFAULT FALSE,
  user_b_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  day_number INTEGER,
  completed_at TIMESTAMPTZ,
  UNIQUE (pair_id, activity_date)
);
CREATE INDEX IF NOT EXISTS daily_activity_pair_date_idx ON daily_activity(pair_id, activity_date DESC);

CREATE TABLE IF NOT EXISTS pet_state (
  pair_id UUID PRIMARY KEY REFERENCES pairs(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Pipoca' CHECK (char_length(name) BETWEEN 1 AND 40),
  mood TEXT NOT NULL DEFAULT 'feliz' CHECK (char_length(mood) BETWEEN 1 AND 30),
  mood_emoji TEXT NOT NULL DEFAULT '😊',
  speech_text TEXT NOT NULL DEFAULT 'Oi, voces dois!' CHECK (char_length(speech_text) <= 140),
  appearance JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pet_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('base', 'eyes', 'mouth', 'expression', 'top', 'bottom', 'shoes', 'hat', 'glasses', 'accessory')),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  layer INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  rarity TEXT NOT NULL DEFAULT 'common',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pet_items_category_active_idx ON pet_items(category, active, sort_order);

CREATE TABLE IF NOT EXISTS milestone_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id UUID NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL CHECK (day_number > 0),
  message TEXT NOT NULL CHECK (char_length(message) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pair_id, day_number)
);

INSERT INTO streak_state (pair_id)
SELECT id FROM pairs
ON CONFLICT (pair_id) DO NOTHING;

INSERT INTO pet_state (pair_id)
SELECT id FROM pairs
ON CONFLICT (pair_id) DO NOTHING;
