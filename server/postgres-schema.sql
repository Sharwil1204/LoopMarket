-- LoopMarket PostgreSQL Production Schema
-- Designed for Neon PostgreSQL and Vercel Postgres

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  student_id TEXT NOT NULL,
  password_hash TEXT,
  salt TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('student','admin')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','suspended')),
  reason TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  campus TEXT NOT NULL DEFAULT 'MIT-ADT University',
  demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS access_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT NOT NULL DEFAULT '',
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_expires ON sessions (id, expires_at);

CREATE TABLE IF NOT EXISTS auth_attempts (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 100),
  description TEXT NOT NULL CHECK(length(description) <= 2000),
  category TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('sell','rent','giveaway')),
  price INTEGER NOT NULL CHECK(price >= 0),
  condition TEXT NOT NULL,
  location TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('draft','active','reserved','sold','given_away','archived')),
  rental_unit TEXT NOT NULL DEFAULT 'day',
  deposit INTEGER NOT NULL DEFAULT 0 CHECK(deposit >= 0),
  available_from TEXT,
  available_to TEXT,
  terms TEXT NOT NULL DEFAULT '',
  included TEXT NOT NULL DEFAULT '',
  demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK((type='giveaway' AND price=0) OR (type='rent' AND price>0) OR (type='sell' AND price>0))
);

CREATE INDEX IF NOT EXISTS listings_browse ON listings(status, type, category, created_at);

CREATE TABLE IF NOT EXISTS listing_images (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_listing_images_lid ON listing_images(listing_id, position);

CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS favourites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id, listing_id)
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(listing_id, buyer_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
  nonce TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(sender_id, nonce)
);

