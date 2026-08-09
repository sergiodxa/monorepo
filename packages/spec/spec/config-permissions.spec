# Specifies spec/config.jsonc's `permissions` key and the declare + opt-in
# model. A suite declares the grants it needs in config; the declaration is
# inert until the caller passes --allow-config, so a cloned repo can never
# self-grant. Each case writes an inner project (a spec/config.jsonc plus a
# .spec) and runs the real `spec` CLI against it as a child, asserting on the
# child's exit code and output. Only the `run` family is exercised, so no
# network or database is touched.

use fs
use cli

test "a config-declared permission is inert without --allow-config" {
	given {
		write "spec/config.jsonc" """
			{
				"permissions": { "allow": ["run"] }
			}
		"""
		write "spec/needs-run.spec" """
			use cli

			test "runs echo" {
				when {
					let result = run "echo" "hi"
				}
				then {
					expect result.exit_code 0
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec"
	}
	then {
		# Declared but not opted into: still denied, and the denial points at the
		# one-flag path that would apply the project's declaration.
		expect result.exit_code 1
		output_contains result.stdout "Permission denied: run"
		output_contains result.stdout "--allow-config"
	}
}

test "--allow-config applies the config's declared permission" {
	given {
		write "spec/config.jsonc" """
			{
				"permissions": { "allow": ["run"] }
			}
		"""
		write "spec/needs-run.spec" """
			use cli

			test "runs echo" {
				when {
					let result = run "echo" "hi"
				}
				then {
					expect result.exit_code 0
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec" "--allow-config"
	}
	then {
		expect result.exit_code 0
		output_contains result.stdout "1 passed, 0 failed"
	}
}

test "a scoped config tuple admits its executable and denies others" {
	given {
		write "spec/config.jsonc" """
			{
				"permissions": { "allow": [["run", "echo"]] }
			}
		"""
		write "spec/scoped.spec" """
			use cli

			test "echo is admitted by the scoped grant" {
				when {
					let ok = run "echo" "ok"
				}
				then {
					expect ok.exit_code 0
				}
			}

			test "a different executable stays denied" {
				when {
					let blocked = run "node"
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec" "--allow-config"
	}
	then {
		# The scope is honored end to end: echo runs, node is refused with its
		# own flag remedy, and no config hint (the config does not grant node).
		expect result.exit_code 1
		output_contains result.stdout "1 passed, 1 failed"
		output_contains result.stdout "--allow-run=node"
	}
}

test "a CLI --allow-* flag unions with the config's grants" {
	given {
		write "spec/config.jsonc" """
			{
				"permissions": { "allow": [["run", "echo"]] }
			}
		"""
		write "spec/union.spec" """
			use cli

			test "echo comes from the config grant" {
				when {
					let a = run "echo" "one"
				}
				then {
					expect a.exit_code 0
				}
			}

			test "pwd comes from the CLI flag" {
				when {
					let b = run "pwd"
				}
				then {
					expect b.exit_code 0
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec" "--allow-config" "--allow-run=pwd"
	}
	then {
		# Both grants apply together: echo (config) and pwd (CLI flag) each run.
		expect result.exit_code 0
		output_contains result.stdout "2 passed, 0 failed"
	}
}

test "a malformed permissions entry is a load error naming it" {
	given {
		write "spec/config.jsonc" """
			{
				"permissions": { "allow": ["bogus"] }
			}
		"""
		write "spec/any.spec" """
			test "trivial" {
				then {
					expect true
				}
			}
		"""
	}
	when {
		# Validated eagerly, so a broken config fails the run even without opting
		# in — a malformed declaration is never silently ignored.
		let result = run "spec" "run" "spec"
	}
	then {
		expect result.exit_code 2
		output_contains result.stdout "bogus"
	}
}
