# GET /healthcheck — the liveness probe. It reports "OK" only when both
# dependencies it cannot serve a request without are reachable: the D1 database
# and the KV namespace. A migrated local database and a running Worker are the
# whole precondition; without migrations it answers 500 "Database connection
# error" instead, which is why the suite README lists `db:local:migrate` as
# setup.

test "GET /healthcheck reports the server is live" {
	when {
		let result = http.get "http://localhost:3002/healthcheck"
	}
	then {
		expect result.status 200
		expect result.ok true
		expect result.text "OK"
	}
}
