/**
 * Tests `POST /actions/:team/run-ping`, the dashboard's quick check, through a real
 * session, viewer, and team row, since the action's whole output is a session flash and
 * redirect. A check that ran is billed even when it fails; a check that never ran bills
 * nothing, asserted on every refusal below. The entitlement gate is `stateFor`, so an
 * owner with no subscription rows is allowed through — pinned here so a later tightening
 * is deliberate.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnalyticsEngineMock } from "@sdxc/cloudflare-mocks";

import billing from "@sdxc/billing/middleware";
import {
	createAnalyticsEngine,
	createDurableObjectNamespace,
	createEnv,
} from "@sdxc/cloudflare-mocks";
import { ServiceContainer } from "@sdxc/service-container";
import { createCookie } from "remix/cookie";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";
import { Session } from "remix/session";
import { createMemorySessionStorage } from "remix/session-storage/memory";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { GeoFetchDO } from "~/app/do/geo-fetch";
import type { QuickPingOutcome, QuickPingResult } from "~/app/http/controllers/actions/ping";
import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectTeam } from "~/database/schema";

import { auth } from "~/app/http/middleware/auth";
import i18n from "~/app/http/middleware/i18n";
import { signIn } from "~/app/lib/test/auth";
import { billedEvents, createRevokedSubscription, createTestBilling } from "~/app/lib/test/billing";
import { createTestDatabase } from "~/app/lib/test/db";
import { memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

/** The `GeoFetchDO` stub the quick check probes through. */
let doFetchMock = vi.fn(
	async (_url: string, _init?: RequestInit) =>
		new Response("OK", { status: 200, headers: { "X-Response-Time": "12" } }),
);

/**
 * The `GEO_FETCH` binding. Every object it hands out answers with {@link doFetchMock}, and
 * its `resolutions` are the probes the action issued, in order, one per check it ran.
 */
let geoFetch = createDurableObjectNamespace<GeoFetchDO>(() => ({ fetch: doFetchMock }));

/**
 * The dataset the action reports each check it ran to. Module scope because the action
 * captures `env` on import, so `beforeEach` empties it rather than re-creating it.
 */
let pingResults: AnalyticsEngineMock = createAnalyticsEngine();

/** Promises the action deferred, drained by {@link dispatch} before it returns. */
let deferred: Promise<unknown>[] = [];

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({
		GEO_FETCH: geoFetch,
		PING_RESULTS: pingResults,
	}),
	waitUntil: (promise: Promise<unknown>) => {
		deferred.push(promise);
	},
	/** `~/app/do/geo-fetch` extends this at module load; that's the only use it needs. */
	DurableObject: class {},
}));

let { runPing, QUICK_PING_RESULT } = await import("./ping");

/** The entitlement gate logs every inconclusive lookup; the assertions read the flash. */
vi.spyOn(console, "info").mockImplementation(() => {});

type Db = ReturnType<typeof createTestDatabase>["db"];

/**
 * The platform the action bills against, replaced per test so one submission's meter events
 * cannot be read back by the next. The middleware resolves it per request, so the router
 * built below reads whatever this currently holds.
 */
let testBilling = createTestBilling();

let viewer: Viewer = {
	id: "viewer-1",
	name: "Test Viewer",
	email: "viewer@example.com",
	avatar: "",
};

let sessionCookie = createCookie("uptime-test-session", { secrets: ["test-secret"] });
let sessionStorage = createMemorySessionStorage();

/**
 * Narrows a stored outcome to a performed check, failing the test when the action stored
 * a refusal instead — which is the more useful failure, since a refusal where a result
 * was expected means the check never ran at all.
 */
function expectResult(outcome: QuickPingOutcome | null): QuickPingResult {
	expect(outcome?.kind).toBe("result");
	if (outcome?.kind !== "result") throw new Error("expected a performed check");
	return outcome;
}

/** What the card reads back after a submission: the stored outcome, and any toast. */
interface FlashedState {
	outcome: QuickPingOutcome | null;
	toast: { intent: string; message: string } | null;
}