CREATE TABLE IF NOT EXISTS exchange_requests (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','cancelled','handed_over','completed')),
  start_date TEXT,
  end_date TEXT,
  estimated_total INTEGER NOT NULL DEFAULT 0,
  deposit INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS one_open_request ON exchange_requests(conversation_id) WHERE status IN ('pending','accepted','handed_over');

CREATE TABLE IF NOT EXISTS rental_bookings (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE REFERENCES exchange_requests(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked' CHECK(status IN ('booked','on_loan','returned','cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_rental_bookings_lid ON rental_bookings(listing_id, status, start_date, end_date);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  resolution TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  href TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_records (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Function supporting changes() from batch operations
CREATE OR REPLACE FUNCTION changes() RETURNS integer AS $$
BEGIN
  RETURN NULLIF(current_setting('loopmarket.changes', true), '')::integer;
EXCEPTION WHEN OTHERS THEN
  RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- Trigger 1: prevent conflicting acceptance
CREATE OR REPLACE FUNCTION trg_prevent_conflicting_acceptance() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    IF NOT EXISTS (
      SELECT 1 FROM listings l
      JOIN users u ON u.id = l.owner_id
      JOIN users buyer ON buyer.id = NEW.requester_id
      WHERE l.id = NEW.listing_id AND l.status = 'active' AND u.status = 'approved' AND buyer.status = 'approved'
    ) THEN
      RAISE EXCEPTION 'Listing or participant is unavailable';
    END IF;

    IF (SELECT type FROM listings WHERE id = NEW.listing_id) != 'rent' AND EXISTS (
      SELECT 1 FROM exchange_requests WHERE listing_id = NEW.listing_id AND id != NEW.id AND status IN ('accepted', 'handed_over', 'completed')
    ) THEN
      RAISE EXCEPTION 'This item already has an accepted request';
    END IF;

    IF (SELECT type FROM listings WHERE id = NEW.listing_id) = 'rent' AND (
      NEW.start_date IS NULL OR NEW.end_date IS NULL OR NEW.start_date > NEW.end_date
      OR NEW.start_date < (SELECT available_from FROM listings WHERE id = NEW.listing_id)
      OR NEW.end_date > (SELECT available_to FROM listings WHERE id = NEW.listing_id)
    ) THEN
      RAISE EXCEPTION 'Rental dates are outside availability';
    END IF;

    IF (SELECT type FROM listings WHERE id = NEW.listing_id) = 'rent' AND EXISTS (
      SELECT 1 FROM rental_bookings WHERE listing_id = NEW.listing_id AND status IN ('booked', 'on_loan') AND start_date <= NEW.end_date AND end_date >= NEW.start_date
    ) THEN
      RAISE EXCEPTION 'These dates overlap an accepted rental';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_conflicting_acceptance ON exchange_requests;
CREATE TRIGGER prevent_conflicting_acceptance
BEFORE UPDATE OF status ON exchange_requests
FOR EACH ROW EXECUTE FUNCTION trg_prevent_conflicting_acceptance();

-- Trigger 2: apply acceptance
CREATE OR REPLACE FUNCTION trg_apply_acceptance() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    UPDATE listings SET status = 'reserved', updated_at = NEW.updated_at WHERE id = NEW.listing_id AND type != 'rent';
    IF (SELECT type FROM listings WHERE id = NEW.listing_id) = 'rent' THEN
      INSERT INTO rental_bookings(id, request_id, listing_id, start_date, end_date)
      VALUES (NEW.id, NEW.id, NEW.listing_id, NEW.start_date, NEW.end_date)
      ON CONFLICT (request_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS apply_acceptance ON exchange_requests;
CREATE TRIGGER apply_acceptance
AFTER UPDATE OF status ON exchange_requests
FOR EACH ROW EXECUTE FUNCTION trg_apply_acceptance();

-- Trigger 3: apply handover
CREATE OR REPLACE FUNCTION trg_apply_handover() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'handed_over' THEN
    UPDATE rental_bookings SET status = 'on_loan' WHERE request_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS apply_handover ON exchange_requests;
CREATE TRIGGER apply_handover
AFTER UPDATE OF status ON exchange_requests
FOR EACH ROW EXECUTE FUNCTION trg_apply_handover();

-- Trigger 4: apply completion
CREATE OR REPLACE FUNCTION trg_apply_completion() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    UPDATE listings SET status = CASE WHEN type = 'sell' THEN 'sold' ELSE 'given_away' END, updated_at = NEW.updated_at WHERE id = NEW.listing_id AND type != 'rent';
    UPDATE rental_bookings SET status = 'returned' WHERE request_id = NEW.id;
    UPDATE exchange_requests SET status = 'declined', updated_at = NEW.updated_at WHERE listing_id = NEW.listing_id AND id != NEW.id AND status = 'pending' AND (SELECT type FROM listings WHERE id = NEW.listing_id) != 'rent';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS apply_completion ON exchange_requests;
CREATE TRIGGER apply_completion
AFTER UPDATE OF status ON exchange_requests
FOR EACH ROW EXECUTE FUNCTION trg_apply_completion();

-- Trigger 5: apply cancellation
CREATE OR REPLACE FUNCTION trg_apply_cancellation() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' THEN
    UPDATE listings SET status = 'active', updated_at = NEW.updated_at WHERE id = NEW.listing_id AND type != 'rent' AND status = 'reserved' AND OLD.status = 'accepted';
    UPDATE rental_bookings SET status = 'cancelled' WHERE request_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS apply_cancellation ON exchange_requests;
CREATE TRIGGER apply_cancellation
AFTER UPDATE OF status ON exchange_requests
FOR EACH ROW EXECUTE FUNCTION trg_apply_cancellation();

-- Trigger 6: protect booked listing
CREATE OR REPLACE FUNCTION trg_protect_booked_listing() RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM exchange_requests WHERE listing_id = OLD.id AND status IN ('accepted', 'handed_over'))
    AND (
      NEW.type != OLD.type
      OR NEW.price != OLD.price
      OR NEW.deposit != OLD.deposit
      OR NEW.rental_unit != OLD.rental_unit
      OR NEW.available_from IS DISTINCT FROM OLD.available_from
      OR NEW.available_to IS DISTINCT FROM OLD.available_to
    ) THEN
    RAISE EXCEPTION 'Keep agreed terms unchanged until open exchanges are completed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_booked_listing ON listings;
CREATE TRIGGER protect_booked_listing
BEFORE UPDATE ON listings
FOR EACH ROW EXECUTE FUNCTION trg_protect_booked_listing();
