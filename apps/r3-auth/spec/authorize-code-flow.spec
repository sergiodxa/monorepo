# The full browser authorization_code flow, end to end and proven live. This is the
# flow authorize-code.spec could only assert up to the redirect landing (see its note):
# capturing `browser.url` as a value is what now lets the fresh random `code` be lifted
# out of the landing URL and exchanged. A signed-in subject asks /authorize for the
# seeded client, the browser follows the SSO redirect onto the client's redirect_uri
# carrying a fresh `code` and the `state` it sent, the code is read out of that landing
# and exchanged at POST /oauth/token for a real token set, the id_token is verified
# against the server's live JWKS, and the access token is spent at /userinfo.
#
# The access token carries the scope the request granted — `openid email profile` — so
# /userinfo answers with the FULL claim set (email and profile), not the `sub`-only
# narrowing the refresh_token shortcut returns: a refresh-minted token is stamped
# `openid` alone, so userinfo.spec's refresh path can assert nothing past `sub`.
# Asserting the email and name claims here is what proves the granted-scope path, the
# one the machine-only refresh flow cannot reach.
#
# A captured `browser.url` is a binding, and a bare binding in a tool's argument
# position is a word, not a value (ADR-017), so the landing URL is boxed into an object
# and read back through a dotted reference before `url.query` parses it.
test "the authorization_code flow issues tokens whose access token returns full userinfo claims" {
	given {
		seed_code_client
		login "spec-user@spec.test" "correct horse battery"
	}
	when {
		browser.navigate "http://localhost:3002/authorize?response_type=code&client_id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa&redirect_uri=http://localhost:3002/healthcheck&state=spec-code-flow&scope=openid+email+profile"
		# The landing IS the redirect the authorization produced; the fresh `code` and the
		# echoed `state` are read straight out of it, once it is boxed for a dotted read.
		let landing = browser.url
		let at = { url: landing }
		let code = url.query at.url "code"
		let returnedState = url.query at.url "state"
		let tokens = http.post "http://localhost:3002/oauth/token" form {
			grant_type: "authorization_code"
			code: code
			redirect_uri: "http://localhost:3002/healthcheck"
		} basic "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" "spec-secret"
		# Verified against the live JWKS: the payload returns only if the id_token is
		# genuinely signed by this server's ES256 key, so the claims below are issuer
		# attested, not merely well formed.
		let claims = jwt.verify tokens.json.id_token "http://localhost:3002/.well-known/jwks.json"
		let who = http.get "http://localhost:3002/userinfo" bearer tokens.json.access_token
		# A code is single-use: findAuthorizationCodeData deletes it from KV as it reads it,
		# so the very same code offered a second time resolves to nothing and is refused
		# rather than minting a second token set.
		let replay = http.post "http://localhost:3002/oauth/token" form {
			grant_type: "authorization_code"
			code: code
			redirect_uri: "http://localhost:3002/healthcheck"
		} basic "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" "spec-secret"
	}
	then {
		# The CSRF round-trip: the exact state the request sent comes back on the redirect.
		expect returnedState "spec-code-flow"
		expect tokens.status 200
		expect tokens.json.access_token
		expect tokens.json.id_token
		# Read out of the JWKS-verified payload; none trivially true.
		expect claims.iss "auth.sergiodxa.com"
		expect claims.aud "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
		expect claims.sub
		expect who.status 200
		# The subject the access token speaks for is the subject the id_token names.
		expect who.json.sub claims.sub
		# The FULL claim set the granted `email`/`profile` scopes entitle — the proof this
		# token is not scope-narrowed the way the refresh shortcut's `openid`-only token is.
		# The email is the login address (stable); the profile claims are asserted by
		# presence, since another spec edits this account's display name and asserting an
		# exact value would couple the two suites. Their presence at all is the point: an
		# `openid`-only token (the refresh path) is answered with `sub` alone, no name, no
		# email — so these claims appearing is the granted-scope path being exercised.
		expect who.json.email "spec-user@spec.test"
		expect who.json.name
		expect who.json.preferred_username
		# The reused code is refused: single-use enforcement, an invalid_grant-class error.
		expect replay.status 400
		expect replay.json.error "invalid_grant"
	}
}

# RP-initiated logout (OpenID Connect RP-Initiated Logout 1.0), proven live. A signed-in
# browser asking GET /oidc/logout with a `post_logout_redirect_uri` ends the session and
# is sent onward to that address with `state` echoed back — but only because the address
# exactly equals a registered client's stored logout URI. seed_code_client registers
# /healthcheck as both the redirect and the logout URI, so the address resolves to that
# client and the redirect is honored; an unregistered address would be dropped and the
# browser kept on this server. Landing on /healthcheck (a plain 200 "OK") on the
# `/healthcheck` path carrying the echoed `state` is the proof the post-logout redirect
# fired rather than the sign-out confirmation page rendering.
test "RP-initiated logout redirects to the client's registered post-logout URI" {
	given {
		seed_code_client
		login "spec-user@spec.test" "correct horse battery"
	}
	when {
		browser.navigate "http://localhost:3002/oidc/logout?post_logout_redirect_uri=http://localhost:3002/healthcheck&state=spec-logout"
		# The logout answers with a 303 to the post-logout URI; a first read lets that
		# redirect land before the URL is captured, mirroring login.spec's settle reads.
		browser.url
		let afterLogout = browser.url
		let at = { url: afterLogout }
		let landedOn = url.path at.url
		let returnedState = url.query at.url "state"
	}
	then {
		# The path proves the browser left /oidc/logout for the client's address, and the
		# echoed state proves it was this logout's redirect that put it there.
		expect landedOn "/healthcheck"
		expect returnedState "spec-logout"
		eventually {
			expect browser.text "OK"
		}
	}
}

# An /authorize request the server cannot honor is answered by redirecting the error to
# the client's own redirect_uri — never leaked elsewhere — in the response mode asked for
# (`query` by default), per RFC 6749 §4.1.2.1. A code_challenge naming a method this
# server does not implement is such a request: the unsupported-method check sends
# `error=invalid_request` back to the seeded client's /healthcheck. Reading `error` and
# the echoed `state` out of the landing URL is the proof the redirect carried the OAuth
# error envelope. It runs unauthenticated: that check precedes the sign-in branch, so no
# login budget is spent.
test "an authorize request with an unsupported code_challenge_method redirects the error to the client" {
	given {
		seed_code_client
	}
	when {
		browser.navigate "http://localhost:3002/authorize?response_type=code&client_id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa&redirect_uri=http://localhost:3002/healthcheck&state=spec-error&code_challenge=abc123&code_challenge_method=BOGUS"
		# A first read lets the error redirect land before the URL is captured.
		browser.url
		let landing = browser.url
		let at = { url: landing }
		let landedOn = url.path at.url
		let returnedError = url.query at.url "error"
		let returnedState = url.query at.url "state"
	}
	then {
		expect landedOn "/healthcheck"
		expect returnedError "invalid_request"
		expect returnedState "spec-error"
		eventually {
			expect browser.text "OK"
		}
	}
}
