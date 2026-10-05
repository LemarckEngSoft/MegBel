const { previousDay } = require('../utils/dates');

function isoDate(value) { return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10); }

async function ensureLoss(client, pairId) {
  const stateResult = await client.query('SELECT * FROM streak_state WHERE pair_id = $1 FOR UPDATE', [pairId]);
  const usersResult = await client.query('SELECT id FROM users WHERE pair_id = $1 ORDER BY created_at', [pairId]);
  if (!stateResult.rowCount || usersResult.rowCount !== 2) return null;

  const state = stateResult.rows[0];
  const lossDate = state.pending_loss_date ? isoDate(state.pending_loss_date) : previousDay();
  if (lossDate < isoDate(state.tracking_started_on)) return null;

  const activityResult = await client.query('SELECT * FROM daily_activity WHERE pair_id = $1 AND activity_date = $2', [pairId, lossDate]);
  const activity = activityResult.rows[0];
  if (activity?.completed) return null;
  if (!state.pending_loss_date && state.last_completed_on && isoDate(state.last_completed_on) >= lossDate) return null;

  const missing = activity
    ? usersResult.rows.filter((user, index) => !activity[index === 0 ? 'user_a_completed' : 'user_b_completed']).map((user) => user.id)
    : usersResult.rows.map((user) => user.id);
  if (!missing.length) return null;

  if (!state.pending_loss_date) {
    const lastGood = await client.query('SELECT day_number FROM daily_activity WHERE pair_id = $1 AND activity_date < $2 AND completed = TRUE ORDER BY activity_date DESC LIMIT 1', [pairId, lossDate]);
    const restoreDay = lastGood.rows[0]?.day_number ?? Math.max(0, state.initial_streak - 1);
    await client.query('UPDATE streak_state SET pending_loss_date = $1, pending_loss_day = $2, lost_on = $1, updated_at = NOW() WHERE pair_id = $3', [lossDate, restoreDay, pairId]);
    for (const recipientId of usersResult.rows.map((user) => user.id)) {
      const body = `A sequência foi perdida em ${lossDate}. Acesse a aba Punição para atribuir as punições necessárias e restaurar.`;
      await client.query(`INSERT INTO notifications (pair_id, recipient_id, type, title, body)
        SELECT $1, $2, 'streak_lost', 'Sequência perdida', $3
        WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE pair_id = $1 AND recipient_id = $2 AND type = 'streak_lost' AND body = $3)`, [pairId, recipientId, body]);
    }
  }

  return { date: lossDate, day: state.pending_loss_day ?? state.current_streak, missing };
}

module.exports = { ensureLoss };
