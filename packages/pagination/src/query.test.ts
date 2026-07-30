/**
 * Tests for `Pagination.byOffset()` and `Pagination.byKeyset()`.
 *
 * Both run against an in-memory SQLite database through the real adapter, so the
 * SQL they generate is exercised rather than a stand-in for a query builder. The
 * fixture deliberately gives several rows the same `created_at`, because that is the
 * only way a missing tiebreaker shows up as skipped or repeated rows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Database as Sqlite } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";

import { isFailure, unwrap } from "@pkg/result";
import { column as c, createDatabase, table } from "remix/data-table";
import { createSqliteDatabaseAdapter } from "remix/data-table/sqlite";

import type { OrderByTuple } from "./keyset";

import { decodeCursor } from "./cursor";
import { InvalidCursorError, InvalidOrderingError, QueryFailedError } from "./errors";
import { Pagination } from "./pagination";

/** Append-only event log, the shape keyset paging exists for. */
let events = table({
	name: "events",
	columns: {
		id: c.varchar(64),
		team_id: c.integer(),
		created_at: c.integer(),
		name: c.varchar(255),
	},
});

/** A table with no backing SQLite table, used to observe a failing query. */
let ghosts = table({
	name: "ghosts",
	columns: { id: c.varchar(64) },
});

/** Ordering with a unique tiebreaker, which is what keyset paging requires. */
const ORDER_NEWEST_FIRST: readonly OrderByTuple[] = [
	["created_at", "desc"],
	["id", "desc"],
];

/**
 * Twelve events for team 1 and three for team 2.
 *
 * `created_at` repeats in blocks of three, so any ordering that leans on it alone
 * has three-row ties straddling every page boundary.
 */
function seed(sqlite: Sqlite): void {
	sqlite.run(
		"create table events (id text primary key, team_id integer, created_at integer, name text)",
	);

	for (let index = 1; index <= 12; index++) {
		sqlite.run("insert into events (id, team_id, created_at, name) values (?, ?, ?, ?)", [
			`evt_${String(index).padStart(2, "0")}`,
			1,
			1000 + Math.floor((index - 1) / 3) * 10,
			`event ${index}`,
		]);
	}

	for (let index = 1; index <= 3; index++) {
		sqlite.run("insert into events (id, team_id, created_at, name) values (?, ?, ?, ?)", [
			`oth_${index}`,
			2,
			9000,
			`other ${index}`,
		]);
	}
}

let db: ReturnType<typeof createDatabase>;

beforeEach(() => {
	let sqlite = new Sqlite(":memory:");
	seed(sqlite);
	db = createDatabase(createSqliteDatabaseAdapter(sqlite));
});

/** Team 1's events, newest first, as an offset query would compose them. */
function teamQuery() {
	return db.query(events).where({ team_id: 1 }).orderBy("created_at", "desc").orderBy("id", "desc");
}

/**
 * Reads one keyset page of team 1's events, seeking forward from `cursor`.
 *
 * A named helper rather than an inline call inside the walk loop, because a page
 * whose type is inferred from a cursor the same loop reassigns is circular.
 */
async function pageAfter(cursor: string | null, limit: number) {
	return unwrap(
		await Pagination.byKeyset(db.query(events).where({ team_id: 1 }), {
			orderBy: ORDER_NEWEST_FIRST,
			after: cursor,
			limit,
		}),
	);
}

