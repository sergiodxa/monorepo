# The public discovery surface: the two `.well-known` metadata documents and
# the JWKS. All three are unauthenticated, need no seeded state, and publish a
# frozen contract relying parties configure themselves from — so the endpoint
# URLs they advertise are constants (built against the production issuer host),
# not whatever host served the request. The metadata document is identical at
# both paths (OIDC Discovery and RFC 8414 Authorization Server Metadata), so
# both tests assert the same fields.
#
# Array-valued fields (`scopes_supported`, `grant_types_supported`,
# `response_types_supported`) are asserted for presence only: the `.spec`
# language has no array literal and no index path, so the value cannot be
# written out or drilled into — a present, non-empty array is all that is
# expressible.

test "GET /.well-known/openid-configuration publishes the OIDC discovery document" {
	when {
		let result = http.get "http://localhost:3002/.well-known/openid-configuration"
	}
	then {
		expect result.status 200
		expect result.json.issuer "auth.sergiodxa.com"
		expect result.json.authorization_endpoint "https://auth.sergiodxa.com/authorize"
		expect result.json.token_endpoint "https://auth.sergiodxa.com/oauth/token"
		expect result.json.userinfo_endpoint "https://auth.sergiodxa.com/userinfo"
		expect result.json.jwks_uri "https://auth.sergiodxa.com/.well-known/jwks.json"
		expect result.json.revocation_endpoint "https://auth.sergiodxa.com/oauth/revoke"
		expect result.json.introspection_endpoint "https://auth.sergiodxa.com/oauth/introspect"
		expect result.json.end_session_endpoint "https://auth.sergiodxa.com/oidc/logout"
		expect result.json.check_session_iframe "https://auth.sergiodxa.com/oidc/check-session"
		expect result.json.scopes_supported
		expect result.json.grant_types_supported
		expect result.json.response_types_supported
	}
}

test "GET /.well-known/oauth-authorization-server serves the same metadata under RFC 8414" {
	when {
		let result = http.get "http://localhost:3002/.well-known/oauth-authorization-server"
	}
	then {
		expect result.status 200
		expect result.json.issuer "auth.sergiodxa.com"
		expect result.json.authorization_endpoint "https://auth.sergiodxa.com/authorize"
		expect result.json.token_endpoint "https://auth.sergiodxa.com/oauth/token"
		expect result.json.userinfo_endpoint "https://auth.sergiodxa.com/userinfo"
		expect result.json.jwks_uri "https://auth.sergiodxa.com/.well-known/jwks.json"
		expect result.json.revocation_endpoint "https://auth.sergiodxa.com/oauth/revoke"
		expect result.json.introspection_endpoint "https://auth.sergiodxa.com/oauth/introspect"
		expect result.json.end_session_endpoint "https://auth.sergiodxa.com/oidc/logout"
		expect result.json.check_session_iframe "https://auth.sergiodxa.com/oidc/check-session"
		expect result.json.scopes_supported
		expect result.json.grant_types_supported
		expect result.json.response_types_supported
	}
}

test "GET /.well-known/jwks.json publishes the public signing keys" {
	when {
		# The key pair auto-generates in R2 on the first request, so this endpoint
		# self-seeds and needs no key setup. `keys` is an array, so it is presence-
		# checked; the language cannot index into it to read a key's fields.
		let result = http.get "http://localhost:3002/.well-known/jwks.json"
	}
	then {
		expect result.status 200
		expect result.json.keys
	}
}
