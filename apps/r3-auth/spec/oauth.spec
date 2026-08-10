# The OAuth 2.0 machine endpoints: token, revoke, introspect. Each is specified on both
# sides — the credentialed success and the documented failure. `http` presents client
# credentials with the `basic` shortcut (HTTP Basic, RFC 7617, which introspect and
# revoke require) and request parameters with a `form` body
# (application/x-www-form-urlencoded), so the happy paths are reachable, not just the
# rejections. The negatives remain: an empty or unauthenticated request must still
# answer with the exact OAuth error envelope. All three paths are on the cop bypass
# list, so a POST reaches the controller.

# POST /oauth/token, the `client_credentials` grant with `client_secret_basic`. The
# seeded confidential client authenticates on its secret alone (no PKCE), and the token
# response carries the access token, its type, and its lifetime.
test "POST /oauth/token issues a client-credentials access token for a valid client" {
	given {
		seed_code_client
	}
	when {
		let result = http.post "http://localhost:3002/oauth/token" form {
			grant_type: "client_credentials"
		} basic "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" "spec-secret"
	}
	then {
		expect result.status 200
		expect result.json.token_type "Bearer"
		expect result.json.access_token
	}
}

# The same grant with a wrong secret. Client authentication fails, so the engine answers
# the `invalid_client` envelope rather than issuing a token.
test "POST /oauth/token rejects a client-credentials request with a wrong secret" {
	given {
		seed_code_client
	}
	when {
		let result = http.post "http://localhost:3002/oauth/token" form {
			grant_type: "client_credentials"
		} basic "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" "wrong-secret"
	}
	then {
		expect result.status 400
		expect result.json.error "invalid_client"
	}
}

# POST /oauth/token with no body. The grant validator runs first and rejects an empty
# request body as `invalid_request` — before any client authentication or rate limiting.
test "POST /oauth/token rejects an empty request body as invalid_request" {
	when {
		let result = http.post "http://localhost:3002/oauth/token"
	}
	then {
		expect result.status 400
		expect result.json.error "invalid_request"
		expect result.json.error_description "Invalid request body"
	}
}

# POST /oauth/introspect with client_secret_basic and a live refresh token (a seeded
# session id). The endpoint reports the token active and returns its subject and client.
test "POST /oauth/introspect reports a live token as active" {
	given {
		seed_code_client
		seed_refresh_session
	}
	when {
		let result = http.post "http://localhost:3002/oauth/introspect" basic "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" "spec-secret" form {
			token: "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
		}
	}
	then {
		expect result.status 200
		expect result.json.active true
		expect result.json.sub "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
		expect result.json.client_id "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
	}
}

# A token the server cannot resolve collapses to `{ active: false }` rather than an
# error, so introspection never becomes an oracle for which tokens are live.
test "POST /oauth/introspect reports an unknown token as inactive" {
	given {
		seed_code_client
	}
	when {
		let result = http.post "http://localhost:3002/oauth/introspect" form {
			token: "not-a-real-token"
		} basic "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" "spec-secret"
	}
	then {
		expect result.status 200
		expect result.json.active false
	}
}

# POST /oauth/introspect with no credentials. Client authentication is checked first, so
# a request with no HTTP Basic header is refused as `invalid_client`.
test "POST /oauth/introspect refuses a request with no client credentials" {
	when {
		let result = http.post "http://localhost:3002/oauth/introspect"
	}
	then {
		expect result.status 401
		expect result.json.error "invalid_client"
		expect result.json.error_description "Missing or invalid client credentials"
	}
}

# POST /oauth/revoke with client_secret_basic, deleting the session a refresh token
# names; the endpoint answers 200 with no body. The proof it did something is the follow
# up: the revoked token then introspects inactive.
test "POST /oauth/revoke invalidates a refresh token, which then introspects inactive" {
	given {
		seed_code_client
		seed_refresh_session
	}
	when {
		let revoked = http.post "http://localhost:3002/oauth/revoke" form {
			token: "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
		} basic "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" "spec-secret"
		let after = http.post "http://localhost:3002/oauth/introspect" form {
			token: "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
		} basic "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" "spec-secret"
	}
	then {
		expect revoked.status 200
		expect after.status 200
		expect after.json.active false
	}
}

# POST /oauth/revoke with no credentials. Same authentication gate as introspect: a
# request with no HTTP Basic header is refused as `invalid_client`.
test "POST /oauth/revoke refuses a request with no client credentials" {
	when {
		let result = http.post "http://localhost:3002/oauth/revoke"
	}
	then {
		expect result.status 401
		expect result.json.error "invalid_client"
		expect result.json.error_description "Missing or invalid client credentials"
	}
}
