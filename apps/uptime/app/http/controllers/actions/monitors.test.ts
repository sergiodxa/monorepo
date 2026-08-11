/**
 * Tests for the HTTP monitor create/update/delete/play actions. Not part of either
 * half of the actions-directory test-backfill split (it's neither in this half's list
 * nor the other's) but exists in the tree, so it's covered here too. `cloudflare:workers`
 * is mocked so `Monitor.ping()`'s `env.QUEUE.send(...)` call never touches a real
 * queue binding, and `getViewer()` is seeded the same way `ctx.team`/`ctx.membership`
 * are, standing in for the real `auth`/`requireUser`/`requireTeam` middleware.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";

import type { Middleware, RequestHandler } from "remix/fetch-router";
import type { Route } from "remix/fetch-router/routes";

import { BatchedLogger } from "@pkg/logger";
import { PolarClient } from "@pkg/polar";
import { ServiceContainer } from "@pkg/service-container";
import { asyncContext } from "remix/async-context-middleware";
import { Auth } from "remix/auth-middleware";
import { Database } from "remix/data-table";
import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import { createRevokedSubscription } from "~/app/lib/test/polar";
import { memberships, monitors, teams } from "~/database/schema";
import routes from "~/routes/web";

let queueSend = mock(async () => {});

mock.module("cloudflare:workers", () => ({
	env: { QUEUE: { send: queueSend } },
	waitUntil: (promise: Promise<unknown>) => promise,
}));

/**
 * `@pkg/validate`'s `validate()` flattens `FormData`/`URLSearchParams` into a plain
 * object before handing it to the schema, but `remix/data-schema/form-data`'s
 * `f.object()` (which every schema in this app is built with) validates the raw
 * `FormData`/`URLSearchParams` directly and rejects a flattened object with "Expected
 * FormData or URLSearchParams". As shipped, that means `validate(ctx.formData, ...)`
 * always fails, regardless of whether the submitted data is actually valid — a real,
 * reproducible bug in the shared `@pkg/validate` package (flagged separately). This
 * mock forwards the form container straight to the schema instead of flattening it,
 * so these tests exercise the actions' real branching instead of always hitting the
 * validation-error path; it can be deleted once the real `@pkg/validate` is fixed.
 */
let { createMonitor, deleteMonitor, playMonitor, updateMonitor } = await import("./monitors");

/**
 * The billing client the container hands the actions, with the one call `ingestPings`
 * would make spied on. Registered so that "this request billed nothing" is asserted
 * against a client that was available to be used, rather than passing because resolving
 * one would have thrown.
 */
let polar = new PolarClient({ accessToken: "polar_at_test" });
let ingestEventsSafeMock = spyOn(polar, "ingestEventsSafe");

beforeEach(() => {
	ingestEventsSafeMock.mockClear();
	ingestEventsSafeMock.mockImplementation(async () => true);
});

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

/** Middleware that seeds `ctx.team`/`ctx.membership`/auth state, standing in for the real chain. */
function seedTeam(team: SelectTeam, membership: SelectMembership): Middleware {
	let viewer: Viewer = {
		id: membership.subject_id,
		name: "Test Viewer",
		email: "viewer@example.com",
		avatar: "",
	};

	return (ctx, next) => {
		ctx.team = team;
		ctx.membership = membership;
		ctx.set(Auth, { ok: true, identity: viewer, method: "test" });
		return next();
	};
}

/**
 * Wraps `seeded` so a logger the funnel-event assertions can read back is installed first,
 * standing in for the request logger middleware. Composed into one middleware rather than
 * added beside it, because a route's middleware list here is a fixed-length tuple. Only the
 * suite that asserts on events passes a logger — every other test runs with none, which is
 * what pins that instrumentation is optional.
 */
