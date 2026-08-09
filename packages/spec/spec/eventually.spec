use fs
use cli

# The `eventually` retry block, specified through the real CLI. Each test writes
# an inner one-file suite, runs `spec` against it as a child, and asserts on the
# child's exit code and output. These cases are all deterministic: they cover
# an assertion already true, one that can never become true, and the two misuse
# forms. The passes-AFTER-retries timing case — an observable that flips from
# false to true partway through the window — is covered by the unit tests in
# src/expectation.test.ts, because a `.spec` cannot vary an observable over
# wall-clock time.

test "an already-true eventually passes on the first attempt" {
	given {
		write "spec/settled.spec" """
			test "a satisfied assertion needs no retries" {
				then {
					eventually {
						expect 1 1
					}
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

test "an eventually that never holds fails after its window and names the expectation" {
	given {
		write "spec/never.spec" """
			test "an impossible assertion exhausts the window" {
				then {
					# A tiny window keeps the run fast; the assertion can never
					# hold, so the last failure is reported when the window ends.
					eventually within 10ms {
						expect 1 2
					}
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "✗ an impossible assertion exhausts the window"
		# The reported failure is the expectation that never held.
		output_contains result.stdout "Expected 2, observed 1"
		output_contains result.stdout "0 passed, 1 failed"
	}
}

test "an action inside eventually is a runtime error" {
	given {
		write "spec/action.spec" """
			use fs

			test "a mutation cannot be retried as an assertion" {
				then {
					eventually {
						write "side-effect.txt" "no"
					}
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec"
	}
	then {
		# Only assertions may be retried; an action tool is refused at runtime,
		# failing the test rather than aborting the load.
		expect result.exit_code 1
		output_contains result.stdout "eventually"
		output_contains result.stdout "is not an observable"
	}
}

test "eventually outside a then block is a parse error" {
	given {
		write "spec/misplaced.spec" """
			test "eventually is a then-only construct" {
				when {
					eventually {
						expect 1 1
					}
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec"
	}
	then {
		# Parse errors are exit 2 — the misuse is rejected before any test runs.
		expect result.exit_code 2
		output_contains result.stdout "only valid directly inside a \"then\" block"
	}
}
