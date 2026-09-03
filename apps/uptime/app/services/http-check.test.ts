/**
 * Unit tests for `HttpCheck`, the three-step HTTP check the scheduled job and the ad-hoc
 * ping endpoint share. Each step is exercised on its own, and `run` is checked to agree
 * with calling the three by hand. The Durable Object namespace mock enforces the real
 * binding's jurisdiction rule, so minting from the wrong one fails here as it would in
 * production.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnalyticsEngineMock } from "@sdxc/cloudflare-mocks";

import {
	createAnalyticsEngine,
	createDurableObjectNamespace,
	createEnv,
} from "@sdxc/cloudflare-mocks";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { ContentCheckRule } from "~/app/data/content-check";
import type { GeoFetchDO } from "~/app/do/geo-fetch";
import type { CostResource } from "~/app/lib/cost-rates";
import type { HttpCheckOptions, HttpProbeOutcome } from "~/app/services/http-check";

import { createTestDatabase } from "~/app/lib/test/db";
import { monitors } from "~/database/schema";

/** The `GeoFetchDO` stub `probe` calls through `env.GEO_FETCH.get(id).fetch(...)`. */
let doFetchMock = vi.fn(
	async (_url: string, _init?: RequestInit) =>
		new Response("OK", { status: 200, headers: { "X-Response-Time": "12" } }),
);

/**
 * The `GEO_FETCH` binding, handing every object it routes to the same {@link doFetchMock}.
 * Its `resolutions` are the probes issued so far, in order, one per `get` — each carrying
 * the object's name, region, and jurisdiction, which the sharding and jurisdiction suites assert on.
 */
let geoFetch = createDurableObjectNamespace<GeoFetchDO>(() => ({ fetch: doFetchMock }));

/** The dataset the ledger flushes to, which is where a probe's recorded costs are read back. */
let costs: AnalyticsEngineMock = createAnalyticsEngine();

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({
		GEO_FETCH: geoFetch,
		COSTS: costs,
	}),
	waitUntil: (promise: Promise<unknown>) => promise,
	/** Exists only as the base class `~/app/do/geo-fetch` extends at module load. */
	DurableObject: class {},
}));

let { COST_RESOURCES } = await import("~/app/lib/cost-rates");
let { CostLedger, trackCost } = await import("~/app/services/cost");
let { NO_REDIRECT_HEADER } = await import("~/app/do/geo-fetch");
let { HttpCheck } = await import("./http-check");

type Db = ReturnType<typeof createTestDatabase>["db"];

/** Options for a check, with a plain reachable target unless a test says otherwise. */
function options(overrides: Partial<HttpCheckOptions> = {}): HttpCheckOptions {
	return {
		url: "https://example.com",
		method: "GET",
		expectedStatus: 200,
		degradedAfterMs: 3000,
		timeoutSeconds: 10,
		locationHint: "wnam",
		shardKey: "monitor-1",
		contentChecks: [],
		...overrides,
	};
}

/** A content-check rule as the evaluator takes one. */
function rule(overrides: Partial<ContentCheckRule> = {}): ContentCheckRule {
	return {
		type: "contains",
		value: "token",
		case_sensitive: false,
		is_enabled: true,
		...overrides,
	};
}

/** A probe outcome, healthy unless a test says otherwise. */
function outcome(overrides: Partial<HttpProbeOutcome> = {}): HttpProbeOutcome {
	return {
		responseStatus: 200,
		responseTimeMs: 10,
		doWallTimeMs: 20,
		location: null,
		body: "OK",
		failed: false,
		...overrides,
	};
}

/** The `GeoFetchDO` object names resolved so far, one per probe issued. */
function derivedObjectNames(): string[] {
	return geoFetch.resolutions.map((resolution) => resolution.name);
}

/** The init the stub was last called with, which is where the sent method is read. */
function lastRequestInit(): RequestInit | undefined {
	return doFetchMock.mock.calls[doFetchMock.mock.calls.length - 1]?.[1];
}

/** Runs `body` inside a cost ledger and returns the single point its flush wrote. */
async function flushing(body: () => Promise<void>): Promise<AnalyticsEngineDataPoint | undefined> {
	await trackCost(new CostLedger({ handler: "fetch" }), body);
	return costs.dataPoints[costs.dataPoints.length - 1];
}

function quantity(point: AnalyticsEngineDataPoint | undefined, resource: CostResource): number {
	return point?.doubles?.[COST_RESOURCES.indexOf(resource)] ?? 0;
}

async function seedMonitor(db: Db, overrides: Record<string, unknown> = {}) {
	return await db.create(
		monitors,
		{
			id: crypto.randomUUID(),
			team_id: "team-1",
			author_id: "author-1",
			name: "Example site",
			url: "https://example.com",
			method: "GET",
			expected_status: 200,
			degraded_after_ms: 3000,
			timeout_seconds: 10,
			location_hint: "wnam",
			enabled_at: Date.now(),
			...overrides,
		},
		{ touch: true, returnRow: true },
	);
}