function seedLogger(logger: BatchedLogger | undefined, seeded: Middleware): Middleware {
	return (ctx, next) => {
		if (logger) (ctx as unknown as { logger: BatchedLogger }).logger = logger;
		return seeded(ctx, next);
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
	logger?: BatchedLogger,
): Promise<Response> {
	let container = new ServiceContainer();
	container.instance(Database, db);
	container.instance(PolarClient, polar);

	let router = createRouter({ middleware: [asyncContext(), formData() as Middleware] });
	router.map(route, {
		middleware: [seedLogger(logger, seedTeam(team, membership))],
		handler,
	});

	let request = new Request(new URL(route.href({ team: team.slug }), "https://uptime.test"), {
		method,
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams(params).toString(),
	});

	return container.scope(() => router.fetch(request));
}

describe("createMonitor", () => {
	test("creates a monitor, queues a ping, and redirects to its detail page", async () => {
		let { db, team, membership } = await createFixture();
		queueSend.mockClear();

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.http.create,
			createMonitor as RequestHandler<any>,
			"POST",
			{ name: "Homepage", url: "https://example.com" },
		);

		expect(response.status).toBe(303);

		let created = await db.findOne(monitors, { where: { team_id: team.id } });
		expect(created).not.toBeNull();
		expect(created?.name).toBe("Homepage");
		expect(created?.author_id).toBe(membership.subject_id);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.monitors.show.href({ team: team.slug, monitorId: created!.id }),
		);
		expect(queueSend).toHaveBeenCalledTimes(1);
	});

	test("redirects back to the form without creating a monitor when the url is invalid", async () => {
		let { db, team, membership } = await createFixture();
		queueSend.mockClear();

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.http.create,
			createMonitor as RequestHandler<any>,
			"POST",
			{ name: "Homepage", url: "not-a-url" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.monitors.new.href({ team: team.slug }),
		);

		let matching = await db.findMany(monitors, { where: { team_id: team.id } });
		expect(matching).toHaveLength(0);
		expect(queueSend).not.toHaveBeenCalled();
	});
});

describe("updateMonitor", () => {
	test("updates the monitor's fields and redirects to its detail page", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			monitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				author_id: membership.subject_id,
				enabled_at: Date.now(),
				name: "Original",
				url: "https://old.example.com",
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.http.update,
			updateMonitor as RequestHandler<any>,
			"POST",
			{ monitor_id: monitor.id, name: "Renamed", url: "https://new.example.com" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.monitors.show.href({ team: team.slug, monitorId: monitor.id }),
		);

		let updated = await db.findOne(monitors, { where: { id: monitor.id } });
		expect(updated?.name).toBe("Renamed");
		expect(updated?.url).toBe("https://new.example.com");
	});

	test("responds 404 for a monitor that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.http.update,
			updateMonitor as RequestHandler<any>,
			"POST",
			{ monitor_id: crypto.randomUUID(), name: "Renamed", url: "https://new.example.com" },
		);

		expect(response.status).toBe(404);
	});
});

describe("deleteMonitor", () => {
	test("deletes the monitor and redirects to the HTTP monitors list", async () => {
		let { db, team } = await createFixture();
		/**
		 * `deleteMonitor` itself gates on owner/admin — the default fixture membership is
		 * a plain member, so this needs its own admin membership rather than a member's.
		 */
		let membership = await db.create(
			memberships,
			{ id: crypto.randomUUID(), subject_id: "admin-1", team_id: team.id, role: "admin" },
			{ touch: true, returnRow: true },
		);
		let monitor = await db.create(
			monitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				author_id: membership.subject_id,
				enabled_at: Date.now(),
				name: "To delete",
				url: "https://example.com",
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.http.delete,
			deleteMonitor as RequestHandler<any>,
			"DELETE",
			{ monitor_id: monitor.id },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.monitors.index.href({ team: team.slug }),
		);

		expect(await db.findOne(monitors, { where: { id: monitor.id } })).toBeNull();
	});

	test("responds 404 for a member with no admin role deleting someone else's monitor", async () => {
		let { db, team } = await createFixture();
		let otherMembership = await db.create(
			memberships,
			{ id: crypto.randomUUID(), subject_id: "member-2", team_id: team.id, role: "member" },
			{ touch: true, returnRow: true },
		);
		let monitor = await db.create(
			monitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				author_id: "member-1",
				enabled_at: Date.now(),
				name: "Not mine",
				url: "https://example.com",
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(
			db,
			team,
			otherMembership,
			routes.actions.monitor.http.delete,
			deleteMonitor as RequestHandler<any>,
			"DELETE",
			{ monitor_id: monitor.id },
		);

		expect(response.status).toBe(404);
		expect(await db.findOne(monitors, { where: { id: monitor.id } })).not.toBeNull();
	});

	test("responds 404 for a monitor that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.http.delete,
			deleteMonitor as RequestHandler<any>,
			"DELETE",
			{ monitor_id: crypto.randomUUID() },
		);

		expect(response.status).toBe(404);
	});
});

