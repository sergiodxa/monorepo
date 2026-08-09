use fs
use cli

test "an ungranted process run is denied and names the flag" {
	given {
		write "spec/denied.spec" """
			use cli

			test "running a program needs a grant" {
				when {
					let result = run "echo" "hello"
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "Permission denied: run"
		output_contains result.stdout "--allow-run"
	}
}

test "a scoped grant admits exactly its executable" {
	given {
		write "spec/granted.spec" """
			use cli

			test "a granted executable runs" {
				when {
					let result = run "echo" "granted"
				}
				then {
					expect result.exit_code 0
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec" "--allow-run=echo"
	}
	then {
		expect result.exit_code 0
		output_contains result.stdout "1 passed, 0 failed"
	}
}

test "a grant for a different executable still denies" {
	given {
		write "spec/mismatch.spec" """
			use cli

			test "the grant names another program" {
				when {
					let result = run "echo" "blocked"
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec" "--allow-run=node"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "Permission denied: run"
		output_contains result.stdout "--allow-run=echo"
	}
}
