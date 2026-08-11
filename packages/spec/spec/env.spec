use fs
use cli

# The environment capability, specified end to end. Reading a variable is the
# privileged act, so most cases below fail at the permission layer — before the
# plugin touches `process.env`. The passing cases need one real variable, so
# this file's own run is granted `--allow-env=SPEC_ENV_FIXTURE` (see
# src/dogfood.test.ts) and `cli.run` forwards exactly that variable, and no
# other, into each inner `spec` child.
#
# These are meta-tests: each writes an inner one-file suite, runs the real
# `spec` CLI against it as a child, and asserts on the child's exit and output.

test "env.get without an env grant is denied and names the tool" {
	given {
		write "spec/env-denied.spec" """
			use env

			test "reading a variable needs the env grant" {
				when {
					let token = env.get "SPEC_ENV_FIXTURE"
				}
			}
		"""
	}
	when {
		# No --allow-env at all: the family is denied outright, so the runtime's
		# central gate refuses env.get before the plugin reads anything.
		let result = run "spec" "run" "spec"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "Permission denied: env"
		output_contains result.stdout "env.get"
		output_contains result.stdout "--allow-env"
	}
}

test "env.get with a grant for another variable names the one it wanted" {
	given {
		write "spec/env-scoped.spec" """
			use env

			test "the env grant names another variable" {
				when {
					let token = env.get "SPEC_ENV_FIXTURE"
				}
			}
		"""
	}
	when {
		# The family is granted but scoped elsewhere, so the coarse gate passes
		# and the plugin's own checkEnv is what refuses — naming the exact flag.
		let result = run "spec" "run" "spec" "--allow-env=OTHER_VAR"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "Permission denied: env"
		output_contains result.stdout "SPEC_ENV_FIXTURE"
		output_contains result.stdout "--allow-env=SPEC_ENV_FIXTURE"
	}
}

test "a granted variable reads as a value" {
	given {
		write "spec/env-read.spec" """
			use env

			test "the granted variable holds the fixture value" {
				when {
					let token = env.get "SPEC_ENV_FIXTURE"
				}
				then {
					expect token "fixture-value"
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec" "--allow-env=SPEC_ENV_FIXTURE"
	}
	then {
		expect result.exit_code 0
		output_contains result.stdout "1 passed, 0 failed"
	}
}

test "an unset variable with a fallback reads as the fallback" {
	given {
		write "spec/env-fallback.spec" """
			use env

			test "the fallback stands in for the unset variable" {
				when {
					let base = env.get "SPEC_ENV_ABSENT" "http://localhost:3000"
				}
				then {
					expect base "http://localhost:3000"
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec" "--allow-env=SPEC_ENV_ABSENT"
	}
	then {
		expect result.exit_code 0
		output_contains result.stdout "1 passed, 0 failed"
	}
}

test "an unset variable without a fallback fails and names the variable" {
	given {
		write "spec/env-missing.spec" """
			use env

			test "nothing stands in for the unset variable" {
				when {
					let token = env.get "SPEC_ENV_ABSENT"
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec" "--allow-env=SPEC_ENV_ABSENT"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "SPEC_ENV_ABSENT"
		output_contains result.stdout "is not set"
	}
}