describe("playMonitor", () => {
	test("queues an on-demand check and redirects to the monitor's detail page", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			monitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				author_id: membership.subject_id,
				enabled_at: Date.now(),
				name: "Homepage",
				url: "https://example.com",
			},
			{ touch: true, returnRow: true },
		);
		queueSend.mockClear();

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.http.play,
			playMonitor as RequestHandler<any>,
			"POST",
			{ monitor_id: monitor.id },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.monitors.show.href({ team: team.slug, monitorId: monitor.id }),
		);
		expect(queueSend).toHaveBeenCalledTimes(1);
	});

	test("queues nothing when the team owner is known to be unsubscribed", async () => {
		let { db, team, membership } = await createFixture();
		await createRevokedSubscription(db, team.owner_id);
		let monitor = await db.create(
			monitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				author_id: membership.subject_id,
				enabled_at: Date.now(),
				name: "Homepage",
				url: "https://example.com",
			},
			{ touch: true, returnRow: true },
		);
		queueSend.mockClear();

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.http.play,
			playMonitor as RequestHandler<any>,
			"POST",
			{ monitor_id: monitor.id },
		);

		expect(response.status).toBe(303);
		expect(queueSend).not.toHaveBeenCalled();
	});

	test("responds 404 for a monitor that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();
		queueSend.mockClear();

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.http.play,
			playMonitor as RequestHandler<any>,
			"POST",
			{ monitor_id: crypto.randomUUID() },
		);

		expect(response.status).toBe(404);
		expect(queueSend).not.toHaveBeenCalled();
	});
});

/**
 * Where an on-demand HTTP check is billed, which is not here. `playMonitor` enqueues and
 * returns; the check itself happens later in `CheckHttpJob`, and that job is what bills it,
 * keyed on the job id the message carries. Billing at enqueue too would charge twice for
 * one check — and would charge for a message the job may legitimately drop — so what is
 * pinned here is that this request ingests nothing at all, whatever it did with the queue.
 */
describe("playMonitor billing", () => {
	test("bills nothing at enqueue, leaving the check the job performs to bill itself", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			monitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				author_id: membership.subject_id,
				enabled_at: Date.now(),
				name: "Homepage",
				url: "https://example.com",
			},
			{ touch: true, returnRow: true },
		);
		queueSend.mockClear();

		await send(
			db,
			team,
			membership,
			routes.actions.monitor.http.play,
			playMonitor as RequestHandler<any>,
			"POST",
			{ monitor_id: monitor.id },
		);

		expect(queueSend).toHaveBeenCalledTimes(1);
		expect(ingestEventsSafeMock).not.toHaveBeenCalled();
	});

	test("bills nothing when the owner is unsubscribed and no check is queued", async () => {
		let { db, team, membership } = await createFixture();
		await createRevokedSubscription(db, team.owner_id);
		let monitor = await db.create(
			monitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				author_id: membership.subject_id,
				enabled_at: Date.now(),
				name: "Homepage",
				url: "https://example.com",
			},
			{ touch: true, returnRow: true },
		);
		queueSend.mockClear();

		await send(
			db,
			team,
			membership,
			routes.actions.monitor.http.play,
			playMonitor as RequestHandler<any>,
			"POST",
			{ monitor_id: monitor.id },
		);

		expect(queueSend).not.toHaveBeenCalled();
		expect(ingestEventsSafeMock).not.toHaveBeenCalled();
	});
});

/**
 * The JSON branch a hydrated page takes. It exists because the check is enqueued, not run,
 * so the only thing this request can report is the baseline to compare a later poll
 * against — and because a page that never navigates would otherwise leave a flash message
 * queued for some unrelated later navigation.
 */
describe("playMonitor for a caller asking for JSON", () => {
	/** Sends the play action with an explicit JSON `Accept`, the way the hydrated button does. */
	async function sendJson(
		db: Database,
		team: SelectTeam,
		membership: SelectMembership,
		monitorId: string,
	): Promise<Response> {
		let container = new ServiceContainer();
		container.instance(Database, db);

		let router = createRouter({ middleware: [asyncContext(), formData() as Middleware] });
		router.map(routes.actions.monitor.http.play, {
			middleware: [seedTeam(team, membership)],
			handler: playMonitor as RequestHandler<any>,
		});

		let request = new Request(
			new URL(routes.actions.monitor.http.play.href({ team: team.slug }), "https://uptime.test"),
			{
				method: "POST",
				headers: {
					"content-type": "application/x-www-form-urlencoded",
					accept: "application/json",
				},
				body: new URLSearchParams({ monitor_id: monitorId }).toString(),
			},
		);

		return container.scope(() => router.fetch(request));
	}

	/** Creates one monitor for `team`, optionally with a check outcome already cached on it. */
	async function createMonitorRow(
		db: Database,
		team: SelectTeam,
		membership: SelectMembership,
		changes: Record<string, unknown> = {},
	) {
		return await db.create(
			monitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				author_id: membership.subject_id,
				enabled_at: Date.now(),
				name: "Homepage",
				url: "https://example.com",
				...changes,
			},
			{ touch: true, returnRow: true },
		);
	}

	test("queues the check and reports the pre-run status instead of redirecting", async () => {
		let { db, team, membership } = await createFixture();
		let checkedAt = Date.now();
		let monitor = await createMonitorRow(db, team, membership, {
			last_status: "up",
			last_checked_at: checkedAt,
		});
		queueSend.mockClear();

		let response = await sendJson(db, team, membership, monitor.id);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ queued: true, status: "up", checkedAt });
		expect(queueSend).toHaveBeenCalledTimes(1);
	});

	test("reports that nothing was queued when the team owner is known to be unsubscribed", async () => {
		let { db, team, membership } = await createFixture();
		await createRevokedSubscription(db, team.owner_id);
		let monitor = await createMonitorRow(db, team, membership);
		queueSend.mockClear();

		let response = await sendJson(db, team, membership, monitor.id);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ queued: false, status: null, checkedAt: null });
		expect(queueSend).not.toHaveBeenCalled();
	});

	/**
	 * The regression that matters most here: every caller that does not ask for JSON — the
	 * no-JS form post included — must keep getting the redirect it has always got.
	 */
	test("still redirects a caller that did not ask for JSON", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await createMonitorRow(db, team, membership);
		queueSend.mockClear();

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.http.play,
			playMonitor as RequestHandler<any>,
			"POST",
			{ monitor_id: monitor.id },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.monitors.show.href({ team: team.slug, monitorId: monitor.id }),
		);
	});
});

