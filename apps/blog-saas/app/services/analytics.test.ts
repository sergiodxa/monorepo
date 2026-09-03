/**
 * Tests for the blog-saas Analytics Engine query helper — the SQL-injection date
 * guard and page-view row parsing in `queryDailyPageViews`. The account mock runs
 * before the dynamic import so `env` carries credentials when the helper loads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createEnv } from "@sdxc/cloudflare-mocks";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Cloudflare.Env>({ CF_ACCOUNT_ID: "acct-1", CF_API_TOKEN: "token-1" }),
}));

let { queryDailyPageViews } = await import("./analytics");

let SQL_URL = "https://api.cloudflare.com/client/v4/accounts/acct-1/analytics_engine/sql";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("queryDailyPageViews", () => {
	test("rejects a non-YYYY-MM-DD date without querying (injection guard)", async () => {
		server.use(
			http.post(SQL_URL, () => {
				throw new Error("queryDailyPageViews must not query for an invalid date");
			}),
		);

		for (let bad of ["", "2026-1-1", "2026/07/04", "2026-07-04' OR '1'='1", "yesterday"]) {
			expect(await queryDailyPageViews(bad)).toEqual([]);
		}
	});

	test("parses per-blog rows and rounds views for a valid date", async () => {
		server.use(
			http.post(SQL_URL, () =>
				HttpResponse.json({
					data: [
						{ blogId: "blog-1", views: 12.7 },
						{ blogId: "blog-2", views: 3 },
					],
				}),
			),
		);

		let result = await queryDailyPageViews("2026-07-04");
		expect(result).toEqual([
			{ blogId: "blog-1", date: "2026-07-04", views: 13 },
			{ blogId: "blog-2", date: "2026-07-04", views: 3 },
		]);
	});

	test("returns empty on a non-ok Analytics Engine response", async () => {
		server.use(http.post(SQL_URL, () => new HttpResponse("nope", { status: 500 })));
		expect(await queryDailyPageViews("2026-07-04")).toEqual([]);
	});
});
