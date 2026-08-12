/**
 * Tests for the flow monitor create/update/delete/run actions.
 *
 * Two properties carry most of the weight here.
 *
 * **A flow may only be pointed at a verified domain.** Create and update refuse a source naming
 * anything else, and they refuse it *before storing it* — a monitor saved that way could never run,
 * so it would be an hourly `error` result and a customer wondering why. The refusal is asserted by
 * the absence of a row, not only by the redirect.
 *
 * **A run is billed for the requests it made.** `cloudflare:workers` is stubbed so the meter events
 * the response deliberately doesn't wait for are collected instead of dropped: a run that made
 * three requests is exactly three `ping` events keyed on the result row it wrote, and every request
 * that returned without running — rejected form, another team's monitor, a lapsed owner, a source no
 * verified domain covers — is none.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";

import type { IngestEvent } from "@pkg/polar";
import type { Middleware, RequestHandler } from "remix/fetch-router";
import type { Route } from "remix/fetch-router/routes";

import { MemoryTransport } from "@pkg/mail/memory";
import mail from "@pkg/mail/middleware";
import { PolarClient } from "@pkg/polar";
import { ServiceContainer } from "@pkg/service-container";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { asyncContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";

import type { SelectMembership, SelectTeam } from "~/database/schema";

import { MAIL_FROM } from "~/app/emails/sender";
import i18n from "~/app/http/middleware/i18n";
import { createTestDatabase } from "~/app/lib/test/db";
import {
	flowMonitorResults,
	flowMonitors,
	memberships,
	subscriptions,
	teamDomains,
	teams,
} from "~/database/schema";
import routes from "~/routes/web";

const DOMAIN = "example.test";
const ORIGIN = `https://app.${DOMAIN}`;

/** Work the run action deferred past its response, held so a test can await it. */
let deferred: Promise<unknown>[] = [];

/** One Analytics Engine data point, as the `PING_RESULTS` binding receives it. */
interface DataPoint {
	blobs: string[];
	doubles: number[];
	indexes: string[];
}

/** Records the data points `writePingResult` sends to Analytics Engine. */
let writeDataPointMock = mock((_point: DataPoint) => {});

mock.module("cloudflare:workers", () => ({
	env: { PING_RESULTS: { writeDataPoint: writeDataPointMock } },
	waitUntil: (promise: Promise<unknown>) => {
		deferred.push(promise);
	},
}));

/**
 * The billing client the container hands the action, with the one call `ingestPings` makes spied
 * on. The client is real — only the request is intercepted — so the events asserted below are the
 * ones the action actually built.
 */
let polar = new PolarClient({ accessToken: "polar_at_test" });
let ingestEventsSafeMock = spyOn(polar, "ingestEventsSafe");

let server = setupServer();

beforeEach(() => {
	ingestEventsSafeMock.mockClear();
	ingestEventsSafeMock.mockImplementation(async () => true);
	writeDataPointMock.mockClear();
	deferred = [];
	server.resetHandlers();
});

server.listen({ onUnhandledRequest: "bypass" });

/** Every event the action handed Polar, once the work it deferred has settled. */
async function ingestedEvents(): Promise<IngestEvent[]> {
	await Promise.all(deferred.splice(0));
	return ingestEventsSafeMock.mock.calls.flatMap(([events]) => events);
}

let { checkFlowMonitor, createFlowMonitor, deleteFlowMonitor, updateFlowMonitor } =
	await import("./flow-monitors");

/** A flow that makes `count` requests against the verified host. */
function flowWith(count: number): string {
	let steps = Array.from(
		{ length: count },
		(_unused, index) => `\t\tlet step${index} = http.get "${ORIGIN}/step"`,
	);
	return ["use http", 'test "walks the flow" {', "\twhen {", ...steps, "\t}", "}"].join("\n");
}

/** Creates an in-memory database seeded with one team, a membership, and a verified domain. */
async function createFixture(options: { verified?: boolean } = {}) {
	let { db } = createTestDatabase();

	let team = await db.create(
		teams,
		{ id: crypto.randomUUID(), owner_id: "owner-1", name: "Acme", slug: "acme", logo: null },
		{ touch: true, returnRow: true },
	);
	let membership = await db.create(
		memberships,
		{ id: crypto.randomUUID(), subject_id: "member-1", team_id: team.id, role: "member" },
		{ touch: true, returnRow: true },
	);
	if (options.verified !== false) {
		await db.create(
			teamDomains,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				hostname: DOMAIN,
				verified_at: Date.now(),
			},
			{ touch: true, returnRow: true },
		);
	}

	return { db, team, membership };
}

