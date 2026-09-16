/**
 * Checks, inside workerd and against a real Durable Object's SQLite, that the inverted
 * index ADR-016 declined is one this runtime would actually allow — so the option is known
 * to work before anybody needs it, rather than argued about again.
 *
 * It also pins the entitlement and flag paths a search reads through: the window a tier
 * grants, and the step a flag sizes, both taken inside the object where there is no request
 * to carry either.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env, runInDurableObject } from "cloudflare:test";
import { describe, expect, test } from "vitest";

import type { UserDO } from "~/database/user-do";

import { limitsOf } from "~/app/lib/entitlement";

/** A reader no other test here uses, since a named object outlives the test that made it. */
function subject(): string {
	return `sub-${crypto.randomUUID()}`;
}

describe("FTS5 inside a reader's object", () => {
	/**
	 * The alternative ADR-016 records rather than builds. The authorizer a Durable Object's
	 * SQLite runs statements through carries an allowlist of virtual-table modules, so what
	 * matters is whether a `CREATE VIRTUAL TABLE` is permitted at all — not how well it
	 * ranks, which is a question for whoever builds it.
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
