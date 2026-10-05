const { withTransaction } = require('../config/database');
const { ensureLoss } = require('./streak-loss.service');
const { today } = require('../utils/dates');
function dateOnly(value) { return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10); }

async function recordParticipation(pairId, userId) {
  return withTransaction(async (client) => {
    const loss = await ensureLoss(client, pairId);
    if (loss) return { completed: false, loss, activity: null };
    const users = await client.query('SELECT id FROM users WHERE pair_id = $1 ORDER BY created_at', [pairId]);
    if (users.rowCount !== 2) return { completed: false, activity: null };
    const [first, second] = users.rows;
    const result = await client.query(`INSERT INTO daily_activity (pair_id, activity_date, user_a_id, user_b_id, user_a_completed, user_b_completed)
      VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (pair_id, activity_date) DO UPDATE SET user_a_completed = daily_activity.user_a_completed OR EXCLUDED.user_a_completed, user_b_completed = daily_activity.user_b_completed OR EXCLUDED.user_b_completed RETURNING *`, [pairId, today(), first.id, second.id, userId === first.id, userId === second.id]);
    const activity = result.rows[0];
    const completed = activity.user_a_completed && activity.user_b_completed;
    let streak = null;
    if (completed && !activity.completed) {
      const current = await client.query('SELECT current_streak, initial_streak, started_on FROM streak_state WHERE pair_id = $1 FOR UPDATE', [pairId]);
      const baselineDay = dateOnly(result.rows[0].activity_date);
      const startDay = dateOnly(current.rows[0].started_on);
      const elapsedDays = Math.floor((new Date(`${baselineDay}T12:00:00Z`) - new Date(`${startDay}T12:00:00Z`)) / 86400000);
      const restoredDays = await client.query(`SELECT COUNT(DISTINCT punishment.punishment_date)::int AS count FROM punishments punishment
        LEFT JOIN daily_activity activity ON activity.pair_id = punishment.pair_id AND activity.activity_date = punishment.punishment_date
        WHERE punishment.pair_id = $1 AND punishment.status = 'restored' AND punishment.punishment_date < $2 AND COALESCE(activity.completed, FALSE) = FALSE`, [pairId, baselineDay]);
      const dayNumber = current.rows[0].initial_streak + elapsedDays - restoredDays.rows[0].count;
      await client.query('UPDATE daily_activity SET completed = TRUE, day_number = $2, completed_at = NOW() WHERE id = $1', [activity.id, dayNumber]);
      const updated = await client.query('UPDATE streak_state SET current_streak = GREATEST(current_streak, $1), last_completed_on = $2, updated_at = NOW() WHERE pair_id = $3 RETURNING current_streak', [dayNumber, today(), pairId]);
      streak = updated.rows[0];
      activity.day_number = dayNumber;
    }
    return { completed, justCompleted: completed && !activity.completed, activity: { ...activity, completed }, streak };
  });
}
module.exports = { recordParticipation, today };