/** Records an owner as having lapsed, which is what the entitlement gate refuses on. */
async function createLapsedSubscription(db: Database, ownerId: string) {
	await db.create(
		subscriptions,
		{
			id: crypto.randomUUID(),
			external_customer_id: ownerId,
			polar_subscription_id: crypto.randomUUID(),
			polar_product_id: "product-1",
			status: "canceled",
			current_period_end: null,
			revoked_at: Date.now(),
			polar_modified_at: Date.now(),
		},
		{ touch: true, returnRow: true },
	);
}

/** Middleware that seeds `ctx.team`/`ctx.membership` in place of `requireTeam`. */
function seedTeam(team: SelectTeam, membership: SelectMembership): Middleware {
	return (ctx, next) => {
		ctx.team = team;
		ctx.membership = membership;
		return next();
	};
}

/** Sends a form request through a minimal router mapping a single action route. */
async function send(
	db: Database,
	team: SelectTeam,
	membership: SelectMembership,
	route: Route,
	handler: RequestHandler<any>,
	method: string,
	params: Record<string, string>,
	headers: Record<string, string> = {},
): Promise<Response> {
	let container = new ServiceContainer();
	container.instance(Database, db);
	container.instance(PolarClient, polar);

	/** `i18n` because the entitlement refusal's message is a locale key, not a literal. */
	let router = createRouter({
		middleware: [
			asyncContext(),
			formData() as Middleware,
			i18n,
			mail({ transport: new MemoryTransport(), from: MAIL_FROM }),
		],
	});
	router.map(route, { middleware: [seedTeam(team, membership)], handler });

	let request = new Request(new URL(route.href({ team: team.slug }), "https://uptime.test"), {
		method,
		headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
		body: new URLSearchParams(params).toString(),
	});

	return container.scope(() => router.fetch(request));
}

describe("createFlowMonitor", () => {
	test("creates a monitor whose hosts a verified domain covers", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.flow.create,
			createFlowMonitor as RequestHandler<any>,
			"POST",
			{ name: "Sign in", source: flowWith(1), interval_seconds: "900" },
		);

		expect(response.status).toBe(303);
		let created = await db.findOne(flowMonitors, { where: { team_id: team.id } });
		expect(created?.name).toBe("Sign in");
		expect(created?.interval_seconds).toBe(900);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.flowMonitors.index.href({ team: team.slug }),
		);
	});

	test("refuses a source reaching a domain the team has not verified, and stores nothing", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.flow.create,
			createFlowMonitor as RequestHandler<any>,
			"POST",
			{
				name: "Somebody else's site",
				source: [
					'test "reaches elsewhere" {',
					"\twhen {",
					'\t\tlet response = http.get "https://victim.invalid.test/login"',
					"\t}",
					"}",
				].join("\n"),
			},
		);

		expect(response.status).toBe(303);
		// The row's absence is the assertion: a monitor saved this way could never run.
		expect(await db.findOne(flowMonitors, { where: { team_id: team.id } })).toBeNull();
	});

	test("refuses a source that will not parse", async () => {
		let { db, team, membership } = await createFixture();

		await send(
			db,
			team,
			membership,
			routes.actions.monitor.flow.create,
			createFlowMonitor as RequestHandler<any>,
			"POST",
			{ name: "Broken", source: 'test "unclosed" {' },
		);

		expect(await db.findOne(flowMonitors, { where: { team_id: team.id } })).toBeNull();
	});

	test("refuses an interval that is not on the list", async () => {
		let { db, team, membership } = await createFixture();

		await send(
			db,
			team,
			membership,
			routes.actions.monitor.flow.create,
			createFlowMonitor as RequestHandler<any>,
			"POST",
			{ name: "Too often", source: flowWith(1), interval_seconds: "60" },
		);

		expect(await db.findOne(flowMonitors, { where: { team_id: team.id } })).toBeNull();
	});
});

