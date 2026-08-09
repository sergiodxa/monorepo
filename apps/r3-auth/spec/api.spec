# GET /api/subjects/:subjectId — the machine-to-machine subject lookup, behind a
# client-credentials bearer token. The 200 (happy) path is out of reach of this
# runtime: `http` sends no `Authorization` header, so it cannot present a token.
# The reachable observable is the guard's refusal — a bare 401 `{ error:
# "Unauthorized" }` that says nothing about which check failed, since every
# legitimate caller is a machine holding a working credential. The guard fires
# before the lookup, so the all-zero placeholder id never has to exist.
#
# seeded happy path: a valid client-credentials token returns `{ subject }` for an
# existing id, or a 404 `{ error }` for a missing one.

test "GET /api/subjects/:subjectId refuses an unauthenticated request" {
	when {
		let result = http.get "http://localhost:3002/api/subjects/00000000-0000-0000-0000-000000000000"
	}
	then {
		expect result.status 401
		expect result.json.error "Unauthorized"
	}
}
