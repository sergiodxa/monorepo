# GET /health — the dependency health report monitors poll. It answers
# `application/health+json` with `200` while D1, KV and the stored signing key all
# answer, whatever the third parties say, since GitHub, Polar and the breach lookup
# only warn. Reading the JWKS first mints the signing key on a fresh local bucket, so
# a migrated local database and a running Worker are the whole precondition.

test "GET /health reports every critical dependency answering" {
	given {
		let keys = http.get "http://localhost:3002/.well-known/jwks.json"
	}
	when {
		let result = http.get "http://localhost:3002/health"
	}
	then {
		expect result.status 200
		expect result.json.serviceId "auth"
	}
}