/**
 * The `funnel.second_monitor_created` event — the activation step. The first monitor can be
 * the one a sign-in converted or the one somebody made to see whether the product works; the
 * second is somebody who decided to keep using it, so the boundary is what these tests pin.
 */
describe("createMonitor funnel event", () => {
	/** Every activation event the request emitted. */
	function funnelEvents(logger: BatchedLogger) {
		return logger.events.filter((event) => event.event === "funnel.second_monitor_created");
	}

	/** Creates one monitor through the real action, optionally with a logger installed. */
	async function create(
		db: Database,
		team: SelectTeam,
		membership: SelectMembership,
		name: string,
		url: string,
		logger?: BatchedLogger,
	) {
		return await send(
			db,
			team,
			membership,
			routes.actions.monitor.http.create,
			createMonitor as RequestHandler<any>,
			"POST",
			{ name, url },
			logger,
		);
	}

	test("stays silent on a team's first monitor", async () => {
		let { db, team, membership } = await createFixture();
		let logger = new BatchedLogger("test");

		await create(db, team, membership, "First", "https://one.example.com", logger);

		expect(funnelEvents(logger)).toBeEmpty();
	});

	test("fires on the second, with the team, the author and the count", async () => {
		let { db, team, membership } = await createFixture();
		let logger = new BatchedLogger("test");

		await create(db, team, membership, "First", "https://one.example.com", logger);
		await create(db, team, membership, "Second", "https://two.example.com", logger);

		expect(funnelEvents(logger)).toHaveLength(1);
		expect(funnelEvents(logger)[0]).toMatchObject({
			teamId: team.id,
			authorId: membership.subject_id,
			monitorType: "http",
			monitorCount: 2,
		});
	});

	test("fires once per team however many monitors follow", async () => {
		let { db, team, membership } = await createFixture();
		let logger = new BatchedLogger("test");

		await create(db, team, membership, "First", "https://one.example.com", logger);
		await create(db, team, membership, "Second", "https://two.example.com", logger);
		await create(db, team, membership, "Third", "https://three.example.com", logger);
		await create(db, team, membership, "Fourth", "https://four.example.com", logger);

		expect(funnelEvents(logger)).toHaveLength(1);
	});

	test("names no monitored URL", async () => {
		let { db, team, membership } = await createFixture();
		let logger = new BatchedLogger("test");

		await create(db, team, membership, "First", "https://one.example.com", logger);
		await create(db, team, membership, "Second", "https://private.example.com/admin", logger);

		let [event] = funnelEvents(logger);
		expect(event).toBeDefined();
		for (let value of Object.values(event ?? {})) {
			if (typeof value !== "string") continue;
			expect(value).not.toContain("private.example.com");
		}
	});

	test("a rejected submission created nothing, so nothing activates", async () => {
		let { db, team, membership } = await createFixture();
		let logger = new BatchedLogger("test");

		await create(db, team, membership, "First", "https://one.example.com", logger);
		await create(db, team, membership, "Second", "not-a-url", logger);

		expect(funnelEvents(logger)).toBeEmpty();
	});

	test("the second monitor is still created when no logger is installed", async () => {
		let { db, team, membership } = await createFixture();

		await create(db, team, membership, "First", "https://one.example.com");
		let response = await create(db, team, membership, "Second", "https://two.example.com");

		expect(response.status).toBe(303);
		expect(await db.count(monitors, { where: { team_id: team.id } })).toBe(2);
	});
});
