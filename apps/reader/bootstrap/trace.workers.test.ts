/**
 * Checks that the app's router joins a caller's trace: a request arriving with a `traceparent`
 * writes its wide event under that trace id, and one arriving without starts a trace of its own,
 * so a request's events can be found from the caller that sent it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:test";
import { afterEach, describe, expect, test, vi } from "vitest";

import application from "~/bootstrap/app";

/** The specification's own example trace, which a caller would send. */
const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";

/** The origin the app is reached at in a test. */
const ORIGIN = "https://reader.test";

afterEach(() => vi.restoreAllMocks());

/** Answers one request through the app and returns the records the logger wrote for it. */
async function recordsFor(headers: Record<string, string>): Promise<Record<string, unknown>[]> {
	let records: Record<string, unknown>[] = [];
	vi.spyOn(console, "log").mockImplementation((record: unknown) => {
		if (typeof record === "object" && record !== null) {
			records.push(record as Record<string, unknown>);
		}
	});

	let router = application({ kv: env.KV, cookieSecret: "test-cookie-secret", secure: false });
	await router.fetch(new Request(new URL("/no-such-page", ORIGIN), { headers }));

	return records;
}

describe("the trace a request is logged under", () => {
	test("is the caller's, when the request carries a traceparent", async () => {
		let records = await recordsFor({
			traceparent: `00-${TRACE_ID}-00f067aa0ba902b7-01`,
		});

		expect(records.some((record) => record.trace_id === TRACE_ID)).toBe(true);
	});

	test("is a fresh one, when the request carries none", async () => {
		let records = await recordsFor({});

		expect(records.some((record) => typeof record.trace_id === "string")).toBe(true);
		expect(records.some((record) => record.trace_id === TRACE_ID)).toBe(false);
	});
});
