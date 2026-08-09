# The external-provider sign-in routes: /auth/:provider, its callback, and this
# server's own OAuth callback. The GitHub happy path round-trips through
# github.com, which the browser/http capabilities cannot drive (and a redirect
# off to github.com would fail the scoped `net` grant), so every test here uses
# an *unknown* provider or a missing-parameter request to exercise the same
# controllers' refusal branches, which stay on this origin.

# POST /auth/:provider with an unrecognized provider. Rather than error, the
# controller spends the login budget and redirects (303) back to `/authorize` — a
# stale or hand-written form is answered with the page offering every real way in.
# `http` follows that 303 (as a GET) through the self-redirect chain onto the
# sign-in page, so the observable is a final 200. `gitlab`, never `github`: github
# would redirect to github.com, off the granted host. `browser` cannot express
# this — it only issues GETs, and this route is POST-only — so the assertion is on
# the followed status, not on the page's markers.
test "POST /auth/:provider sends an unknown provider back into the sign-in flow" {
	when {
		let result = http.post "http://localhost:3002/auth/gitlab"
	}
	then {
		expect result.status 200
		expect result.ok true
	}
}

# GET /auth/:provider/callback with an unknown provider. The callback spends the
# login budget, then refuses a provider it does not implement with a 400.
test "GET /auth/:provider/callback rejects an unknown provider" {
	when {
		let result = http.get "http://localhost:3002/auth/gitlab/callback"
	}
	then {
		expect result.status 400
		expect result.json.message "Invalid provider"
	}
}

# GET /auth/callback — this server's own OAuth callback. With neither a code nor a
# state it cannot be a real callback, so it is refused with a 400 before any
# session lookup.
#
# seeded happy path: a genuine code and state matching a parked self-authorization
# request exchange for tokens and start a browser session.
test "GET /auth/callback rejects a request missing code and state" {
	when {
		let result = http.get "http://localhost:3002/auth/callback"
	}
	then {
		expect result.status 400
		expect result.json.message "Missing code or state parameter"
	}
}
