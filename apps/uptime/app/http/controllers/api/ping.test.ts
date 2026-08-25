/**
 * Tests `POST /api/v1/ping`, the ad-hoc check endpoint: its guards (`ping:trigger` scope,
 * a per-key budget, an entitlement gate), each check type's request contract, and the
 * response envelope. A target that is down, refusing connections, or not resolving still
 * answers HTTP 200, so `data.ping.status` in the JSON body is the source of truth for a
 * target's health, and a ping's only persisted effect is its own ad-hoc result event.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { IngestEvent, PolarClient as PolarClientType } from "@pkg/polar";

import {
	createAnalyticsEngine,
	createDurableObjectNamespace,
	createEnv,
	createRateLimit,
} from "@pkg/cloudflare-mocks";
import { PolarClient } from "@pkg/polar";
import { ServiceContainer } from "@pkg/service-container";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { GeoFetchDO } from "~/app/do/geo-fetch";
import type { ApiKeyScope } from "~/database/schema";

import ApiKey from "~/app/data/api-key";
import { createTestDatabase } from "~/app/lib/test/db";
import { createRevokedSubscription } from "~/app/lib/test/polar";
import {
	alertEvents,
	alerts,
	dnsMonitors,
	monitorResults,
	monitors,
	tcpMonitors,
	teams,
} from "~/database/schema";
import routes from "~/routes/web";

/** The binding's declared `simple.limit` in `wrangler.jsonc`, mirrored by the controller. */
let CALLER_LIMIT = 60;

/** The `GeoFetchDO` stub the HTTP check probes through. */
let doFetchMock = vi.fn(
	async (_url: string, _init?: RequestInit) =>
		new Response("OK", { status: 200, headers: { "X-Response-Time": "12" } }),
);

/** The `GEO_FETCH` binding, answering every probe with {@link doFetchMock}. */
let geoFetch = createDurableObjectNamespace<GeoFetchDO>(() => ({ fetch: doFetchMock }));

/** The region each probe asked for, so the endpoint's default region can be asserted. */
function probedLocationHints(): (string | undefined)[] {
	return geoFetch.resolutions.map((resolution) => resolution.locationHint);
}

/** The `PING_RESULTS` dataset, recording the data point each served ping writes. */
let pingResults = createAnalyticsEngine();

/** The `COSTS` dataset; nothing here runs inside a tracked unit of work, so it stays empty. */
let costs = createAnalyticsEngine();

/**
 * The `RATE_LIMITER` binding, counting per key against {@link CALLER_LIMIT}. The clock is
 * frozen so the fixed window never rolls over mid-test: the budget test spends sixty
 * requests, and a rollover between them would turn the expected refusal into a pass.
 */
let rateLimiter = createRateLimit({ limit: CALLER_LIMIT, now: () => 0 });

/** Promises the handler deferred, drained by {@link dispatch} before it returns. */
let deferred: Promise<unknown>[] = [];

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({
		GEO_FETCH: geoFetch,
		PING_RESULTS: pingResults,
		COSTS: costs,
		RATE_LIMITER: rateLimiter,
	}),
	waitUntil: (promise: Promise<unknown>) => {
		deferred.push(promise);
	},
	/** Never instantiated here; `~/app/do/geo-fetch` extends it at module load. */
	DurableObject: class {},
}));

/**
 * How the next TCP check's socket settles, produced by a factory. Each refusal is created
 * inside `connect` at the moment the check awaits it, keeping it handled from the instant
 * it exists.
 */
let openSocket: () => Promise<void> = async () => {};

vi.doMock("cloudflare:sockets", () => ({
	connect: () => ({ opened: openSocket(), close: async () => {} }),
}));

let { default: pingCreate } = await import("./ping");

/** Both guards log through the immediate logger, silenced here so assertions read the response bodies. */
vi.spyOn(console, "info").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});

type Db = ReturnType<typeof createTestDatabase>["db"];

/** Event batches the endpoint handed the billing client, one entry per call. */
let ingested: IngestEvent[][] = [];

let polar = {
	async ingestEventsSafe(events: IngestEvent[]) {
		ingested.push(events);
		return true;
	},
} as unknown as PolarClientType;

async function createTeamRow(db: Db) {
	return await db.create(
		teams,
		{
			id: crypto.randomUUID(),
			owner_id: crypto.randomUUID(),
			name: "Acme",
			slug: `acme-${crypto.randomUUID()}`,
			logo: null,
		},
		{ touch: true, returnRow: true },
	);
}

async function createApiKey(db: Db, teamId: string, scopes: ApiKeyScope[] = ["ping:trigger"]) {
	let { key } = await ApiKey.create(db, teamId, { name: "test", scopes, expires_at: null });
	return key;
}

