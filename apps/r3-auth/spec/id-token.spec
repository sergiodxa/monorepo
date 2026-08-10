# The OIDC id_token, proven end to end against the live server. The `refresh_token`
# grant needs no client credentials, so a seeded session (its id IS the refresh token)
# redeems at POST /oauth/token for a real token set — an access token and an id_token
# the server signs with its ES256 key. This is the flow the runtime CAN express fully:
# no authorization `code` has to be lifted out of a browser redirect.
#
# `jwt.verify` fetches the server's own JWKS at /.well-known/jwks.json and checks the
# id_token's signature against it; it returns the payload only when the signature is
# genuine, so a passing `expect` on the returned claims is proof the token is really
# issuer-signed, not merely well-formed. The complementary negatives — a tampered
# token, a wrong key, an expired token, a non-ES256 alg — are covered as unit tests in
# packages/spec/src/plugins/jwt.test.ts, where a forged token can be constructed.

test "the refresh_token grant returns a genuinely ES256-signed id_token" {
	given {
		seed_code_client
		seed_refresh_session
	}
	when {
		let tokens = http.post "http://localhost:3002/oauth/token" form {
			grant_type: "refresh_token"
			refresh_token: "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
		}
		# Verifies the signature against the live JWKS; returns the payload only if it is
		# genuinely signed by this server's key.
		let claims = jwt.verify tokens.json.id_token "http://localhost:3002/.well-known/jwks.json"
	}
	then {
		expect tokens.status 200
		expect tokens.json.token_type "Bearer"
		# iss is the scheme-less issuer, aud is the client the session belongs to, and sub
		# is the seeded subject — none trivially true, all read out of the verified payload.
		expect claims.iss "auth.sergiodxa.com"
		expect claims.aud "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
		expect claims.sub "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
	}
}

test "jwt.decode reads the id_token header and claims without verifying" {
	given {
		seed_code_client
		seed_refresh_session
	}
	when {
		let tokens = http.post "http://localhost:3002/oauth/token" form {
			grant_type: "refresh_token"
			refresh_token: "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
		}
		let decoded = jwt.decode tokens.json.id_token
	}
	then {
		expect decoded.header.alg "ES256"
		expect decoded.payload.sub "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
		expect decoded.payload.aud "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
	}
}
