/**
 * Tests for the TCP monitor create/update/delete/check actions. `cloudflare:sockets` and
 * `cloudflare:workers` are stubbed so `checkTcpMonitor`'s on-demand check runs outside the
 * Workers runtime, with `waitUntil` work collected here so tests can await it. Billing and
 * analytics assertions pin that a check that ran produces exactly one `ping` event and one
 * `PING_RESULTS` point, and a refused request produces neither.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnalyticsEngineMock } from "@pkg/cloudflare-mocks";
import type { IngestEvent } from "@pkg/polar";
import type { Middleware, RequestHandler } from "remix/router";
import type { Route } from "remix/routes";

import { createAnalyticsEngine, createEnv } from "@pkg/cloudflare-mocks";
import { MemoryTransport } from "@pkg/mail/memory";
import mail from "@pkg/mail/middleware";
import { PolarClient } from "@pkg/polar";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { SelectMembership, SelectTeam } from "~/database/schema";

import { MAIL_FROM } from "~/app/emails/sender";
import { createTestDatabase } from "~/app/lib/test/db";
import {
	memberships,
	subscriptions,
	tcpMonitorResults,
	tcpMonitors,
	teams,
} from "~/database/schema";
import routes from "~/routes/web";

/**
 * The controller (via `app/services/tcp-check.ts`) statically imports `cloudflare:sockets`,
 * which only exists inside the Workers runtime; stub it so every test in this file — not just
 * `checkTcpMonitor` — can load the module graph.
 */
vi.doMock("cloudflare:sockets", () => ({
	connect: vi.fn(() => ({
		opened: Promise.resolve(),
		close: vi.fn(async () => {}),
	})),
}));

/**
 * Work the check action defers past its response, held here so a test can await the meter
 * event that keeps running after the response is sent.
 */
let deferred: Promise<unknown>[] = [];

/**
 * The dataset `writePingResult` reports to — the only binding these paths touch. Module
 * scope holds it because the actions capture `env` on import; `beforeEach` empties it for
 * each test, enforcing the platform's cardinality and size limits on write.
 */
let pingResults: AnalyticsEngineMock = createAnalyticsEngine();

/** `waitUntil` collects deferred work here so a test can await the event that continues after the response returns. */
vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({ PING_RESULTS: pingResults }),
	waitUntil: (promise: Promise<unknown>) => {
		deferred.push(promise);
	},
}));

/**
 * The billing client the container hands the action, with the one call `ingestPings` makes
 * spied on. The client is real — only the request is intercepted — so the events asserted
 * below are the ones the action actually built.
 */
let polar = new PolarClient({ accessToken: "polar_at_test" });
let ingestEventsSafeMock = vi.spyOn(polar, "ingestEventsSafe");

beforeEach(() => {
	ingestEventsSafeMock.mockClear();
	ingestEventsSafeMock.mockImplementation(async () => true);
	pingResults.reset();
	deferred = [];
});

/** Every event the action handed Polar, once the work it deferred has settled. */
async function ingestedEvents(): Promise<IngestEvent[]> {
	await Promise.all(deferred.splice(0));
	return ingestEventsSafeMock.mock.calls.flatMap(([events]) => events);
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

/**
 * `@pkg/validate`'s `validate()` flattens `FormData` into a plain object, which
 * `remix/data-schema/form-data`'s `f.object()` rejects — a real bug that fails every
 * call. This mock forwards the form container to the schema unflattened, exercising real branching.
 */
let { checkTcpMonitor, createTcpMonitor, deleteTcpMonitor, updateTcpMonitor } =
	await import("./tcp-monitors");

/** Creates an in-memory database seeded with one team and a member's membership. */
async function createFixture() {
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

	return { db, team, membership };
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
): Promise<Response> {
	let container = new ServiceContainer();
	container.instance(Database, db);
	container.instance(PolarClient, polar);

	let router = createRouter({
		middleware: [
			asyncContext(),
			formData() as Middleware,
			mail({ transport: new MemoryTransport(), from: MAIL_FROM }),
		],
	});
	router.map(route, { middleware: [seedTeam(team, membership)], handler });

	let request = new Request(new URL(route.href({ team: team.slug }), "https://uptime.test"), {
		method,
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams(params).toString(),
	});

	return container.scope(() => router.fetch(request));
}

describe("createTcpMonitor", () => {
	test("creates a monitor and redirects to its detail page", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.tcp.create,
			createTcpMonitor as RequestHandler<any>,
			"POST",
			{ name: "Redis", host: "redis.internal", port: "6379" },
		);

		expect(response.status).toBe(303);

		let created = await db.findOne(tcpMonitors, { where: { team_id: team.id } });
		expect(created).not.toBeNull();
		expect(created?.name).toBe("Redis");
		expect(response.headers.get("Location")).toBe(
			routes.app.team.tcpMonitors.show.href({ team: team.slug, monitorId: created!.id }),
		);
	});

	test("redirects back to the form without creating a monitor when the port is invalid", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.tcp.create,
			createTcpMonitor as RequestHandler<any>,
			"POST",
			{ name: "Redis", host: "redis.internal", port: "999999" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.tcpMonitors.new.href({ team: team.slug }),
		);

		let matching = await db.findMany(tcpMonitors, { where: { team_id: team.id } });
		expect(matching).toHaveLength(0);
	});
});