describe("updateFlowMonitor", () => {
	test("updates a monitor whose new source stays inside the verified domain", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			flowMonitors,
			{ id: crypto.randomUUID(), team_id: team.id, name: "Sign in", source: flowWith(1) },
			{ touch: true, returnRow: true },
		);

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.flow.update,
			updateFlowMonitor as RequestHandler<any>,
			"POST",
			{
				monitor_id: monitor.id,
				name: "Sign in and checkout",
				source: flowWith(2),
				interval_seconds: "21600",
				is_enabled: "true",
			},
		);

		expect(response.status).toBe(303);
		let updated = await db.findOne(flowMonitors, { where: { id: monitor.id } });
		expect(updated?.name).toBe("Sign in and checkout");
		expect(updated?.interval_seconds).toBe(21_600);
	});

	test("refuses an edit that reaches outside the verified domain, keeping the old source", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			flowMonitors,
			{ id: crypto.randomUUID(), team_id: team.id, name: "Sign in", source: flowWith(1) },
			{ touch: true, returnRow: true },
		);

		await send(
			db,
			team,
			membership,
			routes.actions.monitor.flow.update,
			updateFlowMonitor as RequestHandler<any>,
			"POST",
			{
				monitor_id: monitor.id,
				name: "Sign in",
				source:
					'test "elsewhere" {\n\twhen {\n\t\tlet r = http.get "https://victim.invalid.test/x"\n\t}\n}',
			},
		);

		let unchanged = await db.findOne(flowMonitors, { where: { id: monitor.id } });
		expect(unchanged?.source).toBe(flowWith(1));
	});

	test("404s on another team's monitor", async () => {
		let { db, team, membership } = await createFixture();
		let other = await db.create(
			teams,
			{ id: crypto.randomUUID(), owner_id: "owner-2", name: "Other", slug: "other", logo: null },
			{ touch: true, returnRow: true },
		);
		let monitor = await db.create(
			flowMonitors,
			{ id: crypto.randomUUID(), team_id: other.id, name: "Theirs", source: flowWith(1) },
			{ touch: true, returnRow: true },
		);

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.flow.update,
			updateFlowMonitor as RequestHandler<any>,
			"POST",
			{ monitor_id: monitor.id, name: "Mine now", source: flowWith(1) },
		);

		expect(response.status).toBe(404);
	});
});

describe("deleteFlowMonitor", () => {
	test("deletes a monitor and its results", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			flowMonitors,
			{ id: crypto.randomUUID(), team_id: team.id, name: "Sign in", source: flowWith(1) },
			{ touch: true, returnRow: true },
		);
		await db.create(
			flowMonitorResults,
			{
				id: crypto.randomUUID(),
				flow_monitor_id: monitor.id,
				status: "up",
				checked_at: Date.now(),
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.flow.delete,
			deleteFlowMonitor as RequestHandler<any>,
			"DELETE",
			{ monitor_id: monitor.id },
		);

		expect(response.status).toBe(303);
		expect(await db.findOne(flowMonitors, { where: { id: monitor.id } })).toBeNull();
		expect(
			await db.findMany(flowMonitorResults, { where: { flow_monitor_id: monitor.id } }),
		).toHaveLength(0);
	});

	test("404s on another team's monitor", async () => {
		let { db, team, membership } = await createFixture();
		let other = await db.create(
			teams,
			{ id: crypto.randomUUID(), owner_id: "owner-2", name: "Other", slug: "other", logo: null },
			{ touch: true, returnRow: true },
		);
		let monitor = await db.create(
			flowMonitors,
			{ id: crypto.randomUUID(), team_id: other.id, name: "Theirs", source: flowWith(1) },
			{ touch: true, returnRow: true },
		);

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.flow.delete,
			deleteFlowMonitor as RequestHandler<any>,
			"DELETE",
			{ monitor_id: monitor.id },
		);

		expect(response.status).toBe(404);
		expect(await db.findOne(flowMonitors, { where: { id: monitor.id } })).not.toBeNull();
	});
});

