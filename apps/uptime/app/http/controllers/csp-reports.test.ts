/**
 * Tests the CSP report endpoint: each violation in a report lands on the request's log as a
 * `csp.violation` warning, and a body that is not a report is refused.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Log } from "@sdxc/logger";
import type { Middleware, RequestHandler } from "remix/router";

import { createLogger } from "@sdxc/logger";
import { log } from "@sdxc/logger/middleware";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import routes from "~/routes/web";

import cspReports from "./csp-reports";

/** Posts a body to the endpoint and returns the response with the notes it logged. */
async function post(body: string, contentType: string) {
	let record: Record<string, unknown> = {};
	let router = createRouter({
		middleware: [
			log(
				createLogger({ service: "uptime", sink: (emitted) => void (record = emitted) }),
			) as Middleware,
		],
	});
	router.map(routes.cspReports, cspReports as RequestHandler<any>);

	let response = await router.fetch(
		new Request(new URL(routes.cspReports.href(), "https://uptime.test"), {
			method: "POST",
			headers: { "content-type": contentType },
			body,
		}),
	);
	return { response, record };
}

describe("POST /reports/csp", () => {
	test("logs each reported violation and answers 204", async () => {
		let { response, record } = await post(
			JSON.stringify([
				{
					type: "csp-violation",
					age: 0,
					url: "https://uptime.test/",
					body: {
						documentURL: "https://uptime.test/",
						blockedURL: "https://evil.example/x.js",
						effectiveDirective: "script-src-elem",
						disposition: "report",
					},
				},
			]),
			"application/reports+json",
		);

		expect(response.status).toBe(204);
		let notes = (record.notes as Log.Note[] | undefined) ?? [];
		expect(notes.find((note) => note.name === "csp.violation")).toMatchObject({
			blocked_url: "https://evil.example/x.js",
			directive: "script-src-elem",
		});
	});

	test("refuses a body that is not a report", async () => {
		let { response } = await post("not json", "text/plain");

		expect(response.status).toBe(400);
	});
});