describe("updateTcpMonitor", () => {
	test("updates the monitor's fields and redirects to its detail page", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			tcpMonitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Original",
				host: "old.internal",
				port: 22,
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.tcp.update,
			updateTcpMonitor as RequestHandler<any>,
			"POST",
			{ monitor_id: monitor.id, name: "Renamed", host: "new.internal", port: "2222" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.tcpMonitors.show.href({ team: team.slug, monitorId: monitor.id }),
		);

		let updated = await db.findOne(tcpMonitors, { where: { id: monitor.id } });
		expect(updated?.name).toBe("Renamed");
		expect(updated?.host).toBe("new.internal");
	});

	test("responds 404 for a monitor that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.tcp.update,
			updateTcpMonitor as RequestHandler<any>,
			"POST",
			{ monitor_id: crypto.randomUUID(), name: "Renamed", host: "new.internal", port: "2222" },
		);

		expect(response.status).toBe(404);
	});
});

describe("deleteTcpMonitor", () => {
	test("deletes the monitor and its result history, then redirects to the list", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			tcpMonitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "To delete",
				host: "old.internal",
				port: 22,
			},
			{ touch: true, returnRow: true },
		);
		await db.create(tcpMonitorResults, {
			id: crypto.randomUUID(),
			tcp_monitor_id: monitor.id,
			status: "up",
			response_time_ms: 10,
			error_message: null,
			checked_at: Date.now(),
		});

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.tcp.delete,
			deleteTcpMonitor as RequestHandler<any>,
			"DELETE",
			{ monitor_id: monitor.id },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.tcpMonitors.index.href({ team: team.slug }),
		);

		expect(await db.findOne(tcpMonitors, { where: { id: monitor.id } })).toBeNull();
		let results = await db.findMany(tcpMonitorResults, { where: { tcp_monitor_id: monitor.id } });
		expect(results).toHaveLength(0);
	});

	test("responds 404 for a monitor that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.tcp.delete,
			deleteTcpMonitor as RequestHandler<any>,
			"DELETE",
			{ monitor_id: crypto.randomUUID() },
		);

		expect(response.status).toBe(404);
	});
});

describe("checkTcpMonitor", () => {
	test("records an up result and redirects to the monitor's detail page", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			tcpMonitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Redis",
				host: "redis.internal",
				port: 6379,
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.tcp.check,
			checkTcpMonitor as RequestHandler<any>,
			"POST",
			{ monitor_id: monitor.id },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.tcpMonitors.show.href({ team: team.slug, monitorId: monitor.id }),
		);

		let updated = await db.findOne(tcpMonitors, { where: { id: monitor.id } });
		expect(updated?.last_status).toBe("up");
		expect(updated?.last_checked_at).not.toBeNull();

		let results = await db.findMany(tcpMonitorResults, { where: { tcp_monitor_id: monitor.id } });
		expect(results).toHaveLength(1);
		expect(results[0]?.status).toBe("up");
	});

	test("responds 404 for a monitor that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.tcp.check,
			checkTcpMonitor as RequestHandler<any>,
			"POST",
			{ monitor_id: crypto.randomUUID() },
		);

		expect(response.status).toBe(404);
	});
});

