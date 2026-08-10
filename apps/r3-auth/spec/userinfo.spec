# GET /userinfo — the OIDC UserInfo endpoint. It answers a bearer access token with the
# subject's claims. A bearer token IS presentable now, with `http.get … bearer …`, so all
# three observable paths are asserted directly: a token carrying the `openid` scope is
# answered with the subject it speaks for, and both refusal paths — no token, and a forged
# one. The RFC 6750 challenge is deliberately identical for a missing, malformed, expired
# or forged token so the endpoint is not an oracle.
#
# The claims (200) path rides the `refresh_token` grant: a seeded session (its id IS the
# refresh token) redeems at POST /oauth/token for an access token the grant now stamps with
# the `openid` scope /userinfo requires, so the bearer can be lifted straight from that
# response — no authorization `code` has to be extracted from a browser redirect. `sub` is
# the seeded subject, read out of the 200 body; it is not trivially true, since a token
# without `openid` (a `client_credentials` token) is refused here instead, which api.spec
# shows the other side of against GET /api/subjects/:id.

test "GET /userinfo answers a refresh-minted bearer token with the subject's claims" {
	given {
		seed_code_client
		seed_refresh_session
	}
	when {
		let tokens = http.post "http://localhost:3002/oauth/token" form {
			grant_type: "refresh_token"
			refresh_token: "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
		}
		# The refresh grant stamps `openid`, so this token is one /userinfo will serve; the
		# bearer is lifted straight from the token response.
		let result = http.get "http://localhost:3002/userinfo" bearer tokens.json.access_token
	}
	then {
		expect tokens.status 200
		expect result.status 200
		# The seeded subject the session belongs to, read out of the verified 200 body.
		expect result.json.sub "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
	}
}

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
