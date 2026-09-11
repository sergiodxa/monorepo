use fs
use cli

# The browser capability's guard rails, specified without ever launching a
# browser. Every case here fails before any process spawns — at the permission
# gate, resolving the target, or reading the addressing vocabulary — so the
# suite is CI-safe: no browser, no server, no sockets. The functional cases
# drive a real browser from src/plugins/browser.test.ts, which skips itself
# when `agent-browser` is not installed.
#
# These are meta-tests: each writes an inner one-file suite, runs the real
# `spec` CLI against it as a child, and asserts on the child's exit and output.

test "browser.open without a net grant is denied and names the tool" {
	given {
		write "spec/browser-denied.spec" """
			use browser

			test "opening a page needs the net grant" {
				when {
					browser.open "http://example.com/"
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "Permission denied: net"
		output_contains result.stdout "browser.open"
		output_contains result.stdout "--allow-net"
	}
}

test "the request verbs are spelled with a dot, qualified and bare" {
	given {
		write "spec/browser-fetch-spelling.spec" """
			use browser

			test "browser.fetch.post resolves" {
				when {
					browser.fetch.post "http://example.com/seed"
				}
			}

			test "the bare fetch.post resolves too" {
				when {
					fetch.post "http://example.com/seed"
				}
			}
		"""
	}
	when {
		# Both names resolve, so both reach the permission gate and are denied
		# there. An unresolvable name would have failed as an unknown one.
		let result = run "spec" "run" "spec"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "browser.fetch.post"
		output_contains result.stdout "Permission denied: net"
	}
}

test "a tag name where a role belongs names the role that tag exposes" {
	given {
		write "spec/browser-tag-name.spec" """
			use browser

			test "the vocabulary addresses roles, not markup" {
				when {
					browser.fill textarea "Bio" with "hello"
				}
			}
		"""
	}
	when {
		# The net family is granted, so the gate passes and the plugin reads
		# the query — which refuses the tag name before any browser starts.
		let result = run "spec" "run" "spec" "--allow-net"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "tool-error"
		output_contains result.stdout "addresses roles, not tag names"
		output_contains result.stdout "textbox"
	}
}

test "an ordinal and a count cannot be written together" {
	given {
		write "spec/browser-count-ordinal.spec" """
			use browser

			test "count takes a set, an ordinal takes one of it" {
				then {
					expect browser.link "Profile" first count 2
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
		output_contains result.stdout "drop the ordinal"
	}
}

test "an action addresses an element, it does not assert about one" {
	given {
		write "spec/browser-action-predicate.spec" """
			use browser

			test "a predicate asks a question a click has no answer for" {
				when {
					browser.click button "Save" enabled
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
		output_contains result.stdout "browser.element"
	}
}

test "a relative target with no base configured names the config" {
	given {
		write "spec/browser-no-base.spec" """
			use browser

			test "a relative target needs a base to resolve against" {
				when {
					browser.open "/charities"
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
		output_contains result.stdout "spec/config.jsonc"
	}
}

test "an assertion inside a write is refused, a write asserting nothing" {
	given {
		write "spec/browser-write-predicate.spec" """
			use browser

			test "a fill addresses a control, it does not question it" {
				when {
					browser.fill textbox "Email" enabled with "ada@example.com"
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
		output_contains result.stdout "takes no `enabled` predicate"
		output_contains result.stdout "browser.element"
	}
}

test "choosing in a dropdown is spelled with the word every write uses" {
	given {
		write "spec/browser-select-with.spec" """
			use browser

			test "select takes the option after `with`" {
				when {
					browser.select combobox "Country" "Uruguay"
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
		output_contains result.stdout "browser.select"
		output_contains result.stdout "`with`"
	}
}
