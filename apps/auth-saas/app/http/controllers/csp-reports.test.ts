/**
 * Drives `POST /reports/csp` with both report formats a browser sends, checking each
 * violation reaches the request's log and an unreadable body is refused.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { createLogger } from "@sdxc/logger";
import { log } from "@sdxc/logger/middleware";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import routes from "~/routes/web";

import { cspReports } from "./csp-reports";

/** The records the router's logger wrote, in order. */
let records: Array<Readonly<Record<string, unknown>>> = [];

/** A router logging into {@link records}. */
function buildRouter() {
	records = [];
	let logger = createLogger({ service: "test", sink: (record) => void records.push(record) });
	let router = createRouter({ middleware: [log(logger) as Middleware] });
	router.map(routes.cspReports, cspReports);
	return router;
}

describe("POST /reports/csp", () => {
	test("logs each violation of a legacy report and answers 204", async () => {
		let response = await buildRouter().fetch(
			new Request("https://auth.example.com/reports/csp", {
				method: "POST",
				headers: { "Content-Type": "application/csp-report" },
				body: JSON.stringify({
					"csp-report": {
						"document-uri": "https://tenant.example.com/u/sign-in",
						"blocked-uri": "https://evil.example.com/x.js",
						"effective-directive": "script-src-elem",
						disposition: "report",
					},
				}),
			}),
		);

		expect(response.status).toBe(204);
		let written = JSON.stringify(records);
		expect(written).toContain("csp.violation");
		expect(written).toContain("https://evil.example.com/x.js");
		expect(written).toContain("script-src-elem");
	});

	test("answers 400 to a body that is no report", async () => {
		let response = await buildRouter().fetch(
			new Request("https://auth.example.com/reports/csp", {
				method: "POST",
				headers: { "Content-Type": "text/plain" },
				body: "hello",
			}),
		);

		expect(response.status).toBe(400);
	});
});
