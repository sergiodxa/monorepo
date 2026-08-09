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
