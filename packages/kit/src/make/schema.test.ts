/**
 * The SQL a model's tables need: `createTableStatement`'s rendering, and `planMigration`'s diff
 * against a replayed chain, from a new table through `ADD COLUMN` to rebuilds that keep every
 * row, plus the refusals that keep a migration from deleting data on D1.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DatabaseSync } from "node:sqlite";

import type { Result } from "@sdxc/result";

import { isFailure, unwrap } from "@sdxc/result";
import { column as c, table } from "remix/data-table";
import { describe, expect, test } from "vite-plus/test";

import type { MigrationSource, SchemaChange } from "./schema-diff.js";

import { planMigration } from "./schema-diff.js";
import { createTableStatement, tableShape } from "./schema.js";

/** A `posts` table as a first model declares it. */
const POSTS = table({
	name: "posts",
	columns: {
		id: c.text().primaryKey(),
		title: c.text(),
		body: c.text().nullable(),
		views: c.integer().default(0),
		created_at: c.integer(),
	},
});

/** The chain that created {@link POSTS}, written as a person would. */
const CREATE_POSTS: MigrationSource = {
	name: "0001_CreatePosts.sql",
	sql: `CREATE TABLE "posts" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "views" INTEGER NOT NULL DEFAULT 0,
  "created_at" INTEGER NOT NULL
);`,
};

/** The plan for `tables` against `migrations`. */
function plan(migrations: MigrationSource[], ...tables: unknown[]) {
	let shapes = tables.map(tableShape).filter((shape) => shape !== null);
	expect(shapes).toHaveLength(tables.length);
	return planMigration(migrations, shapes);
}

/** The SQL of a plan that must find something to change. */
function sqlOf(result: Result<SchemaChange, Error>): string {
	let change = unwrap(result);
	expect(change.statements).not.toEqual([]);
	return change.statements.join("\n\n");
}

/** A database built from `migrations`, with `seed` run after them. */
function database(migrations: MigrationSource[], seed = ""): DatabaseSync {
	let db = new DatabaseSync(":memory:", { enableDoubleQuotedStringLiterals: false });
	for (let migration of migrations) db.exec(migration.sql);
	if (seed !== "") db.exec(seed);
	return db;
}

describe("createTableStatement", () => {
	test("writes every column NOT NULL unless nullable, keys and constraints by name", () => {
		let comments = table({
			name: "comments",
			columns: {
				id: c.integer().primaryKey().autoIncrement(),
				post_id: c.text().references("posts", "id", "fk_comments_post").onDelete("cascade"),
				slug: c.varchar(80).unique(),
				email: c.text().unique("comments_email"),
				approved: c.boolean().default(false),
				rating: c.integer().nullable().check("rating BETWEEN 1 AND 5", "ck_rating"),
				note: c.text().default("it's"),
				posted_at: c.timestamp().defaultNow(),
				score: c.decimal(5, 2).defaultSql("0.5 * 2"),
				data: c.json().nullable(),
				file: c.binary().nullable(),
			},
		});

		expect(createTableStatement(comments)).toBe(`CREATE TABLE "comments" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  "post_id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "approved" INTEGER NOT NULL DEFAULT 0,
  "rating" INTEGER,
  "note" TEXT NOT NULL DEFAULT 'it''s',
  "posted_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "score" NUMERIC NOT NULL DEFAULT (0.5 * 2),
  "data" TEXT,
  "file" BLOB,
  CONSTRAINT "fk_comments_post" FOREIGN KEY ("post_id") REFERENCES "posts" ("id") ON DELETE CASCADE,
  CONSTRAINT "ck_rating" CHECK (rating BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX "comments_slug_unique" ON "comments" ("slug");

CREATE UNIQUE INDEX "comments_email" ON "comments" ("email");`);
	});

	test("declares a composite primary key as a table constraint", () => {
		let tags = table({
			name: "post_tags",
			primaryKey: ["post_id", "tag"],
			columns: { post_id: c.text(), tag: c.text() },
		});

		expect(createTableStatement(tags)).toBe(`CREATE TABLE "post_tags" (
  "post_id" TEXT NOT NULL,
  "tag" TEXT NOT NULL,
  PRIMARY KEY ("post_id", "tag")
);`);
	});
});

