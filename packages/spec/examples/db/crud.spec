use db

# The database capability against a real database. DATABASE_URL points these
# specs at their database (db-example.test.ts runs them against a temp-file
# SQLite database); the specs never name a location — they name db.query and
# assert on its results, so the same spec runs anywhere DATABASE_URL points.

# A command that seeds a known catalog, so a test can start from a clean,
# populated table without repeating the setup inline. Commands are suite-global.
command seed_db_catalog() {
	db.query """
		CREATE TABLE IF NOT EXISTS catalog (id INTEGER PRIMARY KEY, title TEXT)
	"""
	db.query "DELETE FROM catalog"
	db.query """
		INSERT INTO catalog (title) VALUES ('Dune'), ('Solaris'), ('Neuromancer')
	"""
}

test "CREATE TABLE returns no rows" {
	when {
		let result = db.query """
			CREATE TABLE IF NOT EXISTS ledger (id INTEGER PRIMARY KEY, entry TEXT)
		"""
	}
	then {
		expect result.count 0
	}
}

test "an INSERT reports exactly one affected row" {
	given {
		db.query """
			CREATE TABLE IF NOT EXISTS ledger (id INTEGER PRIMARY KEY, entry TEXT)
		"""
		db.query "DELETE FROM ledger"
	}
	when {
		let result = db.query "INSERT INTO ledger (entry) VALUES ('opening balance')"
	}
	then {
		# A mutation reports rows changed as affected_rows and returns no rows.
		expect result.affected_rows 1
		expect result.count 0
	}
}

test "a SELECT returns rows and a matching count" {
	given {
		seed_db_catalog
	}
	when {
		let result = db.query "SELECT title FROM catalog ORDER BY title"
	}
	then {
		# The whole catalog: three rows returned, so count and affected_rows agree.
		expect result.count 3
		expect result.affected_rows 3
	}
}

test "a filtered SELECT counts exactly the matching rows" {
	given {
		seed_db_catalog
	}
	when {
		let result = db.query "SELECT id FROM catalog WHERE title = 'Dune'"
	}
	then {
		# Exactly one catalog entry is titled Dune — a content assertion via count.
		expect result.count 1
	}
}
