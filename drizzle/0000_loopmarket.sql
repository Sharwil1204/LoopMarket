PRAGMA foreign_keys = ON;
CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, student_id TEXT NOT NULL, password_hash TEXT, salt TEXT, role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('student','admin')), status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','suspended')), reason TEXT NOT NULL DEFAULT '', bio TEXT NOT NULL DEFAULT '', campus TEXT NOT NULL DEFAULT 'MIT-ADT University', demo INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE access_requests (id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id), status TEXT NOT NULL DEFAULT 'pending', reason TEXT NOT NULL DEFAULT '', reviewed_by TEXT REFERENCES users(id), reviewed_at TEXT, created_at TEXT NOT NULL);
CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL);
CREATE TABLE auth_attempts (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 0, window_start TEXT NOT NULL);
CREATE TABLE listings (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 100), description TEXT NOT NULL CHECK(length(description) <= 2000), category TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('sell','rent','giveaway')), price INTEGER NOT NULL CHECK(price >= 0), condition TEXT NOT NULL, location TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('draft','active','reserved','sold','given_away','archived')), rental_unit TEXT NOT NULL DEFAULT 'day', deposit INTEGER NOT NULL DEFAULT 0 CHECK(deposit >= 0), available_from TEXT, available_to TEXT, terms TEXT NOT NULL DEFAULT '', included TEXT NOT NULL DEFAULT '', demo INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, CHECK((type='giveaway' AND price=0) OR type='rent' AND price>0 OR type='sell' AND price>0));
CREATE INDEX listings_browse ON listings(status, type, category, created_at);
CREATE TABLE listing_images (id TEXT PRIMARY KEY, listing_id TEXT NOT NULL REFERENCES listings(id), url TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0);
CREATE TABLE uploads (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), mime TEXT NOT NULL, size INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE favourites (user_id TEXT NOT NULL REFERENCES users(id), listing_id TEXT NOT NULL REFERENCES listings(id), PRIMARY KEY(user_id,listing_id));
CREATE TABLE conversations (id TEXT PRIMARY KEY, listing_id TEXT NOT NULL REFERENCES listings(id), buyer_id TEXT NOT NULL REFERENCES users(id), seller_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(listing_id,buyer_id));
CREATE TABLE messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id), sender_id TEXT NOT NULL REFERENCES users(id), body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000), nonce TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(sender_id,nonce));
CREATE TABLE exchange_requests (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id), listing_id TEXT NOT NULL REFERENCES listings(id), requester_id TEXT NOT NULL REFERENCES users(id), status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','cancelled','handed_over','completed')), start_date TEXT, end_date TEXT, estimated_total INTEGER NOT NULL DEFAULT 0, deposit INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE UNIQUE INDEX one_open_request ON exchange_requests(conversation_id) WHERE status IN ('pending','accepted','handed_over');
CREATE TABLE rental_bookings (id TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE REFERENCES exchange_requests(id), listing_id TEXT NOT NULL REFERENCES listings(id), start_date TEXT NOT NULL, end_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'booked' CHECK(status IN ('booked','on_loan','returned','cancelled')));
CREATE TABLE reports (id TEXT PRIMARY KEY, listing_id TEXT NOT NULL REFERENCES listings(id), reporter_id TEXT NOT NULL REFERENCES users(id), reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', resolution TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
CREATE TABLE notifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, body TEXT NOT NULL, href TEXT NOT NULL, read_at TEXT, created_at TEXT NOT NULL);
CREATE TABLE audit_records (id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL, target_id TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TRIGGER prevent_conflicting_acceptance BEFORE UPDATE OF status ON exchange_requests WHEN NEW.status='accepted' AND OLD.status='pending' BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM listings l JOIN users u ON u.id=l.owner_id JOIN users buyer ON buyer.id=NEW.requester_id WHERE l.id=NEW.listing_id AND l.status='active' AND u.status='approved' AND buyer.status='approved') THEN RAISE(ABORT,'Listing or participant is unavailable') END;
 SELECT CASE WHEN (SELECT type FROM listings WHERE id=NEW.listing_id)!='rent' AND EXISTS(SELECT 1 FROM exchange_requests WHERE listing_id=NEW.listing_id AND id!=NEW.id AND status IN ('accepted','handed_over','completed')) THEN RAISE(ABORT,'This item already has an accepted request') END;
 SELECT CASE WHEN (SELECT type FROM listings WHERE id=NEW.listing_id)='rent' AND (NEW.start_date IS NULL OR NEW.end_date IS NULL OR NEW.start_date>NEW.end_date OR NEW.start_date<(SELECT available_from FROM listings WHERE id=NEW.listing_id) OR NEW.end_date>(SELECT available_to FROM listings WHERE id=NEW.listing_id)) THEN RAISE(ABORT,'Rental dates are outside availability') END;
 SELECT CASE WHEN (SELECT type FROM listings WHERE id=NEW.listing_id)='rent' AND EXISTS(SELECT 1 FROM rental_bookings WHERE listing_id=NEW.listing_id AND status IN ('booked','on_loan') AND start_date<=NEW.end_date AND end_date>=NEW.start_date) THEN RAISE(ABORT,'These dates overlap an accepted rental') END;
