# The black-box way to obtain a signed-in browser session, for a test's `given`.
#
# The credential form only renders its fields when the authorize request carries
# `prompt=create`, so a bare `/` shows just the GitHub button. This opens `/` first
# (which self-bootstraps the auth server's own client row via
# `Client.ensureAuthServerClient`, so a freshly migrated database works with no
# prior visit), then navigates to a hand-built `prompt=create` request naming that
# client, which is what makes the four credential fields appear.
#
# Submitting the form is register-or-sign-in in one POST: an unknown email is
# registered with a verified password and signed in; a known email is signed in
# against its stored password. So the same call lands authenticated whether or not
# the account already exists — which is what makes a fixed email idempotent across
# runs (first run registers, later runs sign in). `username` must be present and
# unique, so it reuses the (unique) email.
command login(email, password) {
	let creds = { email: email, password: password }
	browser.open "http://localhost:3002/"
	browser.navigate "http://localhost:3002/authorize?response_type=code&client_id=d12d3901-3cbe-468b-adf5-ac3d3e015728&redirect_uri=http://localhost:3002/auth/callback&state=spec-login&prompt=create"
	browser.fill textbox "Display name" with "Spec User"
	browser.fill textbox "Username" with creds.email
	browser.fill textbox "Email" with creds.email
	browser.fill textbox "Password" with creds.password
	browser.click button "Login"
	# The POST answers with a redirect chain (…/auth/callback sets the session
	# cookie, then → /account/sessions). agent-browser returns from the click before
	# that chain lands, and a navigation issued too early aborts it before the cookie
	# is written; two read-only URL observations let the chain finish undisturbed, so
	# the caller's first navigation is already authenticated.
	browser.url
	browser.url
}
