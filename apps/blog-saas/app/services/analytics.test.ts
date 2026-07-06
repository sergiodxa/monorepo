/**
 * Tests for the blog-saas Analytics Engine query helper — the SQL-injection date
 * guard and page-view row parsing in `queryDailyPageViews`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { afterEach, describe, expect, mock, test } from "bun:test";

mock.module("cloudflare:workers", () => ({
	env: { CF_ACCOUNT_ID: "acct-1", CF_API_TOKEN: "token-1" },
}));

let { queryDailyPageViews } = await import("./analytics");

let realFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = realFetch;
});

describe("queryDailyPageViews", () => {
	test("rejects a non-YYYY-MM-DD date without querying (injection guard)", async () => {
		let called = false;
		globalThis.fetch = (async () => {
			called = true;
			return new Response("{}");
		}) as unknown as typeof fetch;

		for (let bad of ["", "2026-1-1", "2026/07/04", "2026-07-04' OR '1'='1", "yesterday"]) {
			expect(await queryDailyPageViews(bad)).toEqual([]);
		}
		expect(called).toBe(false);
	});

	test("parses per-blog rows and rounds views for a valid date", async () => {
		globalThis.fetch = (async () =>
			new Response(
				JSON.stringify({
					data: [
						{ blogId: "blog-1", views: 12.7 },
						{ blogId: "blog-2", views: 3 },
					],
				}),
			)) as unknown as typeof fetch;

		let result = await queryDailyPageViews("2026-07-04");
		expect(result).toEqual([
			{ blogId: "blog-1", date: "2026-07-04", views: 13 },
			{ blogId: "blog-2", date: "2026-07-04", views: 3 },
		]);
	});

	test("returns empty on a non-ok Analytics Engine response", async () => {
		globalThis.fetch = (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
		expect(await queryDailyPageViews("2026-07-04")).toEqual([]);
	});
});
