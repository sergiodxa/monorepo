/**
 * Tests for resolving the report builder's query: the default range, each monitor filter,
 * and the problems a query can carry back to the builder.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { isSubmitted, resolveReportRequest } from "~/app/lib/report-request";
import { createTestDatabase } from "~/app/lib/test/db";
import { statusPages } from "~/database/schema";

/** 2026-09-29T10:00Z. */
const NOW = Date.UTC(2026, 8, 29, 10);

const TEAM = "team-a";

/** A database holding one status page for `TEAM` and one for another team. */
async function createFixture() {
	let { db } = createTestDatabase();
	let write = { touch: true, returnRow: true } as const;
	let own = await db.create(
		statusPages,
		{ id: crypto.randomUUID(), team_id: TEAM, name: "Ours", slug: "ours", title: "Ours" },
		write,
	);
	let foreign = await db.create(
		statusPages,
		{ id: crypto.randomUUID(), team_id: "team-b", name: "Theirs", slug: "theirs", title: "T" },
		write,
	);
	return { db, own, foreign };
}

/**
 * Resolves a query string for `TEAM` at `NOW`.
 *
 * @param query - The query, without `?`
 * @returns The resolution result
 */
async function resolve(query: string) {
	let { db, own, foreign } = await createFixture();
	let text = query.replace("{own}", own.id).replace("{foreign}", foreign.id);
	return { result: await resolveReportRequest(db, TEAM, new URLSearchParams(text), NOW), own };
}

describe("resolveReportRequest", () => {
	test("defaults to last month, every monitor, the spreadsheet dialect", async () => {
		let { result } = await resolve("");
		expect(unwrap(result)).toEqual({
			range: { from: "2026-08-01", to: "2026-08-31" },
			filter: { from: "2026-08-01", to: "2026-08-31" },
			dialect: "spreadsheet",
			monitors: "all",
		});
	});

	test("filters by the team's own status page", async () => {
		let { result, own } = await resolve("monitors=status-page:{own}");
		expect(unwrap(result).filter.statusPageId).toBe(own.id);
	});

	test("filters by monitor type", async () => {
		let { result } = await resolve("monitors=type:cron&dialect=standard");
		expect(unwrap(result)).toMatchObject({ filter: { monitorType: "cron" }, dialect: "standard" });
	});

	test.each([
		["monitors=status-page:{foreign}", "scope"],
		["monitors=type:smtp", "scope"],
		["monitors=everything", "scope"],
		["from=2026-08-01", "invalid"],
		["dialect=xlsx", "invalid"],
		["from=2026-08-10&to=2026-08-01", "reversed"],
		["from=2026-09-01&to=2026-09-29", "future"],
	])("rejects %s as %s", async (query, problem) => {
		let { result } = await resolve(query);
		expect(isFailure(result) && result.error.problem).toBe(problem);
	});
});

describe("isSubmitted", () => {
	test("is false for a first visit and true once any field is sent", () => {
		expect(isSubmitted(new URLSearchParams(""))).toBe(false);
		expect(isSubmitted(new URLSearchParams("utm_source=mail"))).toBe(false);
		expect(isSubmitted(new URLSearchParams("dialect=standard"))).toBe(true);
	});
});
