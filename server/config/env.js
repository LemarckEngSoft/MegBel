const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'development-only-change-me',
  cookieSecret: process.env.COOKIE_SECRET || 'development-only-change-me',
  duoTimezone: process.env.DUO_TIMEZONE || 'America/Manaus',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000'
};

if (env.nodeEnv === 'production' && (env.jwtSecret.includes('change-me') || !env.databaseUrl)) {
  throw new Error('DATABASE_URL e JWT_SECRET devem ser configurados em producao.');
}

module.exports = env;
