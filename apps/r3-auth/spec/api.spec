# GET /api/subjects/:subjectId — the machine-to-machine subject lookup, behind a
# client-credentials bearer token. Every observable path is specified: a successful
# lookup of a subject who authorized the calling client, the 404 a missing subject and
# a subject who never authorized that client both get, and the guard's refusal of an
# unauthenticated request.
#
# The token is minted through the `client_credentials` grant with `client_secret_basic`
# — the only token whose audience is this server itself, which is what the guard
# accepts. A refusal is a bare 401 `{ error: "Unauthorized" }` that says nothing about
# which check failed, since every legitimate caller is a machine holding a working
# credential.

test "a client-credentials bearer token reads a subject who authorized that client" {
	given {
		seed_code_client
		seed_refresh_session
		seed_subject_grant
	}
	when {
		let cc = http.post "http://localhost:3002/oauth/token" form {
			grant_type: "client_credentials"
		} basic "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" "spec-secret"
		let result = http.get "http://localhost:3002/api/subjects/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" bearer cc.json.access_token
	}
	then {
		expect result.status 200
		expect result.json.subject.id "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
		expect result.json.subject.emailAddress "spec-refresh@spec.test"
		expect result.json.subject.username "spec-refresh"
	}
}

# The same subject, looked up by a different registered client the subject never
# authorized. It answers exactly like a subject that does not exist, so a client cannot
# read — or even confirm — the profile of someone who never signed in to it.
test "a client-credentials token gets a 404 for a subject who never authorized that client" {
	given {
		seed_code_client
		seed_other_client
		seed_refresh_session
		seed_subject_grant
	}
	when {
		let cc = http.post "http://localhost:3002/oauth/token" form {
			grant_type: "client_credentials"
		} basic "dddddddd-dddd-4ddd-8ddd-dddddddddddd" "other-secret"
		let result = http.get "http://localhost:3002/api/subjects/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" bearer cc.json.access_token
	}
	then {
		expect result.status 404
		expect result.json.error "Subject not found"
	}
}

test "a client-credentials token gets a 404 for a subject that does not exist" {
	given {
		seed_code_client
	}
	when {
		let cc = http.post "http://localhost:3002/oauth/token" form {
			grant_type: "client_credentials"
		} basic "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" "spec-secret"
		let result = http.get "http://localhost:3002/api/subjects/00000000-0000-0000-0000-000000000000" bearer cc.json.access_token
	}
	then {
		expect result.status 404
		expect result.json.error "Subject not found"
	}
}

test "GET /api/subjects/:subjectId refuses an unauthenticated request" {
	when {
		let result = http.get "http://localhost:3002/api/subjects/00000000-0000-0000-0000-000000000000"
	}
	then {
		expect result.status 401
		expect result.json.error "Unauthorized"
	}
}
