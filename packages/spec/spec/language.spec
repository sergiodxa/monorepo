use fs
use cli

test "comments are inert" {
	given {
		write "spec/comments.spec" """
			# comments before, inside, and after a test never execute
			test "a commented suite still runs" {
				then {
					# the hash inside the string below is content, not a comment
					expect "a # b" "a # b"
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec"
	}
	then {
		expect result.exit_code 0
		output_contains result.stdout "1 passed, 0 failed"
	}
}

test "phases run strictly in given, when, then order" {
	given {
		write "spec/order.spec" """
			test "then cannot precede given" {
				then {
					expect true
				}
				given {
					let late = 1
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec"
	}
	then {
		expect result.exit_code 2
		output_contains result.stdout "phases run in given, when, then order"
	}
}

test "duplicate definitions are load errors naming both files" {
	given {
		write "spec/a.spec" """
			command greet {
				return "hello"
			}
		"""
		write "spec/b.spec" """
			command greet {
				return "hello again"
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec"
	}
	then {
		expect result.exit_code 2
		output_contains result.stdout "Duplicate definition \"greet\""
		output_contains result.stdout "spec/a.spec"
		output_contains result.stdout "spec/b.spec"
	}
}

test "an ambiguous unqualified name reports both candidates" {
	given {
		write "spec/ambiguous.spec" """
			use fs

			command read {
				return "shadowed"
			}

			test "a name with two candidates is refused" {
				when {
					let content = read "notes.txt"
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "the command \"read\" and fs.read"
	}
}

test "the removed fixture notation fails naming its replacement" {
	given {
		write "spec/legacy.spec" """
			fixture user {
				return { name: "sergio" }
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec"
	}
	then {
		expect result.exit_code 2
		output_contains result.stdout "\"fixture\" was removed"
		output_contains result.stdout "command user"
	}
}

test "expect reads containment and inverts with not" {
	given {
		let page = "<meta property=\"og:title\" content=\"Spec\">"
		let rows = [ { id: 1, title: "Dune" }, { id: 2, title: "Emma" } ]
	}
	then {
		# `contains` is a substring over a string...
		expect page contains "og:title"
		# ...and membership over an array, under the same structural equality
		# the two-argument form uses.
		expect rows contains { id: 2, title: "Emma" }
		# A digit path segment indexes an array, 0-based.
		expect rows.0.title "Dune"
		# `not` heads an expect and inverts whichever form follows it.
		expect not page contains "twitter:card"
		expect not rows contains { id: 3, title: "Woolf" }
		expect not page "something else"
		expect not false
	}
}
