/**
 * `sdxc make migration <name> field ...`: the names it reads as create, add and remove, the SQL
 * each writes, and the refusals for a name or a column SQLite cannot take as asked.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { isFailure, unwrap } from "@sdxc/result";
import { afterEach, describe, expect, test } from "vite-plus/test";

import { fieldMigration, migrationIntent } from "./from-fields.js";
import { parseName } from "./names.js";

/** Fixture directories created by the current test, removed after it. */
const DIRECTORIES: string[] = [];

afterEach(async () => {
	let created = DIRECTORIES.splice(0);
	await Promise.all(created.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** The chain every test writes after. */
const FOLDER = "database/migrations";

/** A project whose chain creates `posts`, with an `author` model keyed by an integer. */
async function project(): Promise<string> {
	let root = await mkdtemp(join(tmpdir(), "sdxc-from-fields-"));
	DIRECTORIES.push(root);
	await mkdir(join(root, FOLDER), { recursive: true });
	await mkdir(join(root, "app/models"), { recursive: true });
	await writeFile(
		join(root, FOLDER, "0001_CreatePosts.sql"),
		'CREATE TABLE "posts" ("id" TEXT PRIMARY KEY NOT NULL, "title" TEXT NOT NULL, "slug" TEXT);\n',
	);
	await writeFile(
		join(root, "app/models/author.ts"),
		'export const authorTable = table({ name: "people", columns: { id: c.integer().primaryKey() } });\n',
	);
	return root;
}

/** The migration `name` with `specs` in a fresh {@link project}. */
async function migrate(name: string, specs: string[]) {
	return fieldMigration(await project(), FOLDER, unwrap(parseName(name)), specs);
}

describe("migrationIntent", () => {
	test.each([
		["create-posts", { action: "create", table: "posts" }],
		["create_blog_posts", { action: "create", table: "blog_posts" }],
		["CreatePosts", { action: "create", table: "posts" }],
		["add-slug-to-posts", { action: "add", table: "posts" }],
		["AddSlugAndViewsToBlogPosts", { action: "add", table: "blog_posts" }],
		["add-to-do-to-tasks", { action: "add", table: "tasks" }],
		["remove_slug_from_posts", { action: "remove", table: "posts" }],
		["sync-posts", null],
		["create", null],
		["add-slug-to", null],
		["add-slug", null],
	])("%s reads as %j", (name, intent) => {
		expect(migrationIntent(unwrap(parseName(name)))).toEqual(intent);
	});
});

describe("fieldMigration", () => {
	test("create writes the table a model with those fields declares", async () => {
		let sql = unwrap(await migrate("create-comments", ["body", "author_id", "post:references?"]));

		expect(sql).toBe(
			[
				"-- CreateComments: creates the comments table.",
				"",
				'CREATE TABLE "comments" (',
				'  "id" TEXT PRIMARY KEY NOT NULL,',
				'  "body" TEXT NOT NULL,',
				'  "author_id" INTEGER NOT NULL,',
				'  "post_id" TEXT,',
				'  "created_at" INTEGER NOT NULL,',
				'  "updated_at" INTEGER NOT NULL,',
				'  CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "people" ("id"),',
				'  CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts" ("id")',
				");",
				"",
			].join("\n"),
		);
	});

	test("add writes an ADD COLUMN per field, a box unticked and a reference nullable", async () => {
		let sql = unwrap(await migrate("add-details-to-posts", ["summary?", "featured", "author_id?"]));

		expect(sql).toBe(
			[
				"-- AddDetailsToPosts: adds summary, featured, author_id to posts.",
				"",
				'ALTER TABLE "posts" ADD COLUMN "summary" TEXT;',
				"",
				'ALTER TABLE "posts" ADD COLUMN "featured" INTEGER NOT NULL DEFAULT 0;',
				"",
				'ALTER TABLE "posts" ADD COLUMN "author_id" INTEGER CONSTRAINT "posts_author_id_fkey" REFERENCES "people" ("id");',
				"",
			].join("\n"),
		);
	});

	test("remove writes a DROP COLUMN per field, whatever type it names", async () => {
		let sql = unwrap(await migrate("RemoveSlugFromPosts", ["slug:string?"]));

		expect(sql).toBe(
			'-- RemoveSlugFromPosts: drops slug from posts.\n\nALTER TABLE "posts" DROP COLUMN "slug";\n',
		);
	});

	test.each([
		["sync-posts", ["title"], "name the migration create-<table>, add-<columns>-to-<table>"],
		["add-views-to-posts", ["views:integer"], "write views? to add it nullable"],
		["add-author-to-posts", ["author_id"], "write author_id? to add it nullable"],
		["add-slug-to-posts", ["slug?"], "duplicate column name: slug"],
		["add-slug-to-pages", ["slug?"], "no such table: pages"],
		["create-posts", ["title"], 'table "posts" already exists'],
		["remove-body-from-posts", ["body"], "no such column"],
		["remove-id-from-posts", ["id"], "id is a column of every table"],
		["create-users", ["password"], "store only its hash"],
	])("%s %j is refused", async (name, specs, message) => {
		let result = await migrate(name, specs);

		expect(isFailure(result) && result.error.message).toContain(message);
	});

	test("a chain that does not replay is left unchecked", async () => {
		let root = await project();
		await writeFile(join(root, FOLDER, "0002_Broken.sql"), "NOT SQL;\n");

		let result = await fieldMigration(root, FOLDER, unwrap(parseName("add-x-to-posts")), ["x?"]);

		expect(unwrap(result)).toContain('ALTER TABLE "posts" ADD COLUMN "x" TEXT;');
	});
});
