use fs
use cli

# The database capability is specified here without ever touching a database.
# Every case below fails at the permission or configuration layer — before the
# plugin opens a connection — so the suite is CI-safe: no DATABASE_URL, no
# server, no SQLite file. The functional, connecting specs live under
# examples/db and run from src/db-example.test.ts against a temp SQLite file.
#
# These are meta-tests: each writes an inner one-file suite, runs the real
# `spec` CLI against it as a child, and asserts on the child's exit code and
# output. The inner queries use single-line SQL strings on purpose — a `"""`
# inside an outer `"""` would close the outer multiline string.

test "db.query without an env grant is denied and names the tool" {
	given {
		write "spec/db-denied.spec" """
			use db

			test "a query needs the env grant" {
				when {
					let result = db.query "SELECT 1"
				}
			}
		"""
	}
	when {
		# No --allow-env at all: the env family is denied outright, so the
		# runtime's central gate refuses db.query before the plugin runs.
		let result = run "spec" "run" "spec"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "Permission denied: env"
		output_contains result.stdout "db.query"
		output_contains result.stdout "--allow-env"
	}
}

test "db.query with an unrelated env grant still points at DATABASE_URL" {
	given {
		write "spec/db-scoped.spec" """
			use db

			test "the env grant names another variable" {
				when {
					let result = db.query "SELECT 1"
				}
			}
		"""
	}
	when {
		# The env family is granted, but scoped to a different variable, so the
		# coarse gate passes and the plugin's own checkEnv("DATABASE_URL") is
		# what refuses — naming the exact scoped flag the caller needs.
		let result = run "spec" "run" "spec" "--allow-env=OTHER_VAR"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "Permission denied: env"
		output_contains result.stdout "--allow-env=DATABASE_URL"
	}
}

test "db.query with DATABASE_URL granted but unset is a tool error" {
	given {
		write "spec/db-unset.spec" """
			use db

			test "an unset connection string is reported" {
				when {
					let result = db.query "SELECT 1"
				}
			}
		"""
	}
	when {
		# DATABASE_URL is granted, so the permission layer is satisfied, but the
		# variable is unset in the child (the outer run forwards no env), so the
		# plugin reports a configuration error naming DATABASE_URL — never
		# reaching a connection.
		let result = run "spec" "run" "spec" "--allow-env=DATABASE_URL"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "tool-error"
		output_contains result.stdout "DATABASE_URL"
	}
}
