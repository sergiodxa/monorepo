-- Applied whole by `db.run_file`. Nothing splits this file on `;`, which is
-- what lets the third row's title carry one; a splitter would cut the file
-- there and leave the seed half applied.
CREATE TABLE IF NOT EXISTS books (id INTEGER PRIMARY KEY, title TEXT);

DELETE FROM books;

INSERT INTO books (title) VALUES ('Dune');
INSERT INTO books (title) VALUES ('Solaris');
INSERT INTO books (title) VALUES ('Fear and Trembling; Repetition');