describe("planMigration", () => {
	test("creates a table no migration has created", () => {
		expect(sqlOf(plan([], POSTS))).toBe(createTableStatement(POSTS));
	});

	test("finds nothing to change when the chain already matches the model", () => {
		expect(unwrap(plan([CREATE_POSTS], POSTS))).toEqual({ statements: [], warnings: [] });
	});

	test("reads types by affinity, so VARCHAR, BOOLEAN and DATETIME columns match", () => {
		let chain: MigrationSource = {
			name: "0001_Init.sql",
			sql: `CREATE TABLE "users" ("id" VARCHAR(36) PRIMARY KEY, "admin" BOOLEAN NOT NULL DEFAULT false, "seen" DATETIME, "n" INT NOT NULL DEFAULT 1.0);`,
		};
		let users = table({
			name: "users",
			columns: {
				id: c.uuid().primaryKey(),
				admin: c.boolean().default(false),
				seen: c.timestamp().nullable(),
				n: c.integer().default(1),
			},
		});

		expect(unwrap(plan([chain], users)).statements).toEqual([]);
	});

	test("adds a nullable column and a defaulted NOT NULL column with ALTER TABLE", () => {
		let posts = table({
			name: "posts",
			columns: {
				id: c.text().primaryKey(),
				title: c.text(),
				body: c.text().nullable(),
				views: c.integer().default(0),
				created_at: c.integer(),
				subtitle: c.text().nullable(),
				pinned: c.boolean().default(false),
			},
		});

		expect(sqlOf(plan([CREATE_POSTS], posts))).toBe(
			`ALTER TABLE "posts" ADD COLUMN "subtitle" TEXT;\n\nALTER TABLE "posts" ADD COLUMN "pinned" INTEGER NOT NULL DEFAULT 0;`,
		);
	});

	test("adds a unique column as a column plus a unique index", () => {
		let posts = table({
			name: "posts",
			columns: {
				id: c.text().primaryKey(),
				title: c.text(),
				body: c.text().nullable(),
				views: c.integer().default(0),
				created_at: c.integer(),
				slug: c.text().nullable().unique(),
			},
		});

		expect(sqlOf(plan([CREATE_POSTS], posts))).toBe(
			`ALTER TABLE "posts" ADD COLUMN "slug" TEXT;\n\nCREATE UNIQUE INDEX "posts_slug_unique" ON "posts" ("slug");`,
		);
	});

	test("never adds a column an earlier migration of the chain already added", () => {
		let addSubtitle: MigrationSource = {
			name: "0002_AddSubtitle.sql",
			sql: `ALTER TABLE "posts" ADD COLUMN "subtitle" TEXT;`,
		};
		let posts = table({
			name: "posts",
			columns: {
				id: c.text().primaryKey(),
				title: c.text(),
				body: c.text().nullable(),
				views: c.integer().default(0),
				created_at: c.integer(),
				subtitle: c.text().nullable(),
			},
		});

		expect(unwrap(plan([CREATE_POSTS, addSubtitle], posts)).statements).toEqual([]);
	});

	test("replays the chain in order of its leading number", () => {
		let later: MigrationSource = {
			name: "0010_AddSubtitle.sql",
			sql: `ALTER TABLE "posts" ADD COLUMN "subtitle" TEXT;`,
		};
		let posts = table({
			name: "posts",
			columns: {
				id: c.text().primaryKey(),
				title: c.text(),
				body: c.text().nullable(),
				views: c.integer().default(0),
				created_at: c.integer(),
				subtitle: c.text().nullable(),
			},
		});

		expect(unwrap(plan([later, CREATE_POSTS], posts)).statements).toEqual([]);
	});

	test("drops a column nothing indexes with DROP COLUMN, warning its data goes", () => {
		let posts = table({
			name: "posts",
			columns: {
				id: c.text().primaryKey(),
				title: c.text(),
				views: c.integer().default(0),
				created_at: c.integer(),
			},
		});

		let change = unwrap(plan([CREATE_POSTS], posts));

		expect(change.statements).toEqual([`ALTER TABLE "posts" DROP COLUMN "body";`]);
		expect(change.warnings).toEqual([
			"posts.body is not in the model: the migration drops it and deletes its data",
		]);
	});

	test("treats a rename as a drop and an add, and says so", () => {
		let posts = table({
			name: "posts",
			columns: {
				id: c.text().primaryKey(),
				title: c.text(),
				content: c.text().nullable(),
				views: c.integer().default(0),
				created_at: c.integer(),
			},
		});

		let change = unwrap(plan([CREATE_POSTS], posts));

		expect(change.statements).toEqual([
			`ALTER TABLE "posts" ADD COLUMN "content" TEXT;`,
			`ALTER TABLE "posts" DROP COLUMN "body";`,
		]);
		expect(change.warnings).toContain(
			"posts drops body and adds content: if that is a rename, sdxc cannot tell, so the data in body is deleted; copy it in the migration before the drop",
		);
	});

	test("rebuilds a table whose column changes type, keeping every row", () => {
		let chain: MigrationSource[] = [
			{
				name: "0001_CreatePosts.sql",
				sql: `CREATE TABLE "posts" ("id" TEXT PRIMARY KEY NOT NULL, "title" TEXT NOT NULL, "views" TEXT NOT NULL);
CREATE INDEX "posts_title" ON "posts" ("title");`,
			},
		];
		let posts = table({
			name: "posts",
			columns: { id: c.text().primaryKey(), title: c.text(), views: c.integer() },
		});

		let sql = sqlOf(plan(chain, posts));
		let db = database(
			chain,
			`INSERT INTO "posts" VALUES ('a', 'First', '12'), ('b', 'Second', '7');`,
		);
		db.exec(sql);

		expect(sql).toBe(`CREATE TABLE "__sdxc_new_posts" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "title" TEXT NOT NULL,
  "views" INTEGER NOT NULL
);

INSERT INTO "__sdxc_new_posts" ("id", "title", "views") SELECT "id", "title", "views" FROM "posts";

DROP TABLE "posts";

ALTER TABLE "__sdxc_new_posts" RENAME TO "posts";

CREATE INDEX "posts_title" ON "posts" ("title");`);
		expect(
			db.prepare(`SELECT id, title, views, typeof(views) AS kind FROM posts ORDER BY id`).all(),
		).toEqual([
			{ id: "a", title: "First", views: 12, kind: "integer" },
			{ id: "b", title: "Second", views: 7, kind: "integer" },
		]);
	});

	test("copies rows through the old column names when a rebuild also drops and adds columns", () => {
		let chain: MigrationSource[] = [
			{
				name: "0001_CreatePosts.sql",
				sql: `CREATE TABLE "posts" ("id" TEXT PRIMARY KEY NOT NULL, "legacy" TEXT, "title" TEXT, "score" TEXT);`,
			},
		];
		let posts = table({
			name: "posts",
			columns: {
				id: c.text().primaryKey(),
				title: c.text().default("Untitled"),
				score: c.integer().nullable(),
				status: c.text().default("draft"),
			},
		});

		let change = unwrap(plan(chain, posts));
		let db = database(
			chain,
			`INSERT INTO "posts" VALUES ('a', 'x', NULL, '3'), ('b', 'y', 'Hello', NULL);`,
		);
		db.exec(change.statements.join("\n"));

		expect(change.statements[1]).toBe(
			`INSERT INTO "__sdxc_new_posts" ("id", "title", "score") SELECT "id", COALESCE("title", 'Untitled'), "score" FROM "posts";`,
		);
		expect(change.warnings).toContain(
			"posts.legacy is not in the model: the migration drops it and deletes its data",
		);
		expect(db.prepare(`SELECT * FROM posts ORDER BY id`).all()).toEqual([
			{ id: "a", title: "Untitled", score: 3, status: "draft" },
			{ id: "b", title: "Hello", score: null, status: "draft" },
		]);
	});

	test("rebuilds for a NOT NULL column without a default and warns that rows block it", () => {
		let posts = table({
			name: "posts",
			columns: {
				id: c.text().primaryKey(),
				title: c.text(),
				body: c.text().nullable(),
				views: c.integer().default(0),
				created_at: c.integer(),
				author_id: c.text(),
			},
		});

		let change = unwrap(plan([CREATE_POSTS], posts));

		expect(change.statements[0]).toContain(`CREATE TABLE "__sdxc_new_posts"`);
		expect(change.warnings).toContain(
			"posts.author_id is NOT NULL with no default: the rebuild fails on a table with rows; give it a default or fill it in the INSERT",
		);
	});

	test("rebuilds for a new primary key and keeps indexes and unique constraints the model lacks", () => {
		let chain: MigrationSource[] = [
			{
				name: "0001_Init.sql",
				sql: `CREATE TABLE "tags" ("id" INTEGER PRIMARY KEY, "post_id" TEXT NOT NULL, "name" TEXT NOT NULL UNIQUE);
CREATE INDEX "tags_post" ON "tags" ("post_id", "name");
CREATE TRIGGER "tags_trim" AFTER INSERT ON "tags" BEGIN UPDATE "tags" SET "name" = trim("name") WHERE "id" = NEW."id"; END;`,
			},
		];
		let tags = table({
			name: "tags",
			primaryKey: ["post_id", "name"],
			columns: { id: c.integer(), post_id: c.text(), name: c.text() },
		});

		let change = unwrap(plan(chain, tags));
		let sql = change.statements.join("\n\n");
		let db = database(chain, `INSERT INTO "tags" VALUES (1, 'p', 'a');`);
		db.exec(sql);

		expect(sql).toContain(`CREATE INDEX "tags_post" ON "tags" ("post_id", "name");`);
		expect(sql).toContain(`CREATE UNIQUE INDEX "tags_name_unique" ON "tags" ("name");`);
		expect(sql).toContain(`CREATE TRIGGER "tags_trim"`);
		expect(change.warnings).toContain(
			"tags.name is unique in the database but not in the model: sdxc keeps it; drop it by hand if that is intended",
		);
		expect(db.prepare(`SELECT * FROM tags`).all()).toEqual([{ id: 1, post_id: "p", name: "a" }]);
	});

	test("keeps a unique index the model does not declare instead of dropping it", () => {
		let chain: MigrationSource[] = [
			CREATE_POSTS,
			{
				name: "0002_UniqueTitle.sql",
				sql: `CREATE UNIQUE INDEX "posts_title" ON "posts" ("title");`,
			},
		];

		expect(unwrap(plan(chain, POSTS))).toEqual({
			statements: [],
			warnings: [
				"posts.title is unique in the database but not in the model: sdxc keeps it; drop it by hand if that is intended",
			],
		});
	});

	test("wraps a rebuild of a table referenced with NO ACTION in deferred foreign keys", () => {
		let chain: MigrationSource[] = [
			CREATE_POSTS,
			{
				name: "0002_Comments.sql",
				sql: `CREATE TABLE "comments" ("id" TEXT PRIMARY KEY NOT NULL, "post_id" TEXT NOT NULL REFERENCES "posts" ("id"));`,
			},
		];
		let posts = table({
			name: "posts",
			columns: {
				id: c.text().primaryKey(),
				title: c.text(),
				body: c.text().nullable(),
				views: c.text().default("0"),
				created_at: c.integer(),
			},
		});

		let change = unwrap(plan(chain, posts));

		expect(change.statements[0]).toBe("PRAGMA defer_foreign_keys = on;");
		expect(change.statements.at(-1)).toBe("PRAGMA defer_foreign_keys = off;");
	});

	test("refuses to rebuild a table another table references with ON DELETE CASCADE", () => {
		let chain: MigrationSource[] = [
			CREATE_POSTS,
			{
				name: "0002_Comments.sql",
				sql: `CREATE TABLE "comments" ("id" TEXT PRIMARY KEY NOT NULL, "post_id" TEXT NOT NULL REFERENCES "posts" ("id") ON DELETE CASCADE);`,
			},
		];
		let posts = table({
			name: "posts",
			columns: {
				id: c.text().primaryKey(),
				title: c.text(),
				body: c.text().nullable(),
				views: c.text().default("0"),
				created_at: c.integer(),
			},
		});

		let result = plan(chain, posts);

		expect(isFailure(result) && result.error.message).toBe(
			"posts needs a rebuild (posts.views changes type), and dropping it on D1 fires comments.post_id ON DELETE CASCADE on the rows that reference it; write this migration by hand",
		);
	});

	test("rebuilds to add a foreign key, which SQLite cannot add to a column in place", () => {
		let comments = table({
			name: "comments",
			columns: {
				id: c.text().primaryKey(),
				post_id: c.text().references("posts", "id", "fk_comments_post"),
			},
		});
		let chain: MigrationSource[] = [
			CREATE_POSTS,
			{
				name: "0002_Comments.sql",
				sql: `CREATE TABLE "comments" ("id" TEXT PRIMARY KEY NOT NULL, "post_id" TEXT NOT NULL);`,
			},
		];

		let sql = sqlOf(plan(chain, comments));

		expect(sql).toContain(
			`CONSTRAINT "fk_comments_post" FOREIGN KEY ("post_id") REFERENCES "posts" ("id")`,
		);
		expect(sql).toContain(`DROP TABLE "comments";`);
	});

	test("adds a nullable foreign key column in place", () => {
		let comments = table({
			name: "comments",
			columns: {
				id: c.text().primaryKey(),
				post_id: c
					.text()
					.nullable()
					.references("posts", "id", "fk_comments_post")
					.onDelete("set null"),
			},
		});
		let chain: MigrationSource[] = [
			CREATE_POSTS,
			{
				name: "0002_Comments.sql",
				sql: `CREATE TABLE "comments" ("id" TEXT PRIMARY KEY NOT NULL);`,
			},
		];

		expect(sqlOf(plan(chain, comments))).toBe(
			`ALTER TABLE "comments" ADD COLUMN "post_id" TEXT CONSTRAINT "fk_comments_post" REFERENCES "posts" ("id") ON DELETE SET NULL;`,
		);
	});

	test("rebuilds when a default changes, since SQLite cannot alter one, and says why", () => {
		let posts = table({
			name: "posts",
			columns: {
				id: c.text().primaryKey(),
				title: c.text(),
				body: c.text().nullable(),
				views: c.integer().default(1),
				created_at: c.integer(),
			},
		});

		let result = plan([CREATE_POSTS], posts);

		expect(sqlOf(result)).toContain(`"views" INTEGER NOT NULL DEFAULT 1`);
		expect(unwrap(result).warnings).toEqual([
			"posts is rebuilt (create, copy, drop, rename) because posts.views changes its default from 0 to 1",
		]);
	});

	test("warns that a rebuild drops the unnamed checks a model cannot declare", () => {
		let chain: MigrationSource[] = [
			{
				name: "0001_CreatePosts.sql",
				sql: `CREATE TABLE "posts" ("id" TEXT PRIMARY KEY NOT NULL, "views" TEXT NOT NULL CHECK (length("views") > 0));`,
			},
		];
		let posts = table({
			name: "posts",
			columns: { id: c.text().primaryKey(), views: c.integer() },
		});

		expect(unwrap(plan(chain, posts)).warnings).toContain(
			"posts has 1 unnamed CHECK constraint(s) a model cannot declare: the rebuild drops them; add them back by hand",
		);
	});

	test("fails naming the file when the chain does not replay with double-quoted strings off", () => {
		let broken: MigrationSource = {
			name: "0002_Backfill.sql",
			sql: `UPDATE "posts" SET "title" = "untitled";`,
		};

		let result = plan([CREATE_POSTS, broken], POSTS);

		expect(isFailure(result) && result.error.message).toMatch(
			/^0002_Backfill\.sql does not replay: no such column: "untitled"/,
		);
	});

	test("diffs every table a model exports, in order", () => {
		let authors = table({ name: "authors", columns: { id: c.text().primaryKey() } });

		expect(sqlOf(plan([CREATE_POSTS], POSTS, authors))).toBe(createTableStatement(authors));
	});
});
