UPDATE daily_activity activity
SET day_number = streak.current_streak + 1
FROM streak_state streak
WHERE activity.pair_id = streak.pair_id
  AND activity.completed = TRUE
  AND activity.day_number IS NULL
  AND activity.activity_date >= streak.started_on;

UPDATE streak_state streak
SET current_streak = streak.current_streak + 1,
    last_completed_on = activity.activity_date,
    updated_at = NOW()
FROM daily_activity activity
WHERE activity.pair_id = streak.pair_id
  AND activity.completed = TRUE
  AND activity.day_number = streak.current_streak + 1
  AND streak.last_completed_on IS NULL;
