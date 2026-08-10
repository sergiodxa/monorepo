use fs
use cli

# The http capability's guard rails, specified without ever reaching the
# network. Both cases fail before any request goes out — one at the permission
# gate, one at URL validation — so the suite is CI-safe: no server, no sockets.
# The functional, connecting specs live under examples/http and run from
# src/http-example.test.ts against an in-process Bun.serve.
#
# These are meta-tests: each writes an inner one-file suite, runs the real
# `spec` CLI against it as a child, and asserts on the child's exit and output.

test "http.get without a net grant is denied and names the tool" {
	given {
		write "spec/http-denied.spec" """
			use http

			test "a request needs the net grant" {
				when {
					let response = http.get "http://example.com/"
				}
			}
		"""
	}
	when {
		# No --allow-net: the net family is denied outright, so the runtime's
		# central gate refuses http.get before the plugin runs.
		let result = run "spec" "run" "spec"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "Permission denied: net"
		output_contains result.stdout "http.get"
		output_contains result.stdout "--allow-net"
	}
}

test "a relative URL is a tool error pointing at the environments ADR" {
	given {
		write "spec/http-relative.spec" """
			use http

			test "a relative URL has no base to resolve against" {
				when {
					let response = http.get "api/books"
				}
			}
		"""
	}
	when {
		# The net family is granted (so the gate passes), but the URL is
		# relative, and v1 has no environments mechanism to bind a base URL
		# against — so the plugin rejects it before any fetch.
		let result = run "spec" "run" "spec" "--allow-net"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "tool-error"
		output_contains result.stdout "environments"
		output_contains result.stdout "ADR-008"
	}
}

test "the request-option tags parse and still honor the net gate" {
	given {
		write "spec/http-options.spec" """
			use http

			test "form and headers still need the net grant" {
				when {
					let response = http.post "http://example.com/oauth/token" form { grant_type: "client_credentials" } headers { authorization: "Basic dW51c2VkOnVudXNlZA==" }
				}
			}
		"""
	}
	when {
		# No --allow-net: the word-tagged form/headers arguments parse cleanly,
		# then the runtime's central gate denies the net family before the
		# request is ever built or sent.
		let result = run "spec" "run" "spec"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "Permission denied: net"
		output_contains result.stdout "http.post"
		output_contains result.stdout "--allow-net"
	}
}
