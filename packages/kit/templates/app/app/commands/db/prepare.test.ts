/**
 * `db prepare`, run twice on a temporary local database: the first run migrates and seeds, the
 * second finds nothing to do.
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

describe("db prepare", () => {
	test("migrates and seeds a new database, then only migrates", async () => {
		let first = await invoke(cli, ["db", "prepare"]);
		let second = await invoke(cli, ["db", "prepare"]);

		expect(first.code).toBe(0);
		expect(first.stdout).toBe("Applied 0001_CreatePosts.sql\nSeeded posts\n");
		expect(second.code).toBe(0);
		expect(second.stdout).toBe("No migrations to apply\n");
		let database = openDatabase(project.databaseFile);
		expect(database.query("SELECT id FROM posts").all()).toEqual([{ id: "p1" }]);
		database.close();
	});

	test("refuses --remote", async () => {
		let run = await invoke(cli, ["db", "prepare", "--remote"]);

		expect(run.code).toBe(1);
	});
});