beforeEach(() => {
	doFetchMock.mockReset();
	doFetchMock.mockImplementation(
		async () => new Response("OK", { status: 200, headers: { "X-Response-Time": "12" } }),
	);
	geoFetch.reset();
	costs.reset();
});

describe("HttpCheck probe jurisdiction", () => {
	/** Every value a monitor's `location_hint` — and an ad-hoc ping's region — accepts. */
	let LOCATION_HINTS: DurableObjectLocationHint[] = [
		"wnam",
		"enam",
		"sam",
		"weur",
		"eeur",
		"apac",
		"oc",
		"afr",
		"me",
	];

	test("pins Europe's two hints to the EU jurisdiction and no others", async () => {
		let pinned: string[] = [];

		for (let hint of LOCATION_HINTS) {
			geoFetch.reset();
			await new HttpCheck(options({ locationHint: hint })).probe();
			if (geoFetch.resolutions[0]?.jurisdiction === "eu") pinned.push(hint);
		}

		expect(pinned).toEqual(["weur", "eeur"]);
	});

	test("probes an 'enam' target from North America rather than the EU", async () => {
		await new HttpCheck(options({ locationHint: "enam" })).probe();

		expect(geoFetch.resolutions[0]?.locationHint).toBe("enam");
		expect(geoFetch.resolutions[0]?.jurisdiction).toBeUndefined();
	});

	test("mints an EU-pinned target's id from the EU subnamespace", async () => {
		let result = await new HttpCheck(options({ locationHint: "eeur" })).probe();

		expect(geoFetch.resolutions[0]?.jurisdiction).toBe("eu");
		expect(geoFetch.resolutions[0]?.name).toMatch(/^eeur:[0-7]$/);
		expect(result.failed).toBe(false);
	});
});

describe("HttpCheck probe sharding", () => {
	test("probes through a shard of the target's region", async () => {
		await new HttpCheck(options({ locationHint: "weur" })).probe();

		expect(derivedObjectNames()).toEqual([expect.stringMatching(/^weur:[0-7]$/)]);
	});

	test("sends the same shard key to the same object every time", async () => {
		let check = new HttpCheck(options({ shardKey: "https://example.com/health" }));

		await check.probe();
		await check.probe();
		await new HttpCheck(options({ shardKey: "https://example.com/health" })).probe();

		let names = derivedObjectNames();
		expect(new Set(names).size).toBe(1);
		expect(names).toHaveLength(3);
	});

	test("spreads distinct shard keys across the shards instead of collapsing onto one", async () => {
		/** Fixed keys make this assert the hash's own spread, independent of which uuids come up. */
		for (let index = 0; index < 8; index++) {
			await new HttpCheck(options({ shardKey: `monitor-${index}` })).probe();
		}

		let shards = new Set(derivedObjectNames().map((name) => name.split(":")[1]));
		expect(shards.size).toBeGreaterThanOrEqual(4);
	});
});

describe("HttpCheck probe request", () => {
	test("upgrades a HEAD check to GET so content checks have a body to read", async () => {
		await new HttpCheck(options({ method: "HEAD", contentChecks: [rule()] })).probe();

		expect(lastRequestInit()?.method).toBe("GET");
	});

	test("leaves HEAD alone when there are no content checks", async () => {
		await new HttpCheck(options({ method: "HEAD" })).probe();

		expect(lastRequestInit()?.method).toBe("HEAD");
	});

	test("leaves any other method alone even with content checks", async () => {
		await new HttpCheck(options({ method: "POST", contentChecks: [rule()] })).probe();

		expect(lastRequestInit()?.method).toBe("POST");
	});

	test("reads the response body only when a content check needs one", async () => {
		let response = new Response("has token inside", {
			status: 200,
			headers: { "X-Response-Time": "12" },
		});
		doFetchMock.mockImplementation(async () => response);

		let skipped = await new HttpCheck(options()).probe();

		expect(skipped.body).toBe("");
		expect(response.bodyUsed).toBe(false);

		let read = await new HttpCheck(options({ contentChecks: [rule()] })).probe();

		expect(read.body).toBe("has token inside");
		expect(response.bodyUsed).toBe(true);
	});

	test("sends the configured headers and body through to the target", async () => {
		await new HttpCheck(
			options({ method: "POST", headers: { "X-Token": "secret" }, body: "payload" }),
		).probe();

		expect(doFetchMock.mock.calls[0]?.[0]).toBe("https://example.com");
		/**
		 * A `Headers` instance, since the probe may add `X-No-Redirect` to whatever was passed
		 * in; asserted by lookup so the caller's own header still reads back pinned.
		 */
		let sent = new Headers(lastRequestInit()?.headers);
		expect(sent.get("X-Token")).toBe("secret");
		expect(sent.has(NO_REDIRECT_HEADER)).toBe(false);
		expect(lastRequestInit()?.body).toBe("payload");
	});

	test("reports the response status and the time the object measured", async () => {
		doFetchMock.mockImplementation(
			async () =>
				new Response("OK", {
					status: 201,
					headers: { "X-Response-Time": "42", "X-DO-Wall-Time": "37.5" },
				}),
		);

		let result = await new HttpCheck(options()).probe();

		expect(result).toEqual({
			responseStatus: 201,
			responseTimeMs: 42,
			doWallTimeMs: 37.5,
			location: null,
			body: "",
			failed: false,
		});
	});

	test("reports no wall time rather than zero when the object didn't measure one", async () => {
		let result = await new HttpCheck(options()).probe();

		expect(result.doWallTimeMs).toBeNull();
	});
});

