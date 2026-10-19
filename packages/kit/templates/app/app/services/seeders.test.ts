/**
 * The seeder runner, on an in-memory database with the app's models bound to it.
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Seeder } from "~/app/services/seeders";

import { openLocalDatabase } from "~/app/initializers/local-database";
import { runSeeders } from "~/app/services/seeders";

/** A database holding an empty `posts` table. */
async function setup() {
	let db = openLocalDatabase(":memory:");
	await db.exec("CREATE TABLE posts (id TEXT PRIMARY KEY)");
	return db;
}

describe("runSeeders", () => {
	test("runs each seeder in order, naming it once it finishes", async () => {
		let db = await setup();
		let seeded: string[] = [];
		let first: Seeder = async ({ db }) => {
			await db.exec("INSERT INTO posts (id) VALUES ('p1')");
		};
		let second: Seeder = async ({ db }) => {
			await db.exec("INSERT INTO posts (id) SELECT id || '-copy' FROM posts");
		};

		unwrap(await runSeeders({ first, second }, db, (name) => seeded.push(name)));

		expect(seeded).toEqual(["first", "second"]);
		expect((await db.exec("SELECT id FROM posts ORDER BY id")).rows).toEqual([
			{ id: "p1" },
			{ id: "p1-copy" },
		]);
	});

	test("stops at the seeder that throws and names it", async () => {
		let db = await setup();
		let ran: string[] = [];
		let broken: Seeder = async ({ db }) => {
			await db.exec("INSERT INTO missing (id) VALUES ('x')");
		};
		let after: Seeder = async () => {
			ran.push("after");
		};

		let result = await runSeeders({ broken, after }, db);

		expect(isFailure(result) && result.error.message).toBe("The broken seeder failed");
		expect(ran).toEqual([]);
	});
});
