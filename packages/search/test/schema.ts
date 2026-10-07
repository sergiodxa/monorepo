/**
 * The storage guidance the README recommends, as the statements a migration holds, so the
 * Workers-pool test can apply it to a real D1 binding where the README cannot be read. The
 * threads-pool test fails if this and the README's `sql` block drift apart.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One statement per entry, each ending in `;`, exactly as the README's block lists them. */
export const ARTICLES_SCHEMA: readonly string[] = [
	`CREATE TABLE "articles" (
	"id" INTEGER PRIMARY KEY,
	"slug" TEXT NOT NULL UNIQUE,
	"title" TEXT NOT NULL,
	"tags" TEXT NOT NULL DEFAULT '',
	"summary" TEXT,
	"published_at" INTEGER
);`,
	`CREATE VIRTUAL TABLE "articles_fts" USING fts5(
	"title", "tags", "summary",
	content='', contentless_delete=1,
	tokenize='unicode61 remove_diacritics 2'
);`,
	`CREATE TRIGGER "articles_fts_insert" AFTER INSERT ON "articles" BEGIN
	DELETE FROM "articles_fts" WHERE "rowid" = new."id";
	INSERT INTO "articles_fts" ("rowid", "title", "tags", "summary")
	VALUES (new."id", new."title", new."tags", new."summary");
END;`,
	`CREATE TRIGGER "articles_fts_update" AFTER UPDATE OF "title", "tags", "summary" ON "articles" BEGIN
	DELETE FROM "articles_fts" WHERE "rowid" = old."id";
	INSERT INTO "articles_fts" ("rowid", "title", "tags", "summary")
	VALUES (new."id", new."title", new."tags", new."summary");
END;`,
	`CREATE TRIGGER "articles_fts_delete" AFTER DELETE ON "articles" BEGIN
	DELETE FROM "articles_fts" WHERE "rowid" = old."id";
END;`,
];
