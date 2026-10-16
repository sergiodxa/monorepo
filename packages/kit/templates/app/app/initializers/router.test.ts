/**
 * The router's own middleware, checked through a request's log record: what every page and
 * endpoint gets before its controller runs.
 */

import { Log } from "@sdxc/logger";
import { describe, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";

/** Fetches `request` through the router and answers the log record it wrote. */
async function record(request: Request) {
	let records: Array<Readonly<Record<string, unknown>>> = [];
	let log = new Log({ kind: "request", sink: (written) => records.push(written) });
	await log.run(() => createWebRouter().fetch(request));
	return records[0];
}

describe("router", () => {
	test("continues the caller's W3C trace", async () => {
		let written = await record(
			new Request("https://example.com/api/health", {
				headers: { traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" },
			}),
		);

		expect(written).toMatchObject({
			trace_id: "4bf92f3577b34da6a3ce929d0e0e4736",
			parent_span_id: "00f067aa0ba902b7",
		});
	});
});
