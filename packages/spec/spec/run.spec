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

# A suite arranges the world once, before any test: `setup` is where it creates
# the reference data every test reads. Each hook and each test runs in a
# workspace of its own, so what a test observes `setup` through is whatever
# outlives that workspace — a database row in a real suite, one host file here,
# which is why the inner run holds a host-fs grant this one does not.
#
# The second test is what pins "once": the first removes the marker, so a
# `setup` that re-ran per test would have put it back.

test "setup arranges the world once before any test, and does not repeat" {
	given {
		write "spec/setup-runs.spec" """
			use env
			use fs
			use str
			use spec

			# The marker is named after the run, so two suites arranging at the
			# same moment never write over each other.
			command lifecycle_marker {
				let dir = env.get "TMPDIR" "/tmp"
				return format "${0}/spec-setup-${1}.txt" dir spec.nonce
			}

			setup {
				let marker = lifecycle_marker
				write marker "arranged by setup"
			}

			test "the first test reads what setup arranged" {
				given {
					let marker = lifecycle_marker
				}
				when {
					let note = read marker
					remove marker
				}
				then {
					expect note "arranged by setup"
				}
			}

			test "the second test finds the marker still gone" {
				given {
					let marker = lifecycle_marker
				}
				then {
					expect not file marker exists
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec" "--allow-host-fs" "--allow-env=TMPDIR"
	}
	then {
		expect result.exit_code 0
		output_contains result.stdout "2 passed, 0 failed"
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

# `teardown` is where a suite removes the rows it left behind, so it has to run
# on the paths where there is something to remove — which are exactly the runs
# that failed. It also sees the world the tests left rather than the one `setup`
# made, and the assertion below names the pre-test value on purpose, so the
# report carries what teardown actually read.

test "teardown runs after a failing test and sees what that test left" {
	given {
		write "spec/teardown-runs.spec" """
			use env
			use fs
			use str
			use spec

			command lifecycle_marker {
				let dir = env.get "TMPDIR" "/tmp"
				return format "${0}/spec-teardown-${1}.txt" dir spec.nonce
			}

			setup {
				let marker = lifecycle_marker
				write marker "arranged by setup"
			}

			test "the test overwrites the marker and then fails" {
				given {
					let marker = lifecycle_marker
				}
				when {
					write marker "left by the failing test"
				}
				then {
					expect 1 2
				}
			}

			teardown {
				let marker = lifecycle_marker
				let note = read marker
				remove marker
				expect note "arranged by setup"
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec" "--allow-host-fs" "--allow-env=TMPDIR"
	}
	then {
		expect result.exit_code 1
		# The observed value is the test's, which only a teardown that ran after
		# that test could have read.
		output_contains result.stdout "left by the failing test"
		output_contains result.stdout "✗ teardown"
		output_contains result.stdout "0 passed, 2 failed"
	}
}

# A suite whose teardown failed may still be holding the rows it meant to drop,
# so a green suite is not a green run: the hook's failure is reported under its
# own name and counted beside the tests.

test "a failing teardown fails a run whose every test passed" {
	given {
		write "spec/teardown-fails.spec" """
			test "the ledger balances" {
				then {
					expect 1 1
				}
			}

			teardown {
				expect 1 2
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "✗ teardown"
		output_contains result.stdout "1 passed, 1 failed"
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
