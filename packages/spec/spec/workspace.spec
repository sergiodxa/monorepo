use fs
use cli

test "every test gets a fresh workspace" {
	given {
		write "spec/isolation.spec" """
			use fs

			test "the first test leaves a file behind" {
				when {
					write "leak.txt" "residue"
				}
				then {
					expect file "leak.txt" exists
				}
			}

			test "the second test never sees it" {
				when {
					let leftover = exists "leak.txt"
				}
				then {
					expect leftover false
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

test "a write escaping the workspace is refused" {
	given {
		write "spec/escape.spec" """
			use fs

			test "a traversal write is refused" {
				when {
					write "../escape.txt" "contraband"
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "workspace-escape"
		output_contains result.stdout "../escape.txt"
	}
}