describe("Pagination.byOffset", () => {
	test("returns one page of rows and the arithmetic behind it", async () => {
		let page = unwrap(await Pagination.byOffset(teamQuery(), { page: 2, perPage: 5 }));

		expect(page.items.map((row) => row.id)).toEqual([
			"evt_07",
			"evt_06",
			"evt_05",
			"evt_04",
			"evt_03",
		]);
		expect(page.pagination.total).toBe(12);
		expect(page.pagination.pages).toBe(3);
		expect(page.pagination.offset).toBe(5);
	});

	test("counts only the rows the composed predicate matches", async () => {
		let page = unwrap(await Pagination.byOffset(teamQuery(), { page: 1, perPage: 5 }));

		// 15 rows exist; the `team_id` predicate has to reach the count as well as the fetch.
		expect(page.pagination.total).toBe(12);
	});

	test("clamps a page past the end and returns the last partial page", async () => {
		let page = unwrap(await Pagination.byOffset(teamQuery(), { page: 99, perPage: 5 }));

		expect(page.pagination.page).toBe(3);
		expect(page.items.map((row) => row.id)).toEqual(["evt_02", "evt_01"]);
		expect(page.pagination.from).toBe(11);
		expect(page.pagination.to).toBe(12);
	});

	test("is an empty page with a zero total when nothing matches", async () => {
		let page = unwrap(
			await Pagination.byOffset(db.query(events).where({ team_id: 99 }), { page: 1, perPage: 5 }),
		);

		expect(page.items).toEqual([]);
		expect(page.pagination.total).toBe(0);
		expect(page.pagination.pages).toBe(1);
		expect(page.pagination.series()).toEqual([{ type: "page", page: 1, current: true }]);
	});

	test("skips the count query when the caller already knows the total", async () => {
		let page = unwrap(await Pagination.byOffset(teamQuery(), { page: 1, perPage: 5, total: 500 }));

		expect(page.pagination.total).toBe(500);
		expect(page.pagination.pages).toBe(100);
		expect(page.items).toHaveLength(5);
	});

	test("leaves the query value reusable, because chaining does not mutate it", async () => {
		let query = teamQuery();

		let first = unwrap(await Pagination.byOffset(query, { page: 1, perPage: 5 }));
		let second = unwrap(await Pagination.byOffset(query, { page: 1, perPage: 5 }));
		let third = unwrap(await Pagination.byOffset(query, { page: 3, perPage: 5 }));

		expect(second.items.map((row) => row.id)).toEqual(first.items.map((row) => row.id));
		expect(second.pagination.total).toBe(12);
		expect(third.items.map((row) => row.id)).toEqual(["evt_02", "evt_01"]);
	});

	test("returns a failure instead of throwing when the query fails", async () => {
		let result = await Pagination.byOffset(db.query(ghosts), { page: 1, perPage: 5 });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(QueryFailedError);
	});
});

