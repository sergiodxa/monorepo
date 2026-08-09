use db

# A fixture may drive the database and hand its result back to a test — the
# pattern for arranging shared data in one named place. This one resets a table
# and inserts a book, returning the query result so a test can assert on it.
# Fixtures are suite-global and run fresh on every invocation.
fixture db_inserted_book {
	db.query """
		CREATE TABLE IF NOT EXISTS books (id INTEGER PRIMARY KEY, title TEXT)
	"""
	db.query "DELETE FROM books"
	return db.query "INSERT INTO books (title) VALUES ('Dune')"
}

test "a fixture drives the database and returns its result" {
	when {
		let book = fixture db_inserted_book
	}
	then {
		expect book.affected_rows 1
	}
}

test "a fixture's effect is visible to a later query" {
	given {
		let inserted = fixture db_inserted_book
	}
	when {
		let result = db.query "SELECT title FROM books"
	}
	then {
		# The fixture cleared the table and inserted exactly one book.
		expect result.count 1
		expect inserted.affected_rows 1
	}
}
