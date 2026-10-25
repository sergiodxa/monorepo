/**
 * Checks inside workerd that a Durable Object's SQLite allows an FTS5 index, so that search
 * option is proven ready, and pins the window a tier grants and the step a flag sizes, both
 * read inside the object.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { generateUUID } from "@sdxc/uuid/v4";
import { env, runInDurableObject } from "cloudflare:test";
import { describe, expect, test } from "vitest";

import type { UserDO } from "~/app/models/user-store";

import { limitsOf } from "~/app/services/entitlement";

/** A reader no other test here uses, since a named object outlives the test that made it. */
function subject(): string {
	return `sub-${generateUUID()}`;
}

describe("FTS5 inside a reader's object", () => {
	/**
	 * A Durable Object's SQLite authorizer allowlists virtual-table modules, so this proves
	 * a `CREATE VIRTUAL TABLE` using FTS5 is permitted and answers a match.
	 */
	test("creates a virtual table, indexes text into it and matches on it", async () => {
		let stub = env.USER.getByName(subject());

		let matched = await runInDurableObject(stub, (_instance, state) => {
			state.storage.sql.exec(
				`CREATE VIRTUAL TABLE search_probe USING fts5(title, summary, author)`,
			);

			state.storage.sql.exec(
				`INSERT INTO search_probe (title, summary, author)
				 VALUES ('The beacon problem', 'about beacons', 'Ada')`,
			);

			return [
				...state.storage.sql.exec<{ title: string }>(
					`SELECT title FROM search_probe WHERE search_probe MATCH 'beacon'`,
				),
			].map((row) => row.title);
		});

		expect(matched).toEqual(["The beacon problem"]);
	});

	/** `bm25` is the ranking an inverted index would order by, and it ships with the module. */
	test("carries the ranking function an inverted index would be ordered by", async () => {
		let stub = env.USER.getByName(subject());

		let ranked = await runInDurableObject(stub, (_instance, state) => {
			state.storage.sql.exec(`CREATE VIRTUAL TABLE rank_probe USING fts5(title)`);
			state.storage.sql.exec(`INSERT INTO rank_probe (title) VALUES ('beacon beacon beacon')`);
			state.storage.sql.exec(`INSERT INTO rank_probe (title) VALUES ('beacon once')`);

			return [
				...state.storage.sql.exec<{ title: string }>(
					`SELECT title FROM rank_probe WHERE rank_probe MATCH 'beacon' ORDER BY bm25(rank_probe)`,
				),
			].map((row) => row.title);
		});

		expect(ranked).toHaveLength(2);
	});
});

describe("the window a tier grants", () => {
	/**
	 * The window is derived from the tier rather than stored beside it, so an upgrade moves
	 * where a search stops with the one write that moves everything else.
	 */
	test("moves with the tier, in the write that moves the tier", async () => {
		let stub = env.USER.getByName(subject());

		let free = await stub.entitlement();
		expect(free.limits.searchWindowDays).toBe(limitsOf("free").searchWindowDays);

		await stub.setTier({
			entitled: "paid",
			cancelled: false,
			readAt: Date.now(),
			source: "billing",
		});

		let paid = await stub.entitlement();
		expect(paid.limits.searchWindowDays).toBeNull();
	});

	/** A search over an object holding nothing reports the archive rather than a step. */
	test("reports the end of an empty archive rather than a span nobody has posts in", async () => {
		let stub: DurableObjectStub<UserDO> = env.USER.getByName(subject());

		let page = await stub.readingQueue({ readState: "all", query: "beacon" });

		if (!page.ok) throw new Error(`expected a page, got ${page.reason}`);

		expect(page.items).toEqual([]);
		expect(page.search?.stoppedAt).toBe("archive");
		expect(page.cursors.next).toBeNull();
	});
});
