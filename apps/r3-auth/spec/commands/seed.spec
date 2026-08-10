# The two pieces of state this suite cannot create through the app's own surface,
# seeded with the `db` capability against the local Miniflare D1 file (DATABASE_URL).
# Both are idempotent so the suite can run repeatedly against the same database.

# Promote the fixed admin account to the `admin` role. In-app registration only ever
# grants `user`, and nothing in any flow sets `admin`, so the admin area needs one
# SQL flip. `requireSubject` re-reads the subject row on every request, so a browser
# already signed in as this account becomes an admin on its next navigation — call
# this in `given` after `login "spec-admin@spec.test" …`. The email is the literal
# the admin tests sign in as; v1 SQL has no interpolation, so it is written inline.
command seed_admin() {
	db.query "UPDATE subjects SET role = 'admin' WHERE email_address = 'spec-admin@spec.test'"
}

# Register a relying party with a fixed client id and a redirect URI on this same
# origin, so a signed-in `/authorize` can complete an SSO redirect that lands on a
# real 200 page (`/healthcheck`) inside the one granted host. `redirect_uri` is
# unique in the schema, so the fixed row is deleted first and re-inserted, which also
# clears any client a previous create-client run left on that URI; the delete
# cascades to its grants and sessions. `created_at`/`updated_at` are the epoch-ms
# integers the schema requires.
command seed_code_client() {
	db.query "DELETE FROM clients WHERE redirect_uri = 'http://localhost:3002/healthcheck'"
	db.query "INSERT INTO clients (id, created_at, updated_at, name, secret, redirect_uri, logout_uri) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1786300000000, 1786300000000, 'Spec Code Client', 'spec-secret', 'http://localhost:3002/healthcheck', 'http://localhost:3002/healthcheck')"
}

# A subject and one of its live sessions, so the machine endpoints have real state to
# act on. A session id IS the refresh token clients send to POST /oauth/token, so
# seeding this fixed session lets a spec redeem the `refresh_token` grant — which needs
# no client credentials — for a genuine access token and a signed id_token, without the
# browser code-extraction the runtime cannot express (see authorize-code.spec). The
# same subject row is what GET /api/subjects/:id and GET /userinfo answer with.
#
# Idempotent by fixed ids: the session is deleted first (it references the subject, so
# it must go before the subject row it points at), then the subject, then both are
# re-inserted. `expires_at` is a far-future epoch-ms so the session never reads as
# expired, and `created_at`/`updated_at` are the epoch-ms integers the schema requires.
# The session's `client_id` is the same fixed client `seed_code_client` registers, so a
# `given` must call that first.
command seed_refresh_session() {
	db.query "DELETE FROM sessions WHERE id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'"
	db.query "DELETE FROM subjects WHERE id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'"
	db.query "INSERT INTO subjects (id, created_at, updated_at, email_verified_at, display_name, avatar, role, username, email_address) VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 1786300000000, 1786300000000, 1786300000000, 'Spec Refresh User', 'https://example.test/avatar.png', 'user', 'spec-refresh', 'spec-refresh@spec.test')"
	db.query "INSERT INTO sessions (id, created_at, updated_at, expires_at, subject_id, client_id, user_agent, ip_address) VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 1786300000000, 1786300000000, 4102444800000, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', NULL, NULL)"
}
