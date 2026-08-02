/**
 * Unit tests for `HttpCheck`, the three-step HTTP check the scheduled job and the ad-hoc
 * ping endpoint share. Each step is exercised on its own — `probe` against a faked
 * `GEO_FETCH` binding, `evaluate` against content-check rules, `classify` against the
 * status model — and then `run` is checked to agree with calling the three by hand, which
 * is the property that lets the two callers pick either shape.
 *
 * The cases the probe is pinned on are the ones that have cost something before or would:
 * which location hints get an EU-pinned object (ADR-013 — `enam` was pinned to Europe and
 * measured the wrong continent), that a target keeps its shard forever (ADR-009 — a monitor
 * that drifted would show a step change in its latency series), that a body is fetched only
 * when a rule needs one, and that a timeout is a `down` target while any other stub failure
 * is an infrastructure fault that propagates. That last distinction is what stops an
 * unavailable Durable Object from being recorded as an outage the target never had.
 *
 * The Durable Object namespace is faked rather than the module under test: the fake models
 * the real binding's rule that an id carries the jurisdiction of whichever namespace minted
 * it, so minting from the wrong one fails here exactly as it would in production.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { ContentCheckRule } from "~/app/data/content-check";
import type { CostResource } from "~/app/lib/cost-rates";
import type { HttpCheckOptions, HttpProbeOutcome } from "~/app/services/http-check";

import { createTestDatabase } from "~/app/lib/test/db";
import { monitors } from "~/database/schema";

/** An object id as the fake namespace mints it: the derived name plus its jurisdiction. */
interface FakeObjectId {
	name: string;
	jurisdiction: string | undefined;
}

/** One `get` a probe made: the id it went through and the region it asked for. */
interface Probe extends FakeObjectId {
	locationHint: string | undefined;
}

/** One data point the cost ledger flushed through the `COSTS` binding. */
interface WrittenPoint {
	indexes: string[];
	blobs: string[];
	doubles: number[];
}

/** The `GeoFetchDO` stub `probe` calls through `env.GEO_FETCH.get(id).fetch(...)`. */
let doFetchMock = mock(
	async (_url: string, _init?: RequestInit) =>
		new Response("OK", { status: 200, headers: { "X-Response-Time": "12" } }),
);
let doStub = { fetch: doFetchMock };

/** Records the object names a probe derives, which is what the sharding suite asserts. */
let idFromNameMock = mock(
	(name: string, jurisdiction?: string): FakeObjectId => ({ name, jurisdiction }),
);

/** The probes issued so far, in order, one per `get`. */
let probes: Probe[] = [];

/** Points the ledger wrote, which is where the probe's recorded costs are read back. */
let points: WrittenPoint[] = [];

/**
 * A fake `DurableObjectNamespace`, optionally restricted to a jurisdiction.
 *
 * A jurisdiction is a property of the *id*, stamped on by whichever (sub)namespace minted
 * it, and `get` errors when the id's jurisdiction differs from the namespace's. That rule
 * is modelled here rather than accepting any id, because it is the whole reason the EU
 * branch mints its id from the subnamespace instead of from `env.GEO_FETCH`.
 *
 * @param jurisdiction Jurisdiction this namespace is restricted to, none when omitted.
 * @returns A stand-in for `env.GEO_FETCH` handing out {@link doStub}.
 */
function makeGeoFetchNamespace(jurisdiction?: string) {
	return {
		idFromName: (name: string) => idFromNameMock(name, jurisdiction),
		jurisdiction: (value: string) => makeGeoFetchNamespace(value),
		get(id: FakeObjectId, options?: { locationHint?: string }) {
			if (id.jurisdiction !== jurisdiction) {
				throw new Error(
					`Jurisdiction mismatch: id ${id.jurisdiction ?? "none"}, namespace ${jurisdiction ?? "none"}`,
				);
			}

			probes.push({ ...id, locationHint: options?.locationHint });
			return doStub;
		},
	};
}

let fakeGeoFetchNamespace = makeGeoFetchNamespace();

