/**
 * `db seed`, run on a temporary local database with a seeder standing in for the app's own.
 */

import { invoke } from "@sdxc/cli/test";
import { openDatabase } from "@sdxc/cloudflare-mocks/sqlite";
import { describe, expect, test, vi } from "vitest";

import { postsSeed, useTemporaryProject } from "~/app/test/local-database";

let project = useTemporaryProject({
	"0001_CreatePosts.sql": "CREATE TABLE posts (id TEXT PRIMARY KEY);",
});

vi.doMock("~/database/seed", () => ({ default: postsSeed("p1") }));

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
