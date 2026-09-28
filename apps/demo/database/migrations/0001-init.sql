CREATE TABLE postings (
	id text PRIMARY KEY NOT NULL,
	created_at integer NOT NULL,
	updated_at integer NOT NULL,
	expired_at integer,
	title text NOT NULL,
	company text NOT NULL,
	location text NOT NULL,
	salary text NOT NULL,
	description text NOT NULL,
	contact_email text NOT NULL
);

CREATE INDEX postings_open_newest ON postings (expired_at, created_at DESC);
