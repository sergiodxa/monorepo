# The OAuth 2.0 machine endpoints: token, revoke, introspect. Every success here
# needs credentials this runtime cannot present — `http` sends no HTTP Basic
# `Authorization` header, and no `application/x-www-form-urlencoded` body (a
# bodyless `http.post` reaches each controller with an empty FormData). So each
# test asserts the documented authentication/validation failure, which is the
# reachable black-box observable. All three paths are on the cop bypass list, and
# a header-less POST passes cross-origin protection anyway, so the request does
# reach the controller.

# POST /oauth/token with no body. The grant validator runs first and rejects an
# empty request body as `invalid_request` — before any client authentication or
# rate limiting.
#
# seeded happy path: a valid grant (authorization_code, refresh_token or
# client_credentials) with client credentials returns 200 and the token set.
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

# POST /oauth/revoke with no credentials. Client authentication is checked before
# anything else, so a request with no HTTP Basic header is refused as
# `invalid_client`.
#
# seeded happy path: an authenticated client always gets a 200 here, even for an
# unknown token — the endpoint must not become an oracle for which tokens are live.
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

# POST /oauth/introspect with no credentials. Same authentication gate as revoke.
#
# seeded happy path: an authenticated resource server gets 200 with `{ active }`;
# any token it cannot resolve collapses to `{ active: false }` rather than an error.
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