describe("checkTcpMonitor billing", () => {
	/** Seeds a monitor this team owns, which is what an on-demand check needs to exist. */
	async function createMonitor(db: Database, teamId: string) {
		return await db.create(
			tcpMonitors,
			{
				id: crypto.randomUUID(),
				team_id: teamId,
				name: "Redis",
				host: "redis.internal",
				port: 6379,
			},
			{ touch: true, returnRow: true },
		);
	}

	test("bills exactly one ping, keyed on the result row and attributed to team and monitor", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await createMonitor(db, team.id);

		await send(
			db,
			team,
			membership,
			routes.actions.monitor.tcp.check,
			checkTcpMonitor as RequestHandler<any>,
			"POST",
			{ monitor_id: monitor.id },
		);

		let [stored] = await db.findMany(tcpMonitorResults, {
			where: { tcp_monitor_id: monitor.id },
		});

		/**
		 * The key is the history row's id, which is what makes this event impossible to
		 * collide with the scheduled sweep's: the sweep bills its own checks under the rows
		 * *it* wrote, and no two checks ever share a row.
		 */
		expect(await ingestedEvents()).toEqual([
			{
				name: "ping",
				externalCustomerId: team.owner_id,
				externalId: `ping:${stored?.id}`,
				metadata: { teamId: team.id, type: "tcp", monitorId: monitor.id },
			},
		]);
	});

	test("bills nothing when the owner has no active subscription, and runs no check", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await createMonitor(db, team.id);
		await createLapsedSubscription(db, team.owner_id);

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.tcp.check,
			checkTcpMonitor as RequestHandler<any>,
			"POST",
			{ monitor_id: monitor.id },
		);

		expect(response.status).toBe(303);
		expect(
			await db.findMany(tcpMonitorResults, { where: { tcp_monitor_id: monitor.id } }),
		).toHaveLength(0);
		expect(await ingestedEvents()).toEqual([]);
	});

	test("bills nothing for a monitor the team doesn't own", async () => {
		let { db, team, membership } = await createFixture();

		await send(
			db,
			team,
			membership,
			routes.actions.monitor.tcp.check,
			checkTcpMonitor as RequestHandler<any>,
			"POST",
			{ monitor_id: crypto.randomUUID() },
		);

		expect(await ingestedEvents()).toEqual([]);
	});

	test("bills nothing when the submitted form is rejected", async () => {
		let { db, team, membership } = await createFixture();

		await send(
			db,
			team,
			membership,
			routes.actions.monitor.tcp.check,
			checkTcpMonitor as RequestHandler<any>,
			"POST",
			{ unrelated: "value" },
		);

		expect(await ingestedEvents()).toEqual([]);
	});
});

/**
 * A manual check must be indistinguishable from a scheduled one in the dataset: same
 * dimensions, same vocabulary, one point per check. A check the action never ran writes
 * nothing, so a refused request leaves no trace to inflate a chart with.
 */
describe("checkTcpMonitor analytics", () => {
	/** Seeds a monitor this team owns, which is what an on-demand check needs to exist. */
	async function createMonitor(db: Database, teamId: string) {
		return await db.create(
			tcpMonitors,
			{
				id: crypto.randomUUID(),
				team_id: teamId,
				name: "Redis",
				host: "redis.internal",
				port: 6379,
			},
			{ touch: true, returnRow: true },
		);
	}

	test("writes exactly one data point carrying TCP's own status and the team index", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await createMonitor(db, team.id);

		await send(
			db,
			team,
			membership,
			routes.actions.monitor.tcp.check,
			checkTcpMonitor as RequestHandler<any>,
			"POST",
			{ monitor_id: monitor.id },
		);

		let [point] = pingResults.dataPoints;
		expect(pingResults.dataPoints).toHaveLength(1);
		expect(point?.blobs).toEqual([monitor.id, "tcp", "up"]);
		expect(point?.indexes).toEqual([team.id]);
		/**
		 * The connection's latency is measured live, so only its shape is pinned here. The
		 * three doubles that follow are fixed: one row means one check, and TCP's status
		 * is simply up or down.
		 */
		let doubles = point?.doubles ?? [];
		expect(doubles).toHaveLength(4);
		expect(doubles[0]).toBeGreaterThanOrEqual(0);
		expect(doubles.slice(1)).toEqual([1, 0, 0]);
	});

	test("writes no data point when the owner has no active subscription", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await createMonitor(db, team.id);
		await createLapsedSubscription(db, team.owner_id);

		await send(
			db,
			team,
			membership,
			routes.actions.monitor.tcp.check,
			checkTcpMonitor as RequestHandler<any>,
			"POST",
			{ monitor_id: monitor.id },
		);

		expect(pingResults.dataPoints).toHaveLength(0);
	});
});