/** An HTTP monitor watching the same target a ping asks about, for the no-effects suite. */
async function seedMonitor(db: Db, teamId: string) {
	return await db.create(
		monitors,
		{
			id: crypto.randomUUID(),
			team_id: teamId,
			author_id: crypto.randomUUID(),
			name: "Example site",
			url: "https://example.com",
			method: "GET",
			enabled_at: Date.now(),
		},
		{ touch: true, returnRow: true },
	);
}

/** A team with a `ping:trigger` key and no subscription rows, which is allowed to ping. */
async function createCaller(db: Db) {
	let team = await createTeamRow(db);
	let key = await createApiKey(db, team.id);
	return { team, key };
}

/**
 * Sends a ping request through the router. The handler defers its billing ingest
 * under `waitUntil`, so this drains it explicitly before returning, letting
 * assertions observe the ingested event.
 */
async function dispatch(
	db: Db,
	request: { key?: string; body?: Record<string, unknown> | unknown[] },
) {
	let router = createRouter({ middleware: [asyncContext()] });
	router.map(routes.api.v1.ping, pingCreate);

	let container = new ServiceContainer();
	container.singleton(Database, () => db);
	container.instance(PolarClient, polar);

	let headers: Record<string, string> = { "content-type": "application/json" };
	if (request.key !== undefined) headers.Authorization = `Bearer ${request.key}`;

	let httpRequest = new Request(`https://uptime.test${routes.api.v1.ping.href()}`, {
		method: "POST",
		headers,
		body: JSON.stringify(request.body ?? {}),
	});

	let response = await container.scope(() => router.fetch(httpRequest));
	await Promise.all(deferred.splice(0));
	return response;
}

/**
 * The `data.ping` payload of a served request. `id` is typed as a string because the
 * billing assertions read it directly; the rest of the payload stays unknown so each
 * assertion states what it expects.
 */
async function pingBody(response: Response) {
	let body = (await response.json()) as {
		data: { ping: Record<string, unknown> & { id: string } };
		meta: { requestId: string; timestamp: string };
	};
	return body;
}

/** The error envelope of a refused request. */
async function errorBody(response: Response) {
	return (await response.json()) as { error: { code: string; message: string } };
}

/** The DNS-over-HTTPS resolver the DNS check queries. */
let DOH_URL = "https://cloudflare-dns.com/dns-query";

/**
 * MSW server standing in for the DNS resolver. Every other check type goes through a
 * binding, so `onUnhandledRequest: "error"` also pins that none of them reach the network.
 */
let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Makes the resolver answer every DoH query with `values`. */
function resolveDnsWith(values: string[]) {
	server.use(
		http.get(DOH_URL, () =>
			HttpResponse.json({
				Status: 0,
				Answer: values.map((data) => ({ name: "example.com", type: 1, TTL: 300, data })),
			}),
		),
	);
}

beforeEach(() => {
	doFetchMock.mockReset();
	doFetchMock.mockImplementation(
		async () => new Response("OK", { status: 200, headers: { "X-Response-Time": "12" } }),
	);
	openSocket = async () => {};
	geoFetch.reset();
	pingResults.reset();
	costs.reset();
	rateLimiter.reset();
	ingested.length = 0;
	deferred.length = 0;
});

describe("POST /api/v1/ping authentication", () => {
	test("returns 401 for a missing Authorization header", async () => {
		let { db } = createTestDatabase();

		let response = await dispatch(db, { body: { type: "http", url: "https://example.com" } });

		expect(response.status).toBe(401);
		expect((await errorBody(response)).error.code).toBe("UNAUTHORIZED");
		expect(doFetchMock).not.toHaveBeenCalled();
	});

	test("returns 403 for a valid key without the ping:trigger scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:read"]);

		let response = await dispatch(db, {
			key,
			body: { type: "http", url: "https://example.com" },
		});

		expect(response.status).toBe(403);
		expect((await errorBody(response)).error.code).toBe("FORBIDDEN");
		expect(doFetchMock).not.toHaveBeenCalled();
	});
});

