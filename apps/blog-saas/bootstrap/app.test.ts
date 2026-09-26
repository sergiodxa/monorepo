/**
 * Tests that the dashboard router gives every request a trace: the request's wide event
 * carries `trace_id` and `span_id`, and a caller's `traceparent` is continued, so the
 * record joins the trace the caller started.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createD1Database, createEnv } from "@sdxc/cloudflare-mocks";
import { createLogger } from "@sdxc/logger";
import { beforeEach, describe, expect, test, vi } from "vitest";

const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";
const PARENT_ID = "00f067aa0ba902b7";

/** The records the router's logger wrote during the current test. */
let records: Record<string, unknown>[] = [];

/** Installed above the router's import, since the modules it loads read `env` on load. */
vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Cloudflare.Env>({
		PLATFORM_DOMAIN: "blog.test",
		PLATFORM_DB: createD1Database(),
		COOKIE_SESSION_SECRET: "cookie-secret",
		POLAR_ACCESS_TOKEN: "polar-token",
		POLAR_PRODUCT_ID: "product-1",
	}),
	DurableObject: class {},
}));

/** Replaces the worker's console logger with one whose records the test reads. */
vi.doMock("./logger", () => ({
	logger: createLogger({ service: "blog-saas", sink: (record) => void records.push(record) }),
}));

let { createDashboardRouter } = await import("./app");

beforeEach(() => {
	records = [];
});

describe("request tracing", () => {
	test("stamps a new trace on the request's log when the caller sends none", async () => {
		let response = await createDashboardRouter().fetch(new Request("https://blog.test/health"));

		expect(response.status).toBe(200);
		expect(records).toHaveLength(1);
		expect(records[0]).toMatchObject({
			kind: "request",
			trace_id: expect.stringMatching(/^[0-9a-f]{32}$/),
			span_id: expect.stringMatching(/^[0-9a-f]{16}$/),
		});
		expect(records[0]).not.toHaveProperty("parent_span_id");
	});

	test("continues the caller's traceparent", async () => {
		await createDashboardRouter().fetch(
			new Request("https://blog.test/health", {
				headers: { traceparent: `00-${TRACE_ID}-${PARENT_ID}-01` },
			}),
		);

		expect(records[0]).toMatchObject({
			trace_id: TRACE_ID,
			parent_span_id: PARENT_ID,
			trace_flags: "01",
		});
		expect(records[0]?.span_id).not.toBe(PARENT_ID);
	});
});
