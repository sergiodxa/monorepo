use fs
use cli

# The database capability is specified here without ever touching a database.
# Every case below fails at the permission or configuration layer — before the
# plugin opens a connection — so the suite is CI-safe: no server, no SQLite
# file, no DSN that resolves. The functional, connecting specs live under
# examples/db and run from src/db-example.test.ts against a temp SQLite file.
#
# These are meta-tests: each writes an inner project (a spec/config.jsonc plus
# a one-file suite), runs the real `spec` CLI against it as a child, and
# asserts on the child's exit code and output. The inner queries use
# single-line SQL strings on purpose — a `"""` inside an outer `"""` would
# close the outer multiline string.

test "db.query without a db grant is denied and names the tool" {
	given {
		write "spec/config.jsonc" """
			{
				"databases": {
					"web": { "default": "postgres://localhost/never-reached" }
				}
			}
		"""
		write "spec/db-denied.spec" """
			use db

			test "a query needs the db grant" {
				when {
					let result = db.query "SELECT 1"
				}
			}
		"""
	}
	when {
		# No --allow-db at all: the db family is denied outright, so the
		# runtime's central gate refuses db.query before the plugin runs.
		let result = run "spec" "run" "spec"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "Permission denied: db"
		output_contains result.stdout "db.query"
		output_contains result.stdout "--allow-db"
	}
}

test "a db grant scoped elsewhere names the connection the query selected" {
	given {
		write "spec/config.jsonc" """
			{
				"databases": {
					"web": { "default": "postgres://localhost/never-reached" },
					"backend": { "default": "postgres://localhost/never-reached" }
				}
			}
		"""
		write "spec/db-scoped.spec" """
			use db

			test "the grant names another connection" {
				when {
					let result = db.query "SELECT 1" on "backend"
				}
			}
		"""
	}
	when {
		# The family is granted, but scoped to a different connection, so the
		# coarse gate passes and the plugin's own checkDb("backend") is what
		# refuses — naming the exact scoped flag the caller needs.
		let result = run "spec" "run" "spec" "--allow-db=web"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "Permission denied: db"
		output_contains result.stdout "--allow-db=backend"
	}
}

test "a query selecting a connection nobody configured lists the ones that exist" {
	given {
		write "spec/config.jsonc" """
			{
				"databases": {
					"web": { "default": "postgres://localhost/never-reached" }
				}
			}
		"""
		write "spec/db-unknown.spec" """
			use db

			test "the name matches no connection" {
				when {
					let result = db.query "SELECT 1" on "ledger"
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec" "--allow-db"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "tool-error"
		output_contains result.stdout "ledger"
		output_contains result.stdout "web"
	}
}

test "several connections make an unnamed query ask which one" {
	given {
		write "spec/config.jsonc" """
			{
				"databases": {
					"web": { "default": "postgres://localhost/never-reached" },
					"backend": { "default": "postgres://localhost/never-reached" }
				}
			}
		"""
		write "spec/db-ambiguous.spec" """
			use db

			test "the query names no connection" {
				when {
					let result = db.query "SELECT 1"
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec" "--allow-db"
	}
	then {
		# Unnamed selection works for exactly one connection; two make the
		# choice the spec's to state, and the message shows both names.
		expect result.exit_code 1
		output_contains result.stdout "tool-error"
		output_contains result.stdout "backend"
	}
}

test "a run that configured no connection says where to declare one" {
	given {
		write "spec/db-unconfigured.spec" """
			use db

			test "nothing is configured" {
				when {
					let result = db.query "SELECT 1"
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec" "--allow-db"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "tool-error"
		output_contains result.stdout "spec/config.jsonc"
	}
}

test "db.run_file asks for the file grant as well as the database" {
	given {
		write "spec/config.jsonc" """
			{
				"databases": {
					"web": { "default": "postgres://localhost/never-reached" }
				}
			}
		"""
		write "spec/db-seed.spec" """
			use db

			test "a seed file needs the host filesystem too" {
				when {
					let result = db.run_file "db/seed.sql"
				}
			}
		"""
	}
	when {
		# The database is granted and the file is not, so the second check —
		# the one the plugin makes itself — is what refuses.
		let result = run "spec" "run" "spec" "--allow-db"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "Permission denied: host-fs"
		output_contains result.stdout "--allow-host-fs="
	}
}

test "db.run_file missing both grants names both flags at once" {
	given {
		write "spec/config.jsonc" """
			{
				"databases": {
					"web": { "default": "postgres://localhost/never-reached" },
					"backend": { "default": "postgres://localhost/never-reached" }
				}
			}
		"""
		write "spec/db-seed-both.spec" """
			use db

			test "neither grant is held" {
				when {
					let result = db.run_file "db/seed.sql" on "backend"
				}
			}
		"""
	}
	when {
		# Scoping the family to another connection lets the call past the
		# central gate and into the plugin, where both checks fail together —
		# so one denial carries both flags rather than one per attempt.
		let result = run "spec" "run" "spec" "--allow-db=web"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "--allow-db=backend"
		output_contains result.stdout "--allow-host-fs="
	}
}