describe("POST /api/v1/ping entitlement", () => {
	/** A 402 refusal short-circuits ahead of the probe, the dataset write, and the billing call. */
	test("returns 402 for an owner whose subscription is known to be inactive", async () => {
		let { db } = createTestDatabase();
		let { team, key } = await createCaller(db);
		await createRevokedSubscription(db, team.owner_id);

		let response = await dispatch(db, {
			key,
			body: { type: "http", url: "https://example.com" },
		});

		expect(response.status).toBe(402);
		expect((await errorBody(response)).error.code).toBe("SUBSCRIPTION_REQUIRED");
		expect(doFetchMock).not.toHaveBeenCalled();
		expect(pingResults.dataPoints).toHaveLength(0);
		expect(ingested).toHaveLength(0);
	});

	/**
	 * Failing open is deliberate: an inconclusive entitlement lookup serves the
	 * request, since refusing a paying customer is the costlier mistake.
	 */
	test("serves an owner with no subscription rows at all, failing open", async () => {
		let { db } = createTestDatabase();
		let { key } = await createCaller(db);

		let response = await dispatch(db, {
			key,
			body: { type: "http", url: "https://example.com" },
		});

		expect(response.status).toBe(200);
		expect((await pingBody(response)).data.ping.status).toBe("up");
	});
});

describe("POST /api/v1/ping validation", () => {
	/** Every rejection carries the same envelope, so the assertion is shared. */
	async function expectValidationError(db: Db, key: string, body: Record<string, unknown>) {
		let response = await dispatch(db, { key, body });

		expect(response.status).toBe(400);
		expect((await errorBody(response)).error.code).toBe("VALIDATION_ERROR");
		expect(doFetchMock).not.toHaveBeenCalled();
		expect(pingResults.dataPoints).toHaveLength(0);
	}

	test("rejects an http ping with no url", async () => {
		let { db } = createTestDatabase();
		let { key } = await createCaller(db);

		await expectValidationError(db, key, { type: "http" });
	});

	test("rejects an http ping whose url isn't one", async () => {
		let { db } = createTestDatabase();
		let { key } = await createCaller(db);

		await expectValidationError(db, key, { type: "http", url: "not-a-url" });
	});

	test("rejects a dns ping with no domain", async () => {
		let { db } = createTestDatabase();
		let { key } = await createCaller(db);

		await expectValidationError(db, key, { type: "dns", recordType: "A" });
	});

	test("rejects a tcp ping with an out-of-range port", async () => {
		let { db } = createTestDatabase();
		let { key } = await createCaller(db);

		await expectValidationError(db, key, { type: "tcp", host: "example.com", port: 999_999 });
	});

	test("rejects a ping of an unknown type", async () => {
		let { db } = createTestDatabase();
		let { key } = await createCaller(db);

		await expectValidationError(db, key, { type: "icmp", host: "example.com" });
	});
});

describe("POST /api/v1/ping http", () => {
	test("answers with the check's status, timing and http-specific fields", async () => {
		let { db } = createTestDatabase();
		let { key } = await createCaller(db);
		doFetchMock.mockImplementation(
			async () =>
				new Response("has token inside", { status: 200, headers: { "X-Response-Time": "42" } }),
		);

		let response = await dispatch(db, {
			key,
			body: {
				type: "http",
				url: "https://example.com/health",
				contentChecks: [{ type: "contains", value: "token" }],
			},
		});

		expect(response.status).toBe(200);
		let body = await pingBody(response);
		expect(body.data.ping).toEqual({
			id: expect.any(String),
			type: "http",
			status: "up",
			responseTimeMs: 42,
			checkedAt: expect.any(String),
			responseStatus: 200,
			contentChecksPassed: true,
		});
		expect(body.meta.requestId).toEqual(expect.any(String));
		expect(body.meta.timestamp).toEqual(expect.any(String));
	});

	test("reports a failing content check as a down ping rather than an error", async () => {
		let { db } = createTestDatabase();
		let { key } = await createCaller(db);
		doFetchMock.mockImplementation(
			async () =>
				new Response("nothing here", { status: 200, headers: { "X-Response-Time": "9" } }),
		);

		let response = await dispatch(db, {
			key,
			body: {
				type: "http",
				url: "https://example.com",
				contentChecks: [{ type: "contains", value: "token" }],
			},
		});

		expect(response.status).toBe(200);
		let { data } = await pingBody(response);
		expect(data.ping.status).toBe("down");
		expect(data.ping.contentChecksPassed).toBe(false);
	});

	/**
	 * `GeoFetchDO` reports a target it couldn't reach as a 204 response with an
	 * `X-Probe-Outcome: unreachable` header.
	 */
	test("still answers 200 when the target is unreachable", async () => {
		let { db } = createTestDatabase();
		let { key } = await createCaller(db);
		doFetchMock.mockImplementation(
			async () =>
				new Response(null, { status: 204, headers: { "X-Probe-Outcome": "unreachable" } }),
		);

		let response = await dispatch(db, { key, body: { type: "http", url: "https://example.com" } });

		expect(response.status).toBe(200);
		let { data } = await pingBody(response);
		expect(data.ping.status).toBe("down");
		expect(data.ping.responseStatus).toBeNull();
		expect(data.ping.responseTimeMs).toBe(0);
	});

	test("applies the documented defaults for everything the body left out", async () => {
		let { db } = createTestDatabase();
		let { key } = await createCaller(db);

		let response = await dispatch(db, { key, body: { type: "http", url: "https://example.com" } });

		expect(doFetchMock.mock.calls[0]?.[1]?.method).toBe("GET");
		expect(probedLocationHints()).toEqual(["wnam"]);
		expect((await pingBody(response)).data.ping.status).toBe("up");
	});

	test("defaults the degraded threshold to five seconds", async () => {
		let { db } = createTestDatabase();
		let { key } = await createCaller(db);
		doFetchMock.mockImplementation(
			async () => new Response("OK", { status: 200, headers: { "X-Response-Time": "5000" } }),
		);

		let response = await dispatch(db, { key, body: { type: "http", url: "https://example.com" } });

		expect((await pingBody(response)).data.ping.status).toBe("degraded");
	});

	/**
	 * A `Response` with a null-body status like 204 accepts only a `null` body, so
	 * the mock passes `null` here.
	 */
	test("probes from the region the body asked for, with the status it expects", async () => {
		let { db } = createTestDatabase();
		let { key } = await createCaller(db);
		doFetchMock.mockImplementation(
			async () => new Response(null, { status: 204, headers: { "X-Response-Time": "8" } }),
		);

		let response = await dispatch(db, {
			key,
			body: {
				type: "http",
				url: "https://example.com",
				method: "HEAD",
				expectedStatus: 204,
				region: "apac",
			},
		});

		expect(doFetchMock.mock.calls[0]?.[1]?.method).toBe("HEAD");
		expect(probedLocationHints()).toEqual(["apac"]);
		expect((await pingBody(response)).data.ping.status).toBe("up");
	});
});