describe("HttpCheck probe failures", () => {
	test("an 'unreachable' response is a failed probe that keeps its wall time", async () => {
		doFetchMock.mockImplementation(
			async () =>
				new Response(null, {
					status: 204,
					headers: { "X-Probe-Outcome": "unreachable", "X-DO-Wall-Time": "10000" },
				}),
		);

		let result = await new HttpCheck(options()).probe();

		expect(result).toEqual({
			responseStatus: null,
			responseTimeMs: null,
			doWallTimeMs: 10_000,
			location: null,
			body: "",
			failed: true,
		});
	});

	test("ignores an 'unreachable' outcome the target set on itself", async () => {
		/**
		 * `GeoFetchDO` overwrites this header on every response it proxies, so a target
		 * echoing it back arrives tagged `responded` and is judged on its status.
		 */
		doFetchMock.mockImplementation(
			async () =>
				new Response("OK", {
					status: 200,
					headers: { "X-Response-Time": "12", "X-Probe-Outcome": "responded" },
				}),
		);

		let result = await new HttpCheck(options()).probe();

		expect(result.failed).toBe(false);
		expect(result.responseStatus).toBe(200);
	});

	test("the configured timeout elapsing is an unreachable target, not a thrown error", async () => {
		doFetchMock.mockImplementation(
			(_url: string, init?: RequestInit) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
				}),
		);

		let result = await new HttpCheck(options({ timeoutSeconds: 0.02 })).probe();

		expect(result.failed).toBe(true);
		expect(result.responseStatus).toBeNull();
		expect(result.responseTimeMs).toBeNull();
		expect(result.doWallTimeMs).toBeNull();
	});

	test("any other stub failure propagates as the infrastructure fault it is", async () => {
		doFetchMock.mockImplementation(async () => {
			throw new Error("Durable Object reset because its code was updated");
		});

		await expect(new HttpCheck(options()).probe()).rejects.toThrow(
			"Durable Object reset because its code was updated",
		);
	});
});

describe("HttpCheck probe cost", () => {
	test("charges one Durable Object request and the wall time it reported", async () => {
		doFetchMock.mockImplementation(
			async () =>
				new Response("OK", {
					status: 200,
					headers: { "X-Response-Time": "12", "X-DO-Wall-Time": "37.5" },
				}),
		);

		let point = await flushing(async () => {
			await new HttpCheck(options()).probe();
		});

		expect(quantity(point, "doRequest")).toBe(1);
		expect(quantity(point, "doDurationMs")).toBe(37.5);
	});

	test("charges the request of a probe that failed part-way, and no wall time", async () => {
		doFetchMock.mockImplementation(
			(_url: string, init?: RequestInit) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
				}),
		);

		let point = await flushing(async () => {
			await new HttpCheck(options({ timeoutSeconds: 0.02 })).probe();
		});

		expect(quantity(point, "doRequest")).toBe(1);
		expect(quantity(point, "doDurationMs")).toBe(0);
	});
});

describe("HttpCheck evaluate", () => {
	test("is vacuously true when there are no rules", () => {
		expect(new HttpCheck(options()).evaluate(outcome({ body: "" }))).toBe(true);
	});

	test("passes when every rule matches the body", () => {
		let check = new HttpCheck({
			...options(),
			contentChecks: [rule({ value: "token" }), rule({ type: "not_contains", value: "error" })],
		});

		expect(check.evaluate(outcome({ body: "has token inside" }))).toBe(true);
	});

	test("fails when a rule doesn't match the body", () => {
		let check = new HttpCheck({ ...options(), contentChecks: [rule({ value: "token" })] });

		expect(check.evaluate(outcome({ body: "nothing here" }))).toBe(false);
	});

	test("delegates to the same matcher a stored monitor's checks use", () => {
		/**
		 * Case sensitivity is `ContentCheck`'s own rule, so a rule differing only in case
		 * proves `evaluate` delegates to it.
		 */
		let check = new HttpCheck({
			...options(),
			contentChecks: [rule({ value: "TOKEN", case_sensitive: true })],
		});

		expect(check.evaluate(outcome({ body: "has token inside" }))).toBe(false);
	});
});

