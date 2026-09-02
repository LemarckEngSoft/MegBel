CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Nosso espaco',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  photo_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  pair_id UUID NOT NULL REFERENCES pairs(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS one_admin_per_pair ON users(pair_id) WHERE role = 'admin';
CREATE INDEX IF NOT EXISTS users_pair_id_idx ON users(pair_id);

CREATE OR REPLACE FUNCTION enforce_pair_user_limit() RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM users WHERE pair_id = NEW.pair_id) >= 2 THEN
    RAISE EXCEPTION 'Cada espaco pode ter exatamente duas pessoas.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_pair_limit ON users;
CREATE TRIGGER users_pair_limit BEFORE INSERT ON users FOR EACH ROW EXECUTE FUNCTION enforce_pair_user_limit();
