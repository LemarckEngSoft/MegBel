CREATE TABLE IF NOT EXISTS punishments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id UUID NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  punishment_date DATE NOT NULL,
  streak_day INTEGER NOT NULL CHECK (streak_day > 0),
  punished_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  punishment_text TEXT NOT NULL CHECK (char_length(punishment_text) BETWEEN 1 AND 300),
  details TEXT NOT NULL DEFAULT '' CHECK (char_length(details) <= 1000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'restored')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  restored_at TIMESTAMPTZ,
  UNIQUE(pair_id, punishment_date, punished_user_id)
);
CREATE INDEX IF NOT EXISTS punishments_pair_status_idx ON punishments(pair_id, status, punishment_date DESC);

ALTER TABLE streak_state ADD COLUMN IF NOT EXISTS pending_loss_date DATE;
ALTER TABLE streak_state ADD COLUMN IF NOT EXISTS pending_loss_day INTEGER;