describe("POST /api/v1/ping dns", () => {
	test("answers with the resolved value and no error", async () => {
		let { db } = createTestDatabase();
		let { key } = await createCaller(db);
		resolveDnsWith(["1.2.3.4"]);

		let response = await dispatch(db, { key, body: { type: "dns", domain: "example.com" } });

		expect(response.status).toBe(200);
		let { data } = await pingBody(response);
		expect(data.ping).toEqual({
			id: expect.any(String),
			type: "dns",
			status: "ok",
			responseTimeMs: expect.any(Number),
			checkedAt: expect.any(String),
			resolvedValue: "1.2.3.4",
			errorMessage: null,
		});
	});

	/**
	 * A stateless caller has no prior check to compare against, so `changed` here
	 * only ever means the resolved value differs from the given `expectedValue`.
	 */
	test("compares against the expected value the caller gave, with no history", async () => {
		let { db } = createTestDatabase();
		let { key } = await createCaller(db);
		resolveDnsWith(["9.9.9.9"]);

		let response = await dispatch(db, {
			key,
			body: { type: "dns", domain: "example.com", expectedValue: "1.2.3.4" },
		});

		expect(response.status).toBe(200);
		let { data } = await pingBody(response);
		expect(data.ping.status).toBe("changed");
		expect(data.ping.resolvedValue).toBe("9.9.9.9");
	});

	test("still answers 200 when the lookup fails", async () => {
		let { db } = createTestDatabase();
		let { key } = await createCaller(db);
		server.use(http.get(DOH_URL, () => HttpResponse.error()));

		let response = await dispatch(db, { key, body: { type: "dns", domain: "example.com" } });

		expect(response.status).toBe(200);
		let { data } = await pingBody(response);
		expect(data.ping.status).toBe("error");
		expect(data.ping.errorMessage).toBe("Failed to fetch");
	});
});

describe("POST /api/v1/ping tcp", () => {
	test("answers with an up status and no error when the socket opens", async () => {
		let { db } = createTestDatabase();
		let { key } = await createCaller(db);

		let response = await dispatch(db, {
			key,
			body: { type: "tcp", host: "redis.example.com", port: 6379 },
		});

		expect(response.status).toBe(200);
		let { data } = await pingBody(response);
		expect(data.ping).toEqual({
			id: expect.any(String),
			type: "tcp",
			status: "up",
			responseTimeMs: expect.any(Number),
			checkedAt: expect.any(String),
			errorMessage: null,
		});
	});

	test("still answers 200 when the connection is refused", async () => {
		let { db } = createTestDatabase();
		let { key } = await createCaller(db);
		openSocket = async () => {
			throw new Error("Connection refused");
		};

		let response = await dispatch(db, {
			key,
			body: { type: "tcp", host: "redis.example.com", port: 6379 },
		});

		expect(response.status).toBe(200);
		let { data } = await pingBody(response);
		expect(data.ping.status).toBe("down");
		expect(data.ping.errorMessage).toBe("Connection refused");
	});
});

