ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_message_type_check CHECK (message_type IN ('text', 'image', 'audio'));
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_check;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_content_check;
ALTER TABLE messages ADD CONSTRAINT messages_content_check CHECK ((message_type = 'text' AND content IS NOT NULL) OR (message_type IN ('image', 'audio') AND media_url IS NOT NULL));

ALTER TABLE pet_state ADD COLUMN IF NOT EXISTS expression TEXT NOT NULL DEFAULT 'feliz';

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id UUID NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx ON notifications(recipient_id, created_at DESC);

CREATE TABLE IF NOT EXISTS nominations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id UUID NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
  nominator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nominee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL CHECK (char_length(nickname) BETWEEN 1 AND 50),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE(pair_id, nominator_id, nominee_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS accepted_nickname_per_pair ON nominations(pair_id, nominee_id) WHERE status = 'accepted';

ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname TEXT;

INSERT INTO pet_items (category, name, description, layer, sort_order)
SELECT category, initcap(category) || ' ' || number, 'Placeholder de personalizacao', layer, number
FROM (VALUES ('eyes', 1), ('glasses', 2), ('expression', 3), ('top', 4), ('shoes', 5), ('hat', 6)) AS categories(category, layer)
CROSS JOIN generate_series(1, 30) AS number
ON CONFLICT DO NOTHING;
