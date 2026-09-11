use db

# Arranging shared data in one named place: a command drives the database and
# hands its result back, and a whole SQL file is applied in one call. Commands
# are suite-global and run fresh on every invocation, so each test that calls
# one starts from the state that command establishes rather than from whatever
# the test before it left behind.

# Resets a table and inserts a book, returning the insert's result so a caller
# can assert on it. A command returns whatever its `return` names.
command insert_book(title) {
	db.query "CREATE TABLE IF NOT EXISTS shelf (id INTEGER PRIMARY KEY, title TEXT)" on "web"
	db.query "DELETE FROM shelf" on "web"
	return db.query "INSERT INTO shelf (title) VALUES ($1)" params title on "web"
}

# Applies the suite's seed file to the database. The path resolves against the
# directory `spec run` was invoked from, and reaching it needs --allow-host-fs
# on top of the --allow-db every query already needs.
command seed_books() {
	db.run_file "examples/db/seed.sql" on "web"
}

test "a command drives the database and returns its result" {
	when {
		let book = insert_book "Dune"
	}
	then {
		expect book.affected_rows 1
	}
}

test "a command's effect is visible to a later query" {
	given {
		let inserted = insert_book "Solaris"
	}
	when {
		let result = db.query "SELECT title FROM shelf" on "web"
	}
	then {
		# The command cleared the table and inserted exactly one book.
		expect result.count 1
		expect inserted.affected_rows 1
	}
}

test "a command runs again on every call, so a value wanted twice is bound once" {
	given {
		let first = insert_book "Neuromancer"
		let second = insert_book "Solaris"
	}
	when {
		let result = db.query "SELECT title FROM shelf" on "web" one
	}
	then {
		# Two calls, two resets: the shelf holds only what the second one left.
		expect first.affected_rows 1
		expect second.affected_rows 1
		expect result.title "Solaris"
	}
}

test "a seed file lands whole" {
	given {
		seed_books
	}
	when {
		let result = db.query "SELECT title FROM books ORDER BY id" on "web"
	}
	then {
		# All three inserts arrived, the last of them carrying a semicolon
		# inside its title.
		expect result.count 3
		expect result.rows.2.title "Fear and Trembling; Repetition"
	}
}