END;
CREATE TRIGGER apply_acceptance AFTER UPDATE OF status ON exchange_requests WHEN NEW.status='accepted' AND OLD.status='pending' BEGIN
 UPDATE listings SET status='reserved',updated_at=NEW.updated_at WHERE id=NEW.listing_id AND type!='rent';
 INSERT INTO rental_bookings(id,request_id,listing_id,start_date,end_date) SELECT NEW.id,NEW.id,NEW.listing_id,NEW.start_date,NEW.end_date WHERE (SELECT type FROM listings WHERE id=NEW.listing_id)='rent';
END;
CREATE TRIGGER apply_handover AFTER UPDATE OF status ON exchange_requests WHEN NEW.status='handed_over' BEGIN
 UPDATE rental_bookings SET status='on_loan' WHERE request_id=NEW.id;
END;
CREATE TRIGGER apply_completion AFTER UPDATE OF status ON exchange_requests WHEN NEW.status='completed' BEGIN
 UPDATE listings SET status=CASE WHEN type='sell' THEN 'sold' ELSE 'given_away' END,updated_at=NEW.updated_at WHERE id=NEW.listing_id AND type!='rent';
 UPDATE rental_bookings SET status='returned' WHERE request_id=NEW.id;
 UPDATE exchange_requests SET status='declined',updated_at=NEW.updated_at WHERE listing_id=NEW.listing_id AND id!=NEW.id AND status='pending' AND (SELECT type FROM listings WHERE id=NEW.listing_id)!='rent';
END;
CREATE TRIGGER apply_cancellation AFTER UPDATE OF status ON exchange_requests WHEN NEW.status='cancelled' BEGIN
 UPDATE listings SET status='active',updated_at=NEW.updated_at WHERE id=NEW.listing_id AND type!='rent' AND status='reserved' AND OLD.status='accepted';
 UPDATE rental_bookings SET status='cancelled' WHERE request_id=NEW.id;
END;
CREATE TRIGGER protect_booked_listing BEFORE UPDATE ON listings WHEN EXISTS(SELECT 1 FROM exchange_requests WHERE listing_id=OLD.id AND status IN ('accepted','handed_over')) AND (NEW.type!=OLD.type OR NEW.price!=OLD.price OR NEW.deposit!=OLD.deposit OR NEW.rental_unit!=OLD.rental_unit OR NEW.available_from IS NOT OLD.available_from OR NEW.available_to IS NOT OLD.available_to) BEGIN
 SELECT RAISE(ABORT,'Keep agreed terms unchanged until open exchanges are completed');
END;
