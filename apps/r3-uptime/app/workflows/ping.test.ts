/**
 * Unit tests for the `Ping` workflow's single-run happy paths: an "up" result
 * (matching `expected_status`, fast) writes a `monitor_results` row with no errors,
 * and a "down" result (mismatched status) does too. `env.GEO_FETCH`'s Durable Object
 * stub is faked to control the region-hinted fetch's response per test, and
 * `env.DB` is a real in-memory SQLite database (through the identity-mocked
 * `createD1DatabaseAdapter`) so the workflow's own `db.create`/`db.findOne` calls
 * run against real SQL. Alert-dispatch side effects (`~/app/services/alerts`) are
 * out of scope here — that module has its own tests — so only the recorded
 * `monitor_results` row is asserted on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Database as SqliteDatabase } from "bun:sqlite";
import { beforeEach, describe, expect, mock, test } from "bun:test";

import { ServiceContainer } from "@pkg/service-container";
import { createDatabase } from "remix/data-table";
import { Resend } from "resend";

import { applyMigrations, createBunSqliteDatabaseAdapter } from "~/app/lib/test/db";
import { monitorResults } from "~/database/schema";

let sqliteDb = new SqliteDatabase(":memory:");
applyMigrations(sqliteDb);
let adapter = createBunSqliteDatabaseAdapter(sqliteDb);

/** The `GeoFetchDO` stub the workflow calls through `env.GEO_FETCH.get(id).fetch(...)`. */
let doFetchMock = mock(
	async () => new Response("OK", { status: 200, headers: { "X-Response-Time": "12" } }),
);
let doStub = { fetch: () => doFetchMock() };
let fakeGeoFetchNamespace = {
	idFromName: (name: string) => ({ name }),
	jurisdiction: () => fakeGeoFetchNamespace,
	get: () => doStub,
};

mock.module("@pkg/data-table-d1", () => ({
	createD1DatabaseAdapter: (db: unknown) => db,
}));

mock.module("cloudflare:workers", () => ({
	env: {
		DB: adapter,
		GEO_FETCH: fakeGeoFetchNamespace,
		PING_RESULTS: { writeDataPoint: () => {} },
		CLOUDFLARE_ACCOUNT_ID: "test",
		CLOUDFLARE_ANALYTICS_TOKEN: "test",
		KV: { get: async () => null, put: async () => {} },
	},
	WorkflowEntrypoint: class {
		constructor(..._args: unknown[]) {}
	},
}));

let { Ping } = await import("./ping");
/**
 * Imported dynamically, after the `cloudflare:workers` mock above, since `Monitor`
 * itself reads `env` at module load and a static import would be hoisted before it.
 */
let { default: Monitor } = await import("~/app/data/monitor");

/** The same `bun:sqlite` instance the identity-mocked adapter above wraps. */
let db = createDatabase(adapter, { now: () => Date.now() });

/** Mirrors Cloudflare's real `step.do(name, fn)` / `step.do(name, options, fn)` overloads. */
function fakeStep() {
	return {
		do: async (_name: string, optsOrFn: unknown, maybeFn?: unknown) => {
			let fn = typeof optsOrFn === "function" ? optsOrFn : maybeFn;
			return await (fn as () => unknown)();
		},
	};
}

/** A container with a fake `Resend` registered, since "send alerts" resolves one from the scope. */
function makeContainer() {
	let container = new ServiceContainer();
	container.singleton(Resend, () => new Resend("re_test_key"));
	return container;
}

async function seedMonitor(overrides: Record<string, unknown> = {}) {
	return await Monitor.create(db, "team-1", "author-1", {
		name: "Example site",
		url: "https://example.com",
		method: "GET",
		expected_status: 200,
		degraded_after_ms: 3000,
		timeout_seconds: 10,
		location_hint: "wnam",
		...overrides,
	} as never);
}

beforeEach(() => {
	doFetchMock.mockClear();
});

describe("Ping workflow", () => {
	test("records an 'up' result when the response matches the expected status", async () => {
		let monitor = await seedMonitor();
		doFetchMock.mockImplementation(
			async () => new Response("OK", { status: 200, headers: { "X-Response-Time": "12" } }),
		);

		let workflow = new Ping({} as never, {} as never);
		let event = { instanceId: "test-instance-up", payload: { monitorId: monitor.id } } as never;

		await makeContainer().scope(() => workflow.run(event, fakeStep() as never));

		let result = await db.findOne(monitorResults, { where: { monitor_id: monitor.id } });
		expect(result).not.toBeNull();
		expect(result?.response_status).toBe(200);
		expect(result?.response_time_ms).toBe(12);
	});

	test("records a 'down' result when the response status doesn't match the expected one", async () => {
		let monitor = await seedMonitor({ expected_status: 200 });
		doFetchMock.mockImplementation(
			async () => new Response("Error", { status: 500, headers: { "X-Response-Time": "5" } }),
		);

		let workflow = new Ping({} as never, {} as never);
		let event = { instanceId: "test-instance-down", payload: { monitorId: monitor.id } } as never;

		await makeContainer().scope(() => workflow.run(event, fakeStep() as never));

		let result = await db.findOne(monitorResults, { where: { monitor_id: monitor.id } });
		expect(result).not.toBeNull();
		expect(result?.response_status).toBe(500);
		expect(result?.response_time_ms).toBe(5);
	});

	test("returns early without recording a result when the monitor doesn't exist", async () => {
		let workflow = new Ping({} as never, {} as never);
		let event = { instanceId: "test-instance-missing", payload: { monitorId: "does-not-exist" } };

		await makeContainer().scope(() => workflow.run(event as never, fakeStep() as never));

		let result = await db.findOne(monitorResults, { where: { monitor_id: "does-not-exist" } });
		expect(result).toBeNull();
		expect(doFetchMock).not.toHaveBeenCalled();
	});
});