describe("checkFlowMonitor", () => {
	/** Seeds a monitor making `count` requests, and answers all of them 200. */
	async function seedRunnable(db: Database, teamId: string, count: number) {
		server.use(http.get(`${ORIGIN}/step`, () => HttpResponse.json({ ok: true })));
		return await db.create(
			flowMonitors,
			{ id: crypto.randomUUID(), team_id: teamId, name: "Sign in", source: flowWith(count) },
			{ touch: true, returnRow: true },
		);
	}

	test("answers JSON with the run's outcome when the caller asks for it", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await seedRunnable(db, team.id, 2);

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.flow.check,
			checkFlowMonitor as RequestHandler<any>,
			"POST",
			{ monitor_id: monitor.id },
			{ accept: "application/json" },
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		// The hydrated page renders these into a toast, so all of them travel.
		expect(body.status).toBe("up");
		expect(body.requestsMade).toBe(2);
		expect(body.testsPassed).toBe(1);
		expect(body.reason).toBeNull();
	});

	test("bills one ping per request the run made, keyed on the result row", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await seedRunnable(db, team.id, 3);

		await send(
			db,
			team,
			membership,
			routes.actions.monitor.flow.check,
			checkFlowMonitor as RequestHandler<any>,
			"POST",
			{ monitor_id: monitor.id },
			{ accept: "application/json" },
		);

		let stored = await db.findOne(flowMonitorResults, { where: { flow_monitor_id: monitor.id } });
		expect(stored?.requests_made).toBe(3);

		let events = await ingestedEvents();
		expect(events).toHaveLength(3);
		expect(events.map((event) => event.externalId).sort()).toEqual([
			`ping:${stored!.id}:0`,
			`ping:${stored!.id}:1`,
			`ping:${stored!.id}:2`,
		]);
		// One data point for the run, not one per request: the series is "how long did it take".
		expect(writeDataPointMock).toHaveBeenCalledTimes(1);
	});

	test("a source no verified domain covers is recorded as an error and bills nothing", async () => {
		let { db, team, membership } = await createFixture({ verified: false });
		let monitor = await seedRunnable(db, team.id, 1);

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.flow.check,
			checkFlowMonitor as RequestHandler<any>,
			"POST",
			{ monitor_id: monitor.id },
			{ accept: "application/json" },
		);

		let body = (await response.json()) as Record<string, unknown>;
		expect(body.status).toBe("error");
		expect(body.requestsMade).toBe(0);
		// Recorded, not only reported: somebody who asked to run a broken monitor gets a result
		// row explaining why.
		let stored = await db.findOne(flowMonitorResults, { where: { flow_monitor_id: monitor.id } });
		expect(stored?.status).toBe("error");
		expect(await ingestedEvents()).toHaveLength(0);
	});

	test("a lapsed owner is refused, and nothing runs or bills", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await seedRunnable(db, team.id, 1);
		await createLapsedSubscription(db, team.owner_id);

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.flow.check,
			checkFlowMonitor as RequestHandler<any>,
			"POST",
			{ monitor_id: monitor.id },
			{ accept: "application/json" },
		);

		let body = (await response.json()) as Record<string, unknown>;
		expect(body.status).toBeNull();
		expect(body.reason).toBeTruthy();
		expect(
			await db.findOne(flowMonitorResults, { where: { flow_monitor_id: monitor.id } }),
		).toBeNull();
		expect(await ingestedEvents()).toHaveLength(0);
		expect(writeDataPointMock).not.toHaveBeenCalled();
	});

	test("a caller that did not ask for JSON gets the redirect instead", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await seedRunnable(db, team.id, 1);

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.flow.check,
			checkFlowMonitor as RequestHandler<any>,
			"POST",
			{ monitor_id: monitor.id },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.flowMonitors.edit.href({ team: team.slug, monitorId: monitor.id }),
		);
	});

	test("404s on another team's monitor", async () => {
		let { db, team, membership } = await createFixture();
		let other = await db.create(
			teams,
			{ id: crypto.randomUUID(), owner_id: "owner-2", name: "Other", slug: "other", logo: null },
			{ touch: true, returnRow: true },
		);
		let monitor = await db.create(
			flowMonitors,
			{ id: crypto.randomUUID(), team_id: other.id, name: "Theirs", source: flowWith(1) },
			{ touch: true, returnRow: true },
		);

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.flow.check,
			checkFlowMonitor as RequestHandler<any>,
			"POST",
			{ monitor_id: monitor.id },
			{ accept: "application/json" },
		);

		expect(response.status).toBe(404);
		expect(await ingestedEvents()).toHaveLength(0);
	});
});
