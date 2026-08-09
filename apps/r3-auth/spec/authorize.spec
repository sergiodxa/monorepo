# form /authorize — the authorization endpoint. GET validates an authorization
# request and either issues a code for someone already signed in (SSO) or renders
# the sign-in page; POST completes a credential sign-in against the request parked
# in the session.

# GET with a well-formed request naming a client that is not registered: the query
# passes schema validation (a version-4 UUID client_id, a valid redirect URI, a
# state), so the handler spends the per-IP authorize budget and looks the client
# up — and answers a 404 rather than leaking, in an error page, whether that id
# exists. A different-shaped observable from the anonymous self-redirect a
# parameterless `/authorize` produces (that path is covered by home.spec's `/`).
test "GET /authorize refuses an unregistered client with a 404" {
	when {
		let result = http.get "http://localhost:3002/authorize?response_type=code&client_id=11111111-1111-4111-8111-111111111111&redirect_uri=https://client.example.com/callback&state=spec"
	}
	then {
		expect result.status 404
		expect result.json.message "Client not found"
	}
}

# POST with no parked authorization request in the session. A bodyless `http.post`
# carries no session cookie, so `getAuthz()` finds nothing and the sign-in is
# refused as "Invalid request" before any credential is read — the same 400 a
# malformed credential form would get. The credential happy path posts a real
# form and needs a parked request plus a registered client, so it goes through
# `browser`; see the README.
#
# seeded happy path: with a parked request and a valid credential form, POST
# signs the person in and answers the authorization request at the client's
# redirect URI.
test "POST /authorize refuses a sign-in with no parked authorization request" {
	when {
		let result = http.post "http://localhost:3002/authorize"
	}
	then {
		expect result.status 400
		expect result.json.message "Invalid request"
	}
}
