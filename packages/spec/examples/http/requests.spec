use http

# The http capability against a real server. src/http-example.test.ts starts an
# in-process HTTP server on 127.0.0.1 and grants exactly that host:port; the URLs
# below hardcode the same port because v1 has no environments mechanism to bind
# a base URL against, so a spec names the full absolute URL. The port here and
# the HTTP_EXAMPLE_PORT constant in http-example.test.ts must stay in lockstep.

test "a GET returns a 200 and its text body" {
	when {
		let response = http.get "http://127.0.0.1:50617/ping"
	}
	then {
		expect response.status 200
		expect response.ok true
		expect response.text "pong"
	}
}

test "a GET exposes a parsed JSON body" {
	when {
		let response = http.get "http://127.0.0.1:50617/info"
	}
	then {
		expect response.status 200
		# The response body is parsed into a value the spec drills into by field.
		expect response.json.service "spec-http-example"
		expect response.json.ok true
	}
}

test "a POST sends a JSON body the server echoes back" {
	when {
		# A non-string body is sent as JSON; the server parses and echoes it.
		let response = http.post "http://127.0.0.1:50617/echo" { title: "Dune", year: 1965 }
	}
	then {
		expect response.status 201
		expect response.json.title "Dune"
		expect response.json.year 1965
	}
}

test "a POST form body arrives urlencoded alongside an auth header" {
	when {
		# `form` encodes the object as application/x-www-form-urlencoded and
		# `headers` rides along on the same request; the server reflects both.
		let response = http.post "http://127.0.0.1:50617/reflect" form {
			grant_type: "client_credentials"
			scope: "read"
		} headers { authorization: "Basic dXNlcjpwYXNz" }
	}
	then {
		expect response.status 200
		expect response.json.content_type "application/x-www-form-urlencoded"
		expect response.json.authorization "Basic dXNlcjpwYXNz"
		expect response.json.body "grant_type=client_credentials&scope=read"
	}
}

test "a GET carries a bearer authorization header" {
	when {
		# Headers combine freely with a GET, which sends no body.
		let response = http.get "http://127.0.0.1:50617/reflect" headers {
			authorization: "Bearer token-123"
		}
	}
	then {
		expect response.status 200
		expect response.json.authorization "Bearer token-123"
	}
}

test "an explicit json tag sets application/json" {
	when {
		# `json` is the explicit form of the bare-object body.
		let response = http.post "http://127.0.0.1:50617/reflect" json { title: "Dune" }
	}
	then {
		expect response.json.content_type "application/json"
		expect response.json.body "{\"title\":\"Dune\"}"
	}
}