mock.module("cloudflare:workers", () => ({
	env: {
		GEO_FETCH: fakeGeoFetchNamespace,
		COSTS: { writeDataPoint: (point: WrittenPoint) => points.push(point) },
	},
	waitUntil: (promise: Promise<unknown>) => promise,
	/** Never instantiated here; `~/app/do/geo-fetch` extends it at module load. */
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

/** The `GeoFetchDO` object names derived so far, one per probe issued. */
function derivedObjectNames(): string[] {
	return idFromNameMock.mock.calls.map(([name]) => name);
}

/** The init the stub was last called with, which is where the sent method is read. */
function lastRequestInit(): RequestInit | undefined {
	return doFetchMock.mock.calls[doFetchMock.mock.calls.length - 1]?.[1];
}

/** Runs `body` inside a cost ledger and returns the single point its flush wrote. */
async function flushing(body: () => Promise<void>): Promise<WrittenPoint | undefined> {
	await trackCost(new CostLedger({ handler: "fetch" }), body);
	return points[points.length - 1];
}

/** The quantity a written point recorded for one resource. */
function quantity(point: WrittenPoint | undefined, resource: CostResource): number {
	return point?.doubles[COST_RESOURCES.indexOf(resource)] ?? 0;
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
	idFromNameMock.mockClear();
	probes.length = 0;
	points.length = 0;
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
			probes.length = 0;
			await new HttpCheck(options({ locationHint: hint })).probe();
			if (probes[0]?.jurisdiction === "eu") pinned.push(hint);
		}

		expect(pinned).toEqual(["weur", "eeur"]);
	});

	test("probes an 'enam' target from North America rather than the EU", async () => {
		// Eastern *North America*: the region it asked for, and no jurisdiction to override
		// it. Pinning it to the EU moved the probe to another continent, and every response
		// time it recorded with it.
		await new HttpCheck(options({ locationHint: "enam" })).probe();

		expect(probes[0]?.locationHint).toBe("enam");
		expect(probes[0]?.jurisdiction).toBeUndefined();
	});

	test("mints an EU-pinned target's id from the EU subnamespace", async () => {
		// An id minted off the base namespace carries no jurisdiction, and handing that to
		// the EU subnamespace's `get` is the mismatch the real binding rejects.
		let result = await new HttpCheck(options({ locationHint: "eeur" })).probe();

		expect(probes[0]?.jurisdiction).toBe("eu");
		expect(probes[0]?.name).toMatch(/^eeur:[0-7]$/);
		expect(result.failed).toBe(false);
	});
});

describe("HttpCheck probe sharding", () => {
	test("probes through a shard of the target's region", async () => {
		await new HttpCheck(options({ locationHint: "weur" })).probe();

		// The region is still the location hint; eight shards per region, hence 0-7.
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
		// Fixed keys so this asserts the hash's spread rather than which uuids came up.
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
		// A `Headers` instance rather than the object passed in, because the probe may add
		// `X-No-Redirect` to it. Asserted by lookup so the caller's header is still pinned.
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
		// A measurement that didn't happen is not a handler that took no time.
		let result = await new HttpCheck(options()).probe();

		expect(result.doWallTimeMs).toBeNull();
	});
});

describe("HttpCheck probe failures", () => {
	test("an 'unreachable' response is a failed probe that keeps its wall time", async () => {
		// How `GeoFetchDO` reports a request it couldn't complete. The wall time is kept
		// anyway: a probe that failed still occupied the object, and that is the expensive
		// case worth watching.
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
		// `GeoFetchDO` overwrites the header on every response it proxies, so a target
		// echoing it back arrives tagged `responded` and is judged on its status.
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
		// Nothing was learned about the target, so recording a `down` it didn't earn would
		// be a lie the caller can never tell apart from a real outage.
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

		// Billed for the call it made; nothing honest to charge for a window nobody measured.
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
		// Case sensitivity is the evaluator's rule, not this class's, so a rule that only
		// differs in case proves the delegation rather than a reimplementation.
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
		// At, not past: the threshold is inclusive.
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
