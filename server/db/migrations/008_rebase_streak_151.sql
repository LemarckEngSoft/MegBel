ALTER TABLE streak_state ADD COLUMN IF NOT EXISTS tracking_started_on DATE NOT NULL DEFAULT '2026-10-05';

WITH pair_members AS (
  SELECT pair_id,
         (array_agg(id ORDER BY created_at))[1] AS user_a_id,
         (array_agg(id ORDER BY created_at))[2] AS user_b_id
  FROM users
  GROUP BY pair_id
  HAVING COUNT(*) = 2
), dates AS (
  SELECT pair_members.pair_id,
         pair_members.user_a_id,
         pair_members.user_b_id,
         day_value::date AS activity_date,
         (10 + day_value::date - DATE '2026-05-17')::integer AS day_number
  FROM pair_members
  CROSS JOIN LATERAL generate_series(
    TIMESTAMP '2026-05-17 12:00:00',
    TIMESTAMP '2026-10-04 12:00:00',
    INTERVAL '1 day'
  ) AS generated(day_value)
)
INSERT INTO daily_activity (
  pair_id, activity_date, user_a_id, user_b_id,
  user_a_completed, user_b_completed, completed, day_number, completed_at
)
SELECT pair_id, activity_date, user_a_id, user_b_id,
       TRUE, TRUE, TRUE, day_number,
       activity_date::timestamptz + INTERVAL '12 hours'
FROM dates
ON CONFLICT (pair_id, activity_date) DO UPDATE SET
  user_a_id = EXCLUDED.user_a_id,
  user_b_id = EXCLUDED.user_b_id,
  user_a_completed = TRUE,
  user_b_completed = TRUE,
  completed = TRUE,
  day_number = EXCLUDED.day_number,
  completed_at = COALESCE(daily_activity.completed_at, EXCLUDED.completed_at);

UPDATE streak_state
SET initial_streak = 10,
    current_streak = 151,
    started_on = DATE '2026-05-17',
    tracking_started_on = DATE '2026-05-17',
    last_completed_on = DATE '2026-10-04',
    updated_at = NOW();
