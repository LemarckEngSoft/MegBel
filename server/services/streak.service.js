const { withTransaction } = require('../config/database');
const env = require('../config/env');

function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: env.duoTimezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function previousDay() { const date = new Date(`${today()}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - 1); return date.toISOString().slice(0, 10); }

async function recordParticipation(pairId, userId) {
  return withTransaction(async (client) => {
    const users = await client.query('SELECT id FROM users WHERE pair_id = $1 ORDER BY created_at', [pairId]);
    if (users.rowCount !== 2) return { completed: false, activity: null };
    const [first, second] = users.rows;
    const result = await client.query(`INSERT INTO daily_activity (pair_id, activity_date, user_a_id, user_b_id, user_a_completed, user_b_completed)
      VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (pair_id, activity_date) DO UPDATE SET user_a_completed = daily_activity.user_a_completed OR EXCLUDED.user_a_completed, user_b_completed = daily_activity.user_b_completed OR EXCLUDED.user_b_completed RETURNING *`, [pairId, today(), first.id, second.id, userId === first.id, userId === second.id]);
    const activity = result.rows[0];
    const completed = activity.user_a_completed && activity.user_b_completed;
    let streak = null;
    if (completed && !activity.completed) {
      const current = await client.query('SELECT current_streak, last_completed_on FROM streak_state WHERE pair_id = $1 FOR UPDATE', [pairId]);
      const dayNumber = (current.rows[0]?.current_streak || 0) + 1;
      await client.query('UPDATE daily_activity SET completed = TRUE, day_number = $2, completed_at = NOW() WHERE id = $1', [activity.id, dayNumber]);
      const updated = await client.query('UPDATE streak_state SET current_streak = current_streak + 1, last_completed_on = $1, updated_at = NOW() WHERE pair_id = $2 RETURNING current_streak', [today(), pairId]);
      streak = updated.rows[0];
      activity.day_number = dayNumber;
    }
    return { completed, justCompleted: completed && !activity.completed, activity: { ...activity, completed }, streak };
  });
}
module.exports = { recordParticipation, today, previousDay };
