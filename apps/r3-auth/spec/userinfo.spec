# GET /userinfo — the OIDC UserInfo endpoint. It answers a bearer access token with the
# subject's claims. A bearer token IS presentable now, with `http.get … bearer …`, so
# both refusal paths are asserted directly: a request with no token and a request
# carrying a forged one. The RFC 6750 challenge is deliberately identical for a missing,
# malformed, expired or forged token so the endpoint is not an oracle.
#
# The claims (200) path is not asserted here. userinfo returns only the claims the
# access token's granted scope covers, and the sole grant that stamps a `scope` onto its
# access token is `authorization_code`; a spec cannot drive that grant to completion,
# because the runtime cannot bind `browser.url` to lift the redirect's `code`. The
# bearer-carrying success path is instead proven in api.spec, where a client-credentials
# bearer against GET /api/subjects/:id returns 200.

test "GET /userinfo refuses a request that carries no bearer token" {
	when {
		let result = http.get "http://localhost:3002/userinfo"
	}
	then {
		expect result.status 401
		expect result.json.error "invalid_token"
		expect result.json.error_description "Missing or invalid access token"
	}
}

test "GET /userinfo refuses a request carrying a forged bearer token" {
	when {
		let result = http.get "http://localhost:3002/userinfo" bearer "not-a-real-token"
	}
	then {
		expect result.status 401
		expect result.json.error "invalid_token"
		expect result.json.error_description "Invalid or expired access token"
	}
}