describe("HttpCheck classify", () => {
	test("classifies a failed probe as down", () => {
		let result = new HttpCheck(options()).classify(outcome({ failed: true }), true);

		expect(result).toBe("down");
	});

	test("classifies an unexpected status as down", () => {
		let result = new HttpCheck(options({ expectedStatus: 200 })).classify(
			outcome({ responseStatus: 500 }),
			true,
		);

		expect(result).toBe("down");
	});

	test("classifies failing content checks as down even on the expected status", () => {
		let result = new HttpCheck(options()).classify(outcome(), false);

		expect(result).toBe("down");
	});

	test("classifies a response at the degraded threshold as degraded", () => {
		/** Inclusive threshold: hitting `degradedAfterMs` exactly still counts as degraded. */
		let result = new HttpCheck(options({ degradedAfterMs: 100 })).classify(
			outcome({ responseTimeMs: 100 }),
			true,
		);

		expect(result).toBe("degraded");
	});

	test("classifies a response under the degraded threshold as up", () => {
		let result = new HttpCheck(options({ degradedAfterMs: 100 })).classify(
			outcome({ responseTimeMs: 99 }),
			true,
		);

		expect(result).toBe("up");
	});
});

describe("HttpCheck run", () => {
	test("agrees with probing, evaluating and classifying by hand", async () => {
		doFetchMock.mockImplementation(
			async () =>
				new Response("has token inside", { status: 200, headers: { "X-Response-Time": "10" } }),
		);
		let check = new HttpCheck({ ...options(), contentChecks: [rule({ value: "token" })] });

		let result = await check.run();

		expect(result.status).toBe("up");
		expect(result.contentChecksPassed).toBe(true);
		expect(result.outcome.responseStatus).toBe(200);
		expect(check.evaluate(result.outcome)).toBe(result.contentChecksPassed);
		expect(check.classify(result.outcome, result.contentChecksPassed)).toBe(result.status);
	});

	test("classifies a body that fails its content checks as down", async () => {
		doFetchMock.mockImplementation(
			async () =>
				new Response("nothing here", { status: 200, headers: { "X-Response-Time": "10" } }),
		);
		let check = new HttpCheck({ ...options(), contentChecks: [rule({ value: "token" })] });

		let result = await check.run();

		expect(result.contentChecksPassed).toBe(false);
		expect(result.status).toBe("down");
	});

	test("classifies an unreachable target as down without reading a body", async () => {
		doFetchMock.mockImplementation(
			async () =>
				new Response(null, { status: 204, headers: { "X-Probe-Outcome": "unreachable" } }),
		);

		let result = await new HttpCheck({
			...options(),
			contentChecks: [rule({ value: "token" })],
		}).run();

		expect(result.outcome.failed).toBe(true);
		expect(result.status).toBe("down");
	});
});

describe("HttpCheck.forMonitor", () => {
	test("maps every monitor column onto the option that reads it", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, {
			url: "https://api.example.com/health",
			method: "HEAD",
			expected_status: 204,
			degraded_after_ms: 250,
			timeout_seconds: 7,
			location_hint: "apac",
		});
		let contentChecks = [rule()];

		let check = HttpCheck.forMonitor(monitor, contentChecks);

		expect(check.options).toEqual({
			url: "https://api.example.com/health",
			method: "HEAD",
			expectedStatus: 204,
			degradedAfterMs: 250,
			timeoutSeconds: 7,
			locationHint: "apac",
			shardKey: monitor.id,
			contentChecks,
		});
	});

	test("shards a monitor on its id, so it keeps its object across checks", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { location_hint: "sam" });

		await HttpCheck.forMonitor(monitor, []).probe();
		await HttpCheck.forMonitor(monitor, []).probe();

		expect(HttpCheck.forMonitor(monitor, []).options.shardKey).toBe(monitor.id);
		let [first, second] = derivedObjectNames();
		expect(first).toMatch(/^sam:[0-7]$/);
		expect(second).toBe(first);
	});

	test("a monitor with no content checks probes without asking for a body", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { method: "HEAD" });

		let result = await HttpCheck.forMonitor(monitor, []).run();

		expect(lastRequestInit()?.method).toBe("HEAD");
		expect(result.contentChecksPassed).toBe(true);
		expect(result.status).toBe("up");
	});
});
