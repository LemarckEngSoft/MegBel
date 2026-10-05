const env = require('../config/env');

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: env.duoTimezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function previousDay() {
  const date = new Date(`${today()}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

module.exports = { today, previousDay };
