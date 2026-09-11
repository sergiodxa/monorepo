use fs
use cli

test "a passing suite exits 0 and reports its counts" {
	given {
		write "spec/pass.spec" """
			use fs

			test "writes land in the workspace" {
				when {
					write "note.txt" "hello"
				}
				then {
					expect file "note.txt" exists
				}
			}

			test "values compare structurally" {
				then {
					expect 1 1
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec"
	}
	then {
		expect result.exit_code 0
		output_contains result.stdout "2 passed, 0 failed"
	}
}

test "a failing expectation exits 1 and names the failing test" {
	given {
		write "spec/fail.spec" """
			test "the ledger balances" {
				then {
					expect 1 2
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "✗ the ledger balances"
		output_contains result.stdout "0 passed, 1 failed"
	}
}

# The run header is printed before any result, so a failure is already anchored
# to the inputs that produced it: both flags below re-run this exact run.

test "the run header prints the seed and the run id as replay flags" {
	given {
		write "spec/trivial.spec" """
			test "holds" {
				then {
					expect 1 1
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec"
	}
	then {
		expect result.exit_code 0
		output_contains result.stdout "replay with --seed="
		output_contains result.stdout "replay with --run-id="
	}
}

# A skipped test never executes: the body below would fail if it did, so the
# exit code alone proves it was never run, and the reason reaches the report.

test "a skipped test never runs and is counted apart with its reason" {
	given {
		write "spec/skipped.spec" """
			skip "the staging database is down" test "waits for staging" {
				then {
					expect 1 2
				}
			}

			test "runs" {
				then {
					expect 1 1
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec"
	}
	then {
		expect result.exit_code 0
		output_contains result.stdout "1 passed, 0 failed, 1 skipped"
		output_contains result.stdout "the staging database is down"
	}
}

# A retry moves the attempt and nothing else, so a test can observe which
# attempt it is on. Passing only on the second is what `flaky` names, and a
# flaky test does not fail the run — while the summary still shows it.

test "a test that only passes on a retry is reported flaky, not failed" {
	given {
		write "spec/flaky.spec" """
			use spec

			test "settles on the second attempt" {
				then {
					expect spec.attempt 2
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec" "--retries=1"
	}
	then {
		expect result.exit_code 0
		output_contains result.stdout "1 flaky"
	}
}

# A suite whose setup could not arrange the world has nothing to test, so the
# failure is a load error at exit 2 rather than a test failure — and the test
# below, which would have passed, never runs.

test "a failing setup hook stops the run with a load error" {
	given {
		write "spec/setup-fails.spec" """
			setup {
				expect 1 2
			}

			test "never reached" {
				then {
					expect 1 1
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec"
	}
	then {
		expect result.exit_code 2
		output_contains result.stdout "setup"
	}
}

# A base that resolves to nothing is a configuration error, caught while the
# config loads: the run stops before any test, naming the variable to set.

test "a base that resolves to nothing fails the run before any test" {
	given {
		write "spec/config.jsonc" """
			{
				"bases": { "web": { "env": "SPEC_UNSET_BASE_FIXTURE" } }
			}
		"""
		write "spec/any.spec" """
			test "trivial" {
				then {
					expect 1 1
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec"
	}
	then {
		expect result.exit_code 2
		output_contains result.stdout "SPEC_UNSET_BASE_FIXTURE"
	}
}
