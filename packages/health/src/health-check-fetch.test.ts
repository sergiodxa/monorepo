/**
 * Tests `HealthCheck` against real `fetch` responses served by MSW, on real timers. A body
 * whose cancellation never settles (as MSW's mocked bodies under Node do) must not hold the
 * probe until its timeout: the status code alone decides the check.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { HealthCheck } from "./health-check.js";

/** The dependency every probe here fetches. */
const DEPENDENCY_URL = "https://dependency.example.com/healthz";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("HealthCheck with fetched responses", () => {
	test.each([
		[200, "pass", undefined],
		[502, "fail", "HTTP 502"],
	])(
		"judges a %i with a body by its status, without waiting on the body",
		async (status, expected, output) => {
			server.use(http.get(DEPENDENCY_URL, () => new HttpResponse("body text", { status })));
			let health = new HealthCheck({ timeout: 1_000 }).probe("dependency", (_, signal) =>
				fetch(DEPENDENCY_URL, { signal }),
			);

			let [check] = (await health.check()).checks?.["dependency:responseTime"] ?? [];

			expect(check?.status).toBe(expected);
			expect(check?.output).toBe(output);
		},
	);

	test("judges a health report over 64 KB by its status, without waiting on the rest", async () => {
		let body = JSON.stringify({ status: "fail", notes: ["x".repeat(70_000)] });
		server.use(
			http.get(
				DEPENDENCY_URL,
				() =>
					new HttpResponse(body, {
						status: 503,
						headers: { "Content-Type": "application/health+json" },
					}),
			),
		);
		let health = new HealthCheck({ timeout: 1_000 }).probe("dependency", (_, signal) =>
			fetch(DEPENDENCY_URL, { signal }),
		);

		let [check] = (await health.check()).checks?.["dependency:responseTime"] ?? [];

		expect(check?.output).toBe("unreadable health report");
	});
});
