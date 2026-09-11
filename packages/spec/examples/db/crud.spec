use db

# The database capability against a real database. config.jsonc names the
# connections these specs select — "web" and "backend" — and holds the DSNs, so
# a spec never mentions a host, a port or a password. db-example.test.ts runs
# this suite against two temp-file SQLite databases.

# A command that seeds a known catalog, so a test can start from a clean,
# populated table without repeating the setup inline. Commands are suite-global.
command seed_catalog() {
	db.query "CREATE TABLE IF NOT EXISTS catalog (id INTEGER PRIMARY KEY, title TEXT)" on "web"
	db.query "DELETE FROM catalog" on "web"
	db.query "INSERT INTO catalog (title) VALUES ('Dune'), ('Solaris'), ('Neuromancer')" on "web"
}

test "CREATE TABLE returns no rows" {
	when {
		let result = db.query "CREATE TABLE IF NOT EXISTS ledger (id INTEGER PRIMARY KEY, entry TEXT)" on "web"
	}
	then {
		expect result.count 0
	}
}

test "an INSERT reports exactly one affected row" {
	given {
		db.query "CREATE TABLE IF NOT EXISTS ledger (id INTEGER PRIMARY KEY, entry TEXT)" on "web"
		db.query "DELETE FROM ledger" on "web"
	}
	when {
		let result = db.query "INSERT INTO ledger (entry) VALUES ('opening balance')" on "web"
	}
	then {
		# A mutation reports rows changed as affected_rows and returns no rows.
		expect result.affected_rows 1
		expect result.count 0
	}
}

test "a SELECT returns rows and a matching count" {
	given {
		seed_catalog
	}
	when {
		let result = db.query "SELECT title FROM catalog ORDER BY title" on "web"
	}
	then {
		# The whole catalog: three rows returned, so count and affected_rows agree.
		expect result.count 3
		expect result.affected_rows 3
	}
}

test "a row of a multi-row read is addressed by position" {
	given {
		seed_catalog
	}
	when {
		let result = db.query "SELECT title FROM catalog ORDER BY title" on "web"
	}
	then {
		# Numeric path segments index rows 0-based, which is how a spec reads a
		# result it deliberately expects to hold several rows.
		expect result.rows.0.title "Dune"
		expect result.rows.2.title "Solaris"
	}
}

test "a value binds to a placeholder rather than being pasted into the SQL" {
	given {
		seed_catalog
	}
	when {
		# One parameter is written as itself; the driver binds it to $1, so a
		# title carrying a quote would still be a title and not syntax.
		let result = db.query "SELECT id FROM catalog WHERE title = $1" params "Dune" on "web"
	}
	then {
		expect result.count 1
	}
}

test "several parameters bind in the order the array lists them" {
	given {
		seed_catalog
	}
	when {
		let result = db.query "SELECT title FROM catalog WHERE title = $1 OR title = $2" params [ "Dune", "Solaris" ] on "web"
	}
	then {
		expect result.count 2
	}
}

test "one returns the row itself" {
	given {
		seed_catalog
	}
	when {
		# `one` unwraps the single row and refuses any other count, so the
		# assumption behind a lookup by unique key is checked rather than
		# trusted, and the binding reads as the row it is.
		let book = db.query "SELECT id, title FROM catalog WHERE title = $1" params "Solaris" on "web" one
	}
	then {
		expect book.title "Solaris"
	}
}

test "the two connections are separate databases" {
	given {
		db.query "CREATE TABLE IF NOT EXISTS audit (note TEXT)" on "backend"
		db.query "DELETE FROM audit" on "backend"
		db.query "INSERT INTO audit (note) VALUES ('balance adjusted')" on "backend"
		seed_catalog
	}
	when {
		let noted = db.query "SELECT note FROM audit" on "backend" one
	}
	then {
		# The catalog the command seeded lives on "web"; this row lives on
		# "backend", and neither query can see the other's table.
		expect noted.note "balance adjusted"
	}
}