describe("POST /api/v1/ping side effects", () => {
	test("stores nothing monitor-shaped and dispatches no alert", async () => {
		let { db } = createTestDatabase();
		let { key } = await createCaller(db);

		let response = await dispatch(db, { key, body: { type: "http", url: "https://example.com" } });
		expect(response.status).toBe(200);

		expect(await db.count(monitors)).toBe(0);
		expect(await db.count(monitorResults)).toBe(0);
		expect(await db.count(dnsMonitors)).toBe(0);
		expect(await db.count(tcpMonitors)).toBe(0);
		expect(await db.count(alerts)).toBe(0);
		expect(await db.count(alertEvents)).toBe(0);
	});

	/**
	 * An ad-hoc ping affects only its own ping-result stream, so a monitor already
	 * watching the same target keeps its history exactly where it was.
	 */
	test("leaves an existing monitor of the same target untouched", async () => {
		let { db } = createTestDatabase();
		let { team, key } = await createCaller(db);
		let monitor = await seedMonitor(db, team.id);

		let response = await dispatch(db, { key, body: { type: "http", url: monitor.url } });
		expect(response.status).toBe(200);

		let unchanged = await db.findOne(monitors, { where: { id: monitor.id } });
		expect(unchanged?.last_status).toBeNull();
		expect(unchanged?.last_checked_at).toBeNull();
		expect(unchanged?.last_response_time_ms).toBeNull();
		expect(await db.count(monitorResults)).toBe(0);
	});

	/**
	 * Every ad-hoc ping is recorded under one shared monitor id, keeping a team's
	 * ad-hoc traffic as a single low-cardinality stream in the dataset.
	 */
	test("records one ad-hoc data point for the calling team", async () => {
		let { db } = createTestDatabase();
		let { team, key } = await createCaller(db);

		await dispatch(db, { key, body: { type: "http", url: "https://example.com" } });

		expect(pingResults.dataPoints).toHaveLength(1);
		expect(pingResults.dataPoints[0]?.blobs).toEqual(["adhoc", "adhoc", "up"]);
		expect(pingResults.dataPoints[0]?.indexes).toEqual([team.id]);
	});

	test("bills exactly one ping, against the team and against no monitor", async () => {
		let { db } = createTestDatabase();
		let { team, key } = await createCaller(db);

		let response = await dispatch(db, { key, body: { type: "http", url: "https://example.com" } });
		let { data } = await pingBody(response);

		expect(ingested).toHaveLength(1);
		expect(ingested[0]).toEqual([
			{
				name: "ping",
				externalCustomerId: team.owner_id,
				externalId: `ping:${data.ping.id}`,
				metadata: { teamId: team.id, type: "adhoc" },
			},
		]);
	});

	test("bills a failing ping too, since the work was done either way", async () => {
		let { db } = createTestDatabase();
		let { key } = await createCaller(db);
		doFetchMock.mockImplementation(
			async () =>
				new Response(null, { status: 204, headers: { "X-Probe-Outcome": "unreachable" } }),
		);

		await dispatch(db, { key, body: { type: "http", url: "https://example.com" } });

		expect(ingested).toHaveLength(1);
		expect(pingResults.dataPoints[0]?.blobs).toEqual(["adhoc", "adhoc", "down"]);
	});
});

describe("POST /api/v1/ping caller budget", () => {
	/**
	 * The budget is scoped to the API key, so a second key sharing the same CI
	 * runner's egress address keeps its own separate allowance.
	 */
	test("refuses a key past its budget and leaves another key's alone", async () => {
		let { db } = createTestDatabase();
		let { key } = await createCaller(db);
		let other = await createCaller(db);

		for (let attempt = 0; attempt < CALLER_LIMIT; attempt++) {
			let served = await dispatch(db, { key, body: { type: "tcp", host: "db", port: 5432 } });
			expect(served.status).toBe(200);
		}

		let refused = await dispatch(db, { key, body: { type: "tcp", host: "db", port: 5432 } });
		expect(refused.status).toBe(429);
		expect(refused.headers.get("RateLimit-Policy")).toBe(`${CALLER_LIMIT};w=60`);

		let unaffected = await dispatch(db, {
			key: other.key,
			body: { type: "tcp", host: "db", port: 5432 },
		});
		expect(unaffected.status).toBe(200);
	});
});