/** A team the viewer is a member of, owned by a fresh owner with no subscription rows. */
async function createFixture() {
	let { db } = createTestDatabase();

	let team = await db.create(
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
	await db.create(
		memberships,
		{ id: crypto.randomUUID(), subject_id: viewer.id, team_id: team.id, role: "admin" },
		{ touch: true, returnRow: true },
	);

	return { db, team };
}

/**
 * Builds the router the requests below go through: the real session/auth/i18n chain the
 * action runs behind in production, plus a read-only route the tests use to see what was
 * flashed — the action answers with a redirect, so its whole output is in the session.
 */
function createTestRouter(db: Db) {
	let router = createRouter({
		middleware: [
			asyncContext(),
			billing({ provider: () => testBilling }),
			session(sessionCookie, sessionStorage),
			(_ctx, next) => {
				signIn(viewer);
				return next();
			},
			auth,
			i18n,
			formData(),
		],
	});

	router.map(routes.actions.runPing, runPing);
	router.get("/flashed", (ctx) => {
		let current = ctx.get(Session);
		return Response.json({
			outcome: current?.get(QUICK_PING_RESULT) ?? null,
			toast: current?.get("toast") ?? null,
		});
	});

	let container = new ServiceContainer();
	container.singleton(Database, () => db);

	return { router, container };
}

/** The `Cookie` header a browser would send back, from a response's `Set-Cookie`s. */
function cookieHeader(response: Response): string {
	return response.headers
		.getSetCookie()
		.map((value) => value.split(";")[0])
		.join("; ");
}

/**
 * Submits the quick-check form and drains the deferred work standing in for the
 * platform's post-response settling, then reads back what the action flashed — a
 * flash only readable one request after it was written, exactly how the dashboard reads it.
 */
async function dispatch(db: Db, team: SelectTeam, url: string) {
	let { router, container } = createTestRouter(db);

	let request = new Request(
		new URL(routes.actions.runPing.href({ team: team.slug }), "https://uptime.test"),
		{
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({ url }),
		},
	);

	let response = await container.scope(() => router.fetch(request));
	await Promise.all(deferred.splice(0));

	let read = await container.scope(() =>
		router.fetch(
			new Request("https://uptime.test/flashed", { headers: { Cookie: cookieHeader(response) } }),
		),
	);

	return { response, flashed: (await read.json()) as FlashedState };
}

beforeEach(() => {
	doFetchMock.mockReset();
	doFetchMock.mockImplementation(
		async () => new Response("OK", { status: 200, headers: { "X-Response-Time": "12" } }),
	);
	geoFetch.reset();
	pingResults.reset();
	testBilling = createTestBilling();
	deferred.length = 0;
});

describe("POST /actions/:team/run-ping", () => {
	test("flashes the result and redirects to the dashboard", async () => {
		let { db, team } = await createFixture();

		let { response, flashed } = await dispatch(db, team, "https://example.com/health");

		/** A redirect rather than a rendered response, so a refresh cannot re-run the check. */
		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.dashboard.index.href({ team: team.slug }),
		);
		expect(flashed.outcome).toEqual({
			kind: "result",
			/** Minted per submission; what it is worth is that it differs from the last one. */
			id: expect.any(String),
			url: "https://example.com/health",
			status: "up",
			responseStatus: 200,
			responseTimeMs: 12,
		});
	});

	test("probes with the quick check's defaults", async () => {
		let { db, team } = await createFixture();

		await dispatch(db, team, "https://example.com/health");

		expect(doFetchMock.mock.calls[0]?.[1]?.method).toBe("GET");
		expect(geoFetch.resolutions[0]?.locationHint).toBe("wnam");
		expect(geoFetch.resolutions[0]?.name).toMatch(/^wnam:[0-7]$/);
	});

	test("keeps a repeated check on the same object, since the URL is the shard key", async () => {
		let { db, team } = await createFixture();

		await dispatch(db, team, "https://example.com/health");
		await dispatch(db, team, "https://example.com/health");
		await dispatch(db, team, "https://elsewhere.test/status");

		/**
		 * A person poking at one deploy submits this form several times in a row, and each
		 * of those checks lands on the object already warm for that target.
		 */
		let probes = geoFetch.resolutions;
		expect(probes[1]?.name).toBe(probes[0]?.name);
		expect(probes[2]?.name).not.toBe(probes[0]?.name);
	});

	test("treats anything but a 200 as down, which is the only status it expects", async () => {
		let { db, team } = await createFixture();
		doFetchMock.mockImplementation(
			async () => new Response("Created", { status: 201, headers: { "X-Response-Time": "8" } }),
		);

		let { flashed } = await dispatch(db, team, "https://example.com/health");

		expect(expectResult(flashed.outcome).status).toBe("down");
		expect(expectResult(flashed.outcome).responseStatus).toBe(201);
	});

	test("flashes a down result, and still bills it, for a bad answer", async () => {
		let { db, team } = await createFixture();
		doFetchMock.mockImplementation(
			async () => new Response("Error", { status: 500, headers: { "X-Response-Time": "31" } }),
		);

		let { flashed } = await dispatch(db, team, "https://example.com/health");

		expect(flashed.outcome).toEqual({
			kind: "result",
			/** Minted per submission; what it is worth is that it differs from the last one. */
			id: expect.any(String),
			url: "https://example.com/health",
			status: "down",
			responseStatus: 500,
			responseTimeMs: 31,
		});
		/** The check ran, so the team performed a ping: a failed check is billable work. */
		expect(pingResults.dataPoints).toHaveLength(1);
		expect(await billedEvents(testBilling)).toHaveLength(1);
	});

	test("flashes no code and no timing for a target that never answered", async () => {
		let { db, team } = await createFixture();
		/** How `GeoFetchDO` reports a request it couldn't complete. */
		doFetchMock.mockImplementation(
			async () =>
				new Response(null, { status: 204, headers: { "X-Probe-Outcome": "unreachable" } }),
		);

		let { flashed } = await dispatch(db, team, "https://nothing.invalid");

		/** `null` means no status or measurement was recorded, distinct from an actual 0 reading. */
		expect(flashed.outcome).toEqual({
			kind: "result",
			/** Minted per submission; what it is worth is that it differs from the last one. */
			id: expect.any(String),
			url: "https://nothing.invalid",
			status: "down",
			responseStatus: null,
			responseTimeMs: null,
		});
		expect(await billedEvents(testBilling)).toHaveLength(1);
	});
});

