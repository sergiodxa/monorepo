/**
 * Tests for `GET /health` through the real router, with Polar and Buttondown behind MSW: the
 * report passes only while both answer, and either one failing turns it into a `503` naming
 * the provider, so a monitor pages before a visitor reaches a broken checkout or sample form.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Health } from "@sdxc/health";

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";

const POLAR_HEALTH = "https://api.polar.sh/healthz";
const BUTTONDOWN_PING = "https://api.buttondown.com/v1/ping";

/**
 * Both providers up; a test overrides one to take it down. The mocks answer without a body:
 * the check cancels a probe response's body, and cancelling an MSW-mocked body hangs
 * under Node, which would time every probe out.
 */
let server = setupServer(
	http.get(POLAR_HEALTH, () => new HttpResponse(null, { status: 200 })),
	http.get(BUTTONDOWN_PING, () => new HttpResponse(null, { status: 200 })),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("GET /health", () => {
	test("passes when Polar and Buttondown both answer", async () => {
		let authorization: string | null = null;
		server.use(
			http.get(BUTTONDOWN_PING, ({ request }) => {
				authorization = request.headers.get("authorization");
				return new HttpResponse(null, { status: 200 });
			}),
		);

		let response = await fetchApp("/health");
		let report = (await response.json()) as Health.Report;

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/health+json");
		expect(report).toMatchObject({
			status: "pass",
			serviceId: "books",
			checks: {
				"polar:responseTime": [{ status: "pass", componentType: "system" }],
				"buttondown:responseTime": [{ status: "pass", componentType: "system" }],
			},
		});
		expect(authorization).toBe("Token test-BUTTONDOWN_API_KEY");
	});

	test("fails with 503 when Polar is down", async () => {
		server.use(http.get(POLAR_HEALTH, () => new HttpResponse(null, { status: 503 })));

		let response = await fetchApp("/health");
		let report = (await response.json()) as Health.Report;

		expect(response.status).toBe(503);
		expect(report.status).toBe("fail");
		expect(report.checks?.["polar:responseTime"]).toMatchObject([
			{
				status: "fail",
				output: "HTTP 503",
				affectedEndpoints: expect.arrayContaining(["/api/checkout/{type}"]),
			},
		]);
		expect(report.checks?.["buttondown:responseTime"]).toMatchObject([{ status: "pass" }]);
	});

	test("fails with 503 when Buttondown rejects the API key", async () => {
		server.use(http.get(BUTTONDOWN_PING, () => new HttpResponse(null, { status: 401 })));

		let response = await fetchApp("/health");
		let report = (await response.json()) as Health.Report;

		expect(response.status).toBe(503);
		expect(report.checks?.["buttondown:responseTime"]).toMatchObject([
			{
				status: "fail",
				output: "HTTP 401",
				affectedEndpoints: expect.arrayContaining(["/sample"]),
			},
		]);
		expect(report.checks?.["polar:responseTime"]).toMatchObject([{ status: "pass" }]);
	});
});
