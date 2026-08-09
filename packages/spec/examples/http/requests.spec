use http

# The http capability against a real server. src/http-example.test.ts starts an
# in-process Bun.serve on 127.0.0.1 and grants exactly that host:port; the URLs
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
