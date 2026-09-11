use fs
use cli

# The http capability's guard rails, specified without ever reaching the
# network. Every case fails before any request goes out — at the permission
# gate, or resolving the target — so the suite is CI-safe: no server, no sockets.
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

test "a target with no leading slash is a tool error suggesting one" {
	given {
		write "spec/http-relative.spec" """
			use http

			test "a target is absolute or starts with a slash" {
				when {
					let response = http.get "api/books"
				}
			}
		"""
	}
	when {
		# The net family is granted (so the gate passes), but the target is
		# neither absolute nor rooted, so it names no base-relative path —
		# the plugin rejects it before any fetch.
		let result = run "spec" "run" "spec" "--allow-net"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "tool-error"
		output_contains result.stdout "/api/books"
	}
}

test "a base-relative target with no base configured names the config" {
	given {
		write "spec/http-no-base.spec" """
			use http

			test "a relative target needs a base to resolve against" {
				when {
					let response = http.get "/portfolios"
				}
			}
		"""
	}
	when {
		# This suite declares no bases, so the only relative target it could
		# resolve is one whose base the config names.
		let result = run "spec" "run" "spec" "--allow-net"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "tool-error"
		output_contains result.stdout "No base is configured"
		output_contains result.stdout "spec/config.jsonc"
	}
}

test "`on` names a base that must exist" {
	given {
		write "spec/http-unknown-base.spec" """
			use http

			test "the named base has to be configured" {
				when {
					let response = http.get "/portfolios" on "work"
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec" "--allow-net"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "tool-error"
		output_contains result.stdout "No base named"
		output_contains result.stdout "is configured"
	}
}

# The whole point of resolving before the grant check: the host a denial names
# is the host the request would have reached, so the suggested grant is one
# copy-paste away from a passing run.

test "a denial names the host the base resolved to, not the path written" {
	given {
		write "spec/config.jsonc" """
			{
				"bases": {
					"web": { "default": "http://localhost:4000" },
					"work": { "default": "http://work.localhost:4020" }
				}
			}
		"""
		write "spec/http-on-base.spec" """
			use http

			test "on selects which base the path resolves against" {
				when {
					let response = http.get "/dashboard" on "work"
				}
			}
		"""
	}
	when {
		# The net family is granted for one host only, and the request resolves
		# to another, so the scoped check refuses it and names the resolved host.
		let result = run "spec" "run" "spec" "--allow-net=localhost"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "Permission denied: net"
		output_contains result.stdout "work.localhost"
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
