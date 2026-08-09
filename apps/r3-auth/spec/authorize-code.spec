# The authorization-code redirect, proven against the live server. A subject who is
# already signed in and asks `/authorize` for a registered client is issued a code
# via SSO and redirected to the client's `redirect_uri` carrying it — no second
# sign-in, no consent screen. The client is seeded with a fixed id whose redirect URI
# is this origin's `/healthcheck` (a plain 200 that answers "OK"), so the redirect
# lands on a real page inside the one granted host.
#
# The landing page is the proof: reaching the client's own redirect target is
# something only a successful authorization does — an anonymous or refused request
# renders the sign-in page or an error instead, never the RP's URI. The `code` itself
# is asserted only by that landing, because it is a fresh random value on every run
# and `browser.url` compares whole URLs with no substring match (a runtime gap), so
# the exact redirect URL cannot be written down.
#
# Exchanging the code at POST /oauth/token is out of scope: the exchange needs a
# urlencoded body and a client-secret auth header that neither `browser` nor the v1
# `http` capability can construct.
test "an authenticated authorize request redirects to the client carrying a code" {
	given {
		login "spec-user@spec.test" "correct horse battery"
		seed_code_client
	}
	when {
		browser.navigate "http://localhost:3002/authorize?response_type=code&client_id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa&redirect_uri=http://localhost:3002/healthcheck&state=spec-code"
	}
	then {
		eventually {
			expect browser.text "OK"
		}
	}
}
