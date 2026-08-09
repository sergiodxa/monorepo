# GET /userinfo — the OIDC UserInfo endpoint. It answers a bearer access token
# with the subject's claims. The claims (happy) path is out of reach of this
# runtime: the `http` capability sends no custom headers, so it cannot present
# an `Authorization: Bearer …`. What is fully specifiable is the challenge a
# request with no bearer token gets — a 401 with the RFC 6750 error envelope,
# deliberately identical for a missing, malformed, expired or forged token so it
# is not an oracle.
#
# seeded happy path: with a valid bearer access token this returns 200 and the
# scope-gated claims (`sub` always; `email`/`email_verified` with the email
# scope; `name`/`preferred_username`/`picture` with the profile scope). Not
# assertable here because `http` cannot send an Authorization header.

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