/**
 * Every refusal below performed no work, so billing it would charge a team for a check
 * that probed nothing — which is asserted on each one rather than once, because each
 * takes a different way out of the handler.
 */
describe("POST /actions/:team/run-ping refusals", () => {
	/** The three shapes a URL box gets typed into that the probe cannot answer. */
	let unprobeable = {
		"an empty field": "",
		"a bare word": "not-a-url",
		/** `checks.url()` accepts this; the schema's own protocol rule is what refuses it. */
		"a mailto: address": "mailto:ops@example.com",
	};

	for (let [description, url] of Object.entries(unprobeable)) {
		test(`refuses ${description} without probing anything`, async () => {
			let { db, team } = await createFixture();

			let { response, flashed } = await dispatch(db, team, url);

			expect(response.status).toBe(303);
			expect(response.headers.get("Location")).toBe(
				routes.app.team.dashboard.index.href({ team: team.slug }),
			);
			expect(flashed.outcome).toEqual({
				kind: "error",
				id: expect.any(String),
				code: "invalidUrl",
			});
			expect(flashed.toast).toBeNull();

			expect(doFetchMock).not.toHaveBeenCalled();
			expect(pingResults.dataPoints).toHaveLength(0);
			expect(await billedEvents(testBilling)).toHaveLength(0);
		});
	}

	test("refuses an owner whose subscription is known to be inactive", async () => {
		let { db, team } = await createFixture();
		await createRevokedSubscription(db, team.owner_id);

		let { response, flashed } = await dispatch(db, team, "https://example.com/health");

		expect(response.status).toBe(303);
		expect(flashed.outcome).toEqual({
			kind: "error",
			id: expect.any(String),
			code: "subscriptionRequired",
		});
		expect(flashed.toast).toBeNull();

		/** Refused before any billable work: no probe, no data point, no meter event. */
		expect(doFetchMock).not.toHaveBeenCalled();
		expect(pingResults.dataPoints).toHaveLength(0);
		expect(await billedEvents(testBilling)).toHaveLength(0);
	});

	test("runs the check for an owner with no subscription rows at all", async () => {
		let { db, team } = await createFixture();

		let { flashed } = await dispatch(db, team, "https://example.com/health");

		/**
		 * The gate reads `stateFor`, treating an inconclusive lookup as entitled — guarding
		 * against refusing a paying customer merely because a lookup came back unclear.
		 */
		expect(expectResult(flashed.outcome).status).toBe("up");
		expect(pingResults.dataPoints).toHaveLength(1);
	});
});
