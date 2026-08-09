use fs
use cli

# When several tests fail for the same missing permission, the report must
# accumulate them into ONE block that names the permission, how to grant it,
# and every affected test — never one repeated block per test. The `(N tests)`
# count and the `Affected tests:` section are unique to the grouped form, so
# asserting them proves the accumulation happened.

test "same-permission denials collapse into one grouped block" {
	given {
		write "spec/denials.spec" """
			test "first needs run" {
				when {
					let a = cli.run "echo" "one"
				}
			}

			test "second needs run" {
				when {
					let b = cli.run "echo" "two"
				}
			}

			test "third needs run" {
				when {
					let c = cli.run "echo" "three"
				}
			}
		"""
	}

	when {
		let result = run "spec" "run" "spec"
	}

	then {
		expect result.exit_code 1
		output_contains result.stdout "Permission denied: run (3 tests)"
		output_contains result.stdout "Affected tests:"
		output_contains result.stdout "first needs run"
		output_contains result.stdout "second needs run"
		output_contains result.stdout "third needs run"
		output_contains result.stdout "spec run --allow-run"
	}
}

# Grouping is keyed on the missing grant, not merely the permission family, so
# denials for different capabilities stay separate, actionable blocks — and a
# single-test group reads "1 test", not "1 tests".

test "denials for different permissions stay in separate groups" {
	given {
		write "spec/mixed.spec" """
			test "this one needs run" {
				when {
					let a = cli.run "echo" "x"
				}
			}

			test "this one needs net" {
				when {
					let b = http.get "http://example.com/"
				}
			}
		"""
	}

	when {
		let result = run "spec" "run" "spec"
	}

	then {
		expect result.exit_code 1
		output_contains result.stdout "Permission denied: run (1 test)"
		output_contains result.stdout "Permission denied: net (1 test)"
	}
}
