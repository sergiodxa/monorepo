/**
 * The `migrations` check over fixture chains: every configured chain replays on an empty
 * database, a double-quoted string literal fails with the file named, and no chain skips.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test } from "vitest";

import { fixture, removeFixtures } from "./fixture.js";
import { migrationsCheck } from "./migrations.js";

afterEach(removeFixtures);

describe("migrationsCheck", () => {
	test("passes when every configured chain replays", async () => {
		let context = await fixture(
			{
				"database/migrations/0001-posts.sql": "CREATE TABLE posts (id TEXT PRIMARY KEY);",
				"database/migrations/0002-title.sql": "ALTER TABLE posts ADD COLUMN title TEXT;",
				"database/tenant/0001-notes.sql": "CREATE TABLE notes (id TEXT PRIMARY KEY);",
			},
			{
				config: {
					make: { migrations: { default: "database/migrations", tenant: "database/tenant" } },
				},
			},
		);

		expect(await migrationsCheck.run(context)).toMatchObject({
			status: "pass",
			message: "database/migrations, database/tenant replay on an empty database",
		});
	});

	test("fails a chain that reads a double-quoted string as a column", async () => {
		let context = await fixture({
			"database/migrations/0001-posts.sql": "CREATE TABLE posts (id TEXT PRIMARY KEY, title TEXT);",
			"database/migrations/0002-copy.sql":
				'CREATE TABLE posts_new (id TEXT PRIMARY KEY, name TEXT);\nINSERT INTO posts_new SELECT id, "name" FROM posts;',
		});

		let result = await migrationsCheck.run(context);

		expect(result.status).toBe("fail");
		expect(result.findings).toHaveLength(1);
		expect(result.findings[0]).toMatch(
			/^database\/migrations\/0002-copy\.sql does not replay: .*no such column/,
		);
	});

	describe("with doctor.migrations.accept", () => {
		/** A Drizzle rebuild that reads `display_name` while the table it copies has `name`. */
		let renameChain = {
			"database/migrations/0001-users.sql": "CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT);",
			"database/migrations/0002-rename.sql": [
				"CREATE TABLE __new_users (id TEXT PRIMARY KEY, display_name TEXT);--> statement-breakpoint",
				'INSERT INTO __new_users("id", "display_name") SELECT "id", "display_name" FROM users;--> statement-breakpoint',
				"DROP TABLE users;--> statement-breakpoint",
				"ALTER TABLE __new_users RENAME TO users;",
			].join("\n"),
			"database/migrations/0003-email.sql": "ALTER TABLE users ADD COLUMN email TEXT;",
		};

		test("steps past an accepted failure, reports it, and checks the files after it", async () => {
			let context = await fixture(renameChain, {
				config: {
					doctor: {
						migrations: { accept: [{ file: "0002-rename.sql", column: "display_name" }] },
					},
				},
			});

			let result = await migrationsCheck.run(context);

			expect(result).toMatchObject({
				status: "pass",
				message: "database/migrations replays on an empty database past an accepted failure",
			});
			expect(result.findings).toHaveLength(1);
			expect(result.findings[0]).toMatch(
				/^database\/migrations\/0002-rename\.sql accepted: no such column: "display_name"/,
			);
		});

		test("fails a later file even when an earlier failure is accepted", async () => {
			let context = await fixture(
				{
					...renameChain,
					"database/migrations/0003-email.sql": "ALTER TABLE users ADD COLUMN display_name TEXT;",
				},
				{
					config: {
						doctor: {
							migrations: { accept: [{ file: "0002-rename.sql", column: "display_name" }] },
						},
					},
				},
			);

			let result = await migrationsCheck.run(context);

			expect(result.status).toBe("fail");
			expect(result.findings[0]).toMatch(/^database\/migrations\/0003-email\.sql does not replay/);
		});

		test("fails an error in an accepted file that names another column", async () => {
			let context = await fixture(renameChain, {
				config: {
					doctor: { migrations: { accept: [{ file: "0002-rename.sql", column: "name" }] } },
				},
			});

			let result = await migrationsCheck.run(context);

			expect(result.status).toBe("fail");
			expect(result.findings[0]).toMatch(/^database\/migrations\/0002-rename\.sql does not replay/);
		});

		test("warns on an entry that no longer fails", async () => {
			let context = await fixture(
				{ "database/migrations/0001-users.sql": "CREATE TABLE users (id TEXT PRIMARY KEY);" },
				{
					config: {
						doctor: {
							migrations: { accept: [{ file: "0001-users.sql", column: "display_name" }] },
						},
					},
				},
			);

			expect(await migrationsCheck.run(context)).toMatchObject({
				status: "warn",
				message: "An accepted migration failure no longer fails",
				findings: ["0001-users.sql no longer fails on display_name"],
			});
		});
	});

	test("skips a project with no migrations", async () => {
		expect((await migrationsCheck.run(await fixture({}))).status).toBe("skip");
	});
});
