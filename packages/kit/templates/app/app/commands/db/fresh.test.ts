/**
 * `db fresh`, run on a temporary local database holding rows and a table no migration makes.
 */

import { invoke } from "@sdxc/cli/test";
import { openDatabase } from "@sdxc/cloudflare-mocks/sqlite";
import { describe, expect, test, vi } from "vitest";

import type { Seeder } from "~/app/services/seeders";

import { useTemporaryProject } from "~/app/test/local-database";

let project = useTemporaryProject({
	"0001_CreatePosts.sql": "CREATE TABLE posts (id TEXT PRIMARY KEY);",
});

/** A seeder writing one post, to show `--seed` ran on the emptied table. */
const posts: Seeder = async ({ db }) => {
	await db.exec("INSERT INTO posts (id) VALUES ('seeded')");
};

vi.doMock("~/database/seeders", () => ({ default: { posts } }));

let { cli } = await import("~/app/initializers/cli");

/** The ids in the temporary database's `posts`, and whether a stray table survived. */
function snapshot() {
	let database = openDatabase(project.databaseFile);
	let posts = database.query("SELECT id FROM posts").all();
	let stray = database.query("SELECT name FROM sqlite_master WHERE name = 'stray'").all();
	database.close();
	return { posts, stray: stray.length > 0 };
}

describe("db fresh", () => {
	test("drops every table and applies the chain again", async () => {
		await invoke(cli, ["db", "migrate"]);
		let database = openDatabase(project.databaseFile);
		database.exec("INSERT INTO posts (id) VALUES ('old'); CREATE TABLE stray (id TEXT);");
		database.close();

		let run = await invoke(cli, ["db", "fresh"]);

		expect(run.code).toBe(0);
		expect(run.stdout).toBe("Dropped 3 tables\nApplied 0001_CreatePosts.sql\n");
		expect(snapshot()).toEqual({ posts: [], stray: false });
	});

	test("--seed runs db seed on the empty tables", async () => {
		let run = await invoke(cli, ["db", "fresh", "--seed"]);

		expect(run.code).toBe(0);
		expect(run.stdout).toContain("Seeded posts\n");
		expect(snapshot().posts).toEqual([{ id: "seeded" }]);
	});

	test("refuses --remote and leaves the database alone", async () => {
		let run = await invoke(cli, ["db", "fresh", "--remote"]);

		expect(run.code).toBe(1);
		expect(run.stderr).toContain("only on the local database");
		expect(snapshot().posts).toEqual([{ id: "seeded" }]);
	});
});
