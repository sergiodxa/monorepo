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
