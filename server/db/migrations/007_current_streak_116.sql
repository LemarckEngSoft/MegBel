ALTER TABLE streak_state ADD COLUMN IF NOT EXISTS tracking_started_on DATE NOT NULL DEFAULT '2026-10-05';

UPDATE streak_state
SET initial_streak = 82,
    current_streak = 116,
    started_on = '2026-09-01',
    tracking_started_on = '2026-10-05',
    last_completed_on = CASE
      WHEN last_completed_on IS NULL OR last_completed_on < '2026-10-04' THEN '2026-10-04'
      ELSE last_completed_on
    END,
    updated_at = NOW();
