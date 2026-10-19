/**
 * `db seed`, run on a temporary local database with a seeder standing in for the app's own.
 */

import { invoke } from "@sdxc/cli/test";
import { openDatabase } from "@sdxc/cloudflare-mocks/sqlite";
import { describe, expect, test, vi } from "vitest";

import type { Seeder } from "~/app/services/seeders";

import { useTemporaryProject } from "~/app/test/local-database";

let project = useTemporaryProject({
	"0001_CreatePosts.sql": "CREATE TABLE posts (id TEXT PRIMARY KEY);",
});

/** A seeder writing one post through the run's database. */
const posts: Seeder = async ({ db }) => {
	await db.exec("INSERT INTO posts (id) VALUES ('p1')");
};

vi.doMock("~/database/seeders", () => ({ default: { posts } }));

let { cli } = await import("~/app/initializers/cli");

describe("db seed", () => {
	test("runs each seeder on the local database and names it", async () => {
		await invoke(cli, ["db", "migrate"]);

		let run = await invoke(cli, ["db", "seed"]);

		expect(run.code).toBe(0);
		expect(run.stdout).toBe("Seeded posts\n");
		let database = openDatabase(project.databaseFile);
		expect(database.query("SELECT id FROM posts").all()).toEqual([{ id: "p1" }]);
		database.close();
	});

	test("refuses --remote", async () => {
		let run = await invoke(cli, ["db", "seed", "--remote"]);

		expect(run.code).toBe(1);
		expect(run.stderr).toContain("only to the local database");
	});
});
