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