describe("Pagination.byKeyset", () => {
	test("returns the first page newest first, with only a next cursor", async () => {
		let page = unwrap(
			await Pagination.byKeyset(db.query(events).where({ team_id: 1 }), {
				orderBy: ORDER_NEWEST_FIRST,
				limit: 5,
			}),
		);

		expect(page.items.map((row) => row.id)).toEqual([
			"evt_12",
			"evt_11",
			"evt_10",
			"evt_09",
			"evt_08",
		]);
		expect(page.cursors.prev).toBeNull();
		expect(page.cursors.next).not.toBeNull();
	});

	test("does not include the extra row it reads to detect a next page", async () => {
		let page = unwrap(
			await Pagination.byKeyset(db.query(events).where({ team_id: 1 }), {
				orderBy: ORDER_NEWEST_FIRST,
				limit: 5,
			}),
		);

		expect(page.items).toHaveLength(5);
	});

	test("has no next cursor on the last page", async () => {
		let page = unwrap(
			await Pagination.byKeyset(db.query(events).where({ team_id: 2 }), {
				orderBy: ORDER_NEWEST_FIRST,
				limit: 5,
			}),
		);

		expect(page.items).toHaveLength(3);
		expect(page.cursors.next).toBeNull();
	});

	test("walks every row exactly once across pages, despite the ties", async () => {
		let seen: string[] = [];
		let cursor: string | null = null;

		for (let guard = 0; guard < 10; guard++) {
			let page = await pageAfter(cursor, 5);

			seen.push(...page.items.map((row) => row.id));
			cursor = page.cursors.next;
			if (cursor === null) break;
		}

		expect(seen).toEqual([
			"evt_12",
			"evt_11",
			"evt_10",
			"evt_09",
			"evt_08",
			"evt_07",
			"evt_06",
			"evt_05",
			"evt_04",
			"evt_03",
			"evt_02",
			"evt_01",
		]);
		expect(new Set(seen).size).toBe(12);
	});

	test("advertises a prev cursor once it has been seeked from", async () => {
		let first = unwrap(
			await Pagination.byKeyset(db.query(events).where({ team_id: 1 }), {
				orderBy: ORDER_NEWEST_FIRST,
				limit: 5,
			}),
		);

		let second = unwrap(
			await Pagination.byKeyset(db.query(events).where({ team_id: 1 }), {
				orderBy: ORDER_NEWEST_FIRST,
				after: first.cursors.next,
				limit: 5,
			}),
		);

		expect(second.cursors.prev).not.toBeNull();
		expect(second.items.map((row) => row.id)).toEqual([
			"evt_07",
			"evt_06",
			"evt_05",
			"evt_04",
			"evt_03",
		]);
	});

	test("pages backward into the previous page, still in the requested order", async () => {
		let first = unwrap(
			await Pagination.byKeyset(db.query(events).where({ team_id: 1 }), {
				orderBy: ORDER_NEWEST_FIRST,
				limit: 5,
			}),
		);
		let second = unwrap(
			await Pagination.byKeyset(db.query(events).where({ team_id: 1 }), {
				orderBy: ORDER_NEWEST_FIRST,
				after: first.cursors.next,
				limit: 5,
			}),
		);

		let back = unwrap(
			await Pagination.byKeyset(db.query(events).where({ team_id: 1 }), {
				orderBy: ORDER_NEWEST_FIRST,
				before: second.cursors.prev,
				limit: 5,
			}),
		);

		expect(back.items.map((row) => row.id)).toEqual(first.items.map((row) => row.id));
	});

	test("reports a following page when it arrived by paging backward", async () => {
		let first = unwrap(
			await Pagination.byKeyset(db.query(events).where({ team_id: 1 }), {
				orderBy: ORDER_NEWEST_FIRST,
				limit: 5,
			}),
		);
		let second = unwrap(
			await Pagination.byKeyset(db.query(events).where({ team_id: 1 }), {
				orderBy: ORDER_NEWEST_FIRST,
				after: first.cursors.next,
				limit: 5,
			}),
		);
		let back = unwrap(
			await Pagination.byKeyset(db.query(events).where({ team_id: 1 }), {
				orderBy: ORDER_NEWEST_FIRST,
				before: second.cursors.prev,
				limit: 5,
			}),
		);

		expect(back.cursors.next).not.toBeNull();
		expect(back.cursors.prev).toBeNull();
	});

	test("seeks in the direction the cursor was minted for", async () => {
		let first = unwrap(
			await Pagination.byKeyset(db.query(events).where({ team_id: 1 }), {
				orderBy: ORDER_NEWEST_FIRST,
				limit: 5,
			}),
		);

		expect(unwrap(decodeCursor(first.cursors.next ?? "")).direction).toBe("after");

		let second = unwrap(
			await Pagination.byKeyset(db.query(events).where({ team_id: 1 }), {
				orderBy: ORDER_NEWEST_FIRST,
				cursor: first.cursors.next,
				limit: 5,
			}),
		);

		let back = unwrap(
			await Pagination.byKeyset(db.query(events).where({ team_id: 1 }), {
				orderBy: ORDER_NEWEST_FIRST,
				cursor: second.cursors.prev,
				limit: 5,
			}),
		);

		expect(second.items.map((row) => row.id)).toEqual([
			"evt_07",
			"evt_06",
			"evt_05",
			"evt_04",
			"evt_03",
		]);
		expect(back.items.map((row) => row.id)).toEqual(first.items.map((row) => row.id));
	});

	test("pages an ascending ordering as well", async () => {
		let ascending: readonly OrderByTuple[] = [
			["created_at", "asc"],
			["id", "asc"],
		];

		let first = unwrap(
			await Pagination.byKeyset(db.query(events).where({ team_id: 1 }), {
				orderBy: ascending,
				limit: 4,
			}),
		);
		let second = unwrap(
			await Pagination.byKeyset(db.query(events).where({ team_id: 1 }), {
				orderBy: ascending,
				after: first.cursors.next,
				limit: 4,
			}),
		);

		expect(first.items.map((row) => row.id)).toEqual(["evt_01", "evt_02", "evt_03", "evt_04"]);
		expect(second.items.map((row) => row.id)).toEqual(["evt_05", "evt_06", "evt_07", "evt_08"]);
	});

	test("pages on a single sort key the caller declares unique", async () => {
		let page = unwrap(
			await Pagination.byKeyset(db.query(events).where({ team_id: 1 }), {
				orderBy: [["id", "asc"]],
				unique: true,
				limit: 3,
			}),
		);

		expect(page.items.map((row) => row.id)).toEqual(["evt_01", "evt_02", "evt_03"]);
	});

	test("refuses a single non-unique sort key before running anything", async () => {
		let result = await Pagination.byKeyset(db.query(events).where({ team_id: 1 }), {
			orderBy: [["created_at", "desc"]],
			limit: 5,
		});

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(InvalidOrderingError);
	});

	test("refuses an empty ordering", async () => {
		let result = await Pagination.byKeyset(db.query(events), { orderBy: [], limit: 5 });

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(InvalidOrderingError);
	});

	test("treats a malformed cursor as a validation failure, not a crash", async () => {
		let result = await Pagination.byKeyset(db.query(events).where({ team_id: 1 }), {
			orderBy: ORDER_NEWEST_FIRST,
			after: "!!!not-a-cursor!!!",
			limit: 5,
		});

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(InvalidCursorError);
	});

	test("rejects a cursor minted for a different ordering", async () => {
		let first = unwrap(
			await Pagination.byKeyset(db.query(events).where({ team_id: 1 }), {
				orderBy: ORDER_NEWEST_FIRST,
				limit: 5,
			}),
		);

		let result = await Pagination.byKeyset(db.query(events).where({ team_id: 1 }), {
			orderBy: [
				["name", "desc"],
				["id", "desc"],
			],
			after: first.cursors.next,
			limit: 5,
		});

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(InvalidCursorError);
	});

	test("refuses more than one cursor at a time", async () => {
		let result = await Pagination.byKeyset(db.query(events).where({ team_id: 1 }), {
			orderBy: ORDER_NEWEST_FIRST,
			after: "a",
			before: "b",
			limit: 5,
		});

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(InvalidCursorError);
	});

	test("treats a blank cursor parameter as no cursor at all", async () => {
		let page = unwrap(
			await Pagination.byKeyset(db.query(events).where({ team_id: 1 }), {
				orderBy: ORDER_NEWEST_FIRST,
				after: "",
				limit: 5,
			}),
		);

		expect(page.items.map((row) => row.id)).toEqual([
			"evt_12",
			"evt_11",
			"evt_10",
			"evt_09",
			"evt_08",
		]);
		expect(page.cursors.prev).toBeNull();
	});

	test("is an empty page with no cursors when nothing matches", async () => {
		let page = unwrap(
			await Pagination.byKeyset(db.query(events).where({ team_id: 99 }), {
				orderBy: ORDER_NEWEST_FIRST,
				limit: 5,
			}),
		);

		expect(page.items).toEqual([]);
		expect(page.cursors).toEqual({ next: null, prev: null });
	});

	test("returns a failure instead of throwing when the query fails", async () => {
		let result = await Pagination.byKeyset(db.query(ghosts), {
			orderBy: [["id", "asc"]],
			unique: true,
			limit: 5,
		});

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error).toBeInstanceOf(QueryFailedError);
	});

	test("leaves the query value reusable across two paged reads", async () => {
		let query = db.query(events).where({ team_id: 1 });

		let first = unwrap(await Pagination.byKeyset(query, { orderBy: ORDER_NEWEST_FIRST, limit: 5 }));
		let again = unwrap(await Pagination.byKeyset(query, { orderBy: ORDER_NEWEST_FIRST, limit: 5 }));

		expect(again.items.map((row) => row.id)).toEqual(first.items.map((row) => row.id));
	});
});
