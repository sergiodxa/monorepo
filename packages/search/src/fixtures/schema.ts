/**
 * The storage guidance the README recommends, as the statements a migration holds, so the
 * Workers-pool test can apply it to a real D1 binding where the README cannot be read. The
 * threads-pool test fails if this and the README's `sql` block drift apart.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One statement per entry, each ending in `;`, exactly as the README's block lists them. */
export const POST_SEARCH_SCHEMA: readonly string[] = [
	`CREATE TABLE "post_search" (
	"id" INTEGER PRIMARY KEY,
	"post_id" TEXT NOT NULL UNIQUE,
	"title" TEXT NOT NULL,
	"tags" TEXT NOT NULL DEFAULT '',
	"excerpt" TEXT,
	"published_at" INTEGER
);`,
	`CREATE VIRTUAL TABLE "post_search_fts" USING fts5(
	"title", "tags", "excerpt",
	content='', contentless_delete=1,
	tokenize='unicode61 remove_diacritics 2'
);`,
	`CREATE TRIGGER "post_search_fts_insert" AFTER INSERT ON "post_search" BEGIN
	DELETE FROM "post_search_fts" WHERE "rowid" = new."id";
	INSERT INTO "post_search_fts" ("rowid", "title", "tags", "excerpt")
	VALUES (new."id", new."title", new."tags", new."excerpt");
END;`,
	`CREATE TRIGGER "post_search_fts_update" AFTER UPDATE OF "title", "tags", "excerpt" ON "post_search" BEGIN
	DELETE FROM "post_search_fts" WHERE "rowid" = old."id";
	INSERT INTO "post_search_fts" ("rowid", "title", "tags", "excerpt")
	VALUES (new."id", new."title", new."tags", new."excerpt");
END;`,
	`CREATE TRIGGER "post_search_fts_delete" AFTER DELETE ON "post_search" BEGIN
	DELETE FROM "post_search_fts" WHERE "rowid" = old."id";
END;`,
];
