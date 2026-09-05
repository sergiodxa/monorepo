/**
 * Tests for the HTTP monitor create/update/delete/play actions. Not part of either
 * half of the actions-directory test-backfill split (it's neither in this half's list
 * nor the other's) but exists in the tree, so it's covered here too. The `QUEUE` binding
 * is an in-memory queue installed through `cloudflare:workers`, so `Monitor.ping()`'s
 * message is asserted on as the message it really enqueued, and `getViewer()` is seeded
 * the same way `ctx.team`/`ctx.membership` are, standing in for the real
 * `auth`/`requireUser`/`requireTeam` middleware.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { QueueMock } from "@sdxc/cloudflare-mocks";
import type { Middleware, RequestHandler } from "remix/router";
import type { Route } from "remix/routes";

import billing from "@sdxc/billing/middleware";
import { createEnv, createQueue } from "@sdxc/cloudflare-mocks";
import { Log } from "@sdxc/logger";
import { log } from "@sdxc/logger/middleware";
import { ServiceContainer } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import { billedEvents, createRevokedSubscription, createTestBilling } from "~/app/lib/test/billing";
import { createTestDatabase } from "~/app/lib/test/db";
import { memberships, monitors, teams } from "~/database/schema";
import routes from "~/routes/web";

/** The message `Monitor.ping()` enqueues for an on-demand HTTP check. */
interface CheckHttpMessage {
	type: "checkHttp";
	id: string;
	monitorId: string;
	scheduledAt: number;
}

/**
 * The queue on-demand checks land on. Module scope because `~/app/data/monitor` captures
 * `env` on import, so `beforeEach` empties it rather than re-creating it.
 */
let queue: QueueMock<CheckHttpMessage> = createQueue<CheckHttpMessage>();

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({ QUEUE: queue }),
	waitUntil: (promise: Promise<unknown>) => promise,
}));

/**
 * `@sdxc/validate`'s `validate()` flattens `FormData`, which `f.object()` rejects
 * as invalid — a real, separately-flagged bug in `@sdxc/validate`. This mock
 * forwards the form data unflattened so these tests exercise real branching.
 */
let { createMonitor, deleteMonitor, playMonitor, updateMonitor } = await import("./monitors");

/**
 * The platform the actions bill against, published on every request below so
 * "this request billed nothing" is asserted against a platform that was there
 * to bill, not one whose absence would have refused the call.
 */
let testBilling = createTestBilling();

beforeEach(() => {
	testBilling = createTestBilling();
	queue.reset();
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

/** Sends a form request through a minimal router mapping a single action route. */
async function send(
	db: Database,
	team: SelectTeam,
	membership: SelectMembership,
	route: Route,
	handler: RequestHandler<any>,
	method: string,
	params: Record<string, string>,
	records: Record<string, unknown>[] = [],
): Promise<Response> {
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({
		middleware: [
			asyncContext(),
			log() as Middleware,
			billing({ provider: () => testBilling }) as Middleware,
			formData() as Middleware,
		],
	});
	router.map(route, { middleware: [seedTeam(team, membership)], handler });

	let request = new Request(new URL(route.href({ team: team.slug }), "https://uptime.test"), {
		method,
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams(params).toString(),
	});

	/**
	 * Run inside a log the caller can read back; its sink also keeps the record this
	 * request emits out of the console.
	 */
	let requestLog = new Log({ kind: "request", sink: (record) => void records.push(record) });

	return requestLog.run(() => container.scope(() => router.fetch(request)));
}

describe("createMonitor", () => {
	test("creates a monitor, queues a ping, and redirects to its detail page", async () => {
		let { db, team, membership } = await createFixture();

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
		expect(queue.sent).toHaveLength(1);
		expect(queue.sent[0]!.body.monitorId).toBe(created!.id);
	});

	test("redirects back to the form without creating a monitor when the url is invalid", async () => {
		let { db, team, membership } = await createFixture();

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
		expect(queue.sent).toHaveLength(0);
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
		expect(queue.sent).toHaveLength(1);
		expect(queue.sent[0]!.body.monitorId).toBe(monitor.id);
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
		expect(queue.sent).toHaveLength(0);
	});

	test("responds 404 for a monitor that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

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
		expect(queue.sent).toHaveLength(0);
	});
});

/**
 * `playMonitor` only enqueues; the `checkHttp` job bills the check later, keyed on
 * the job id. Billing here too would double-charge, or bill a message the job
 * may legitimately drop — so this pins that the request ingests nothing.
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

		await send(
			db,
			team,
			membership,
			routes.actions.monitor.http.play,
			playMonitor as RequestHandler<any>,
			"POST",
			{ monitor_id: monitor.id },
		);

		expect(queue.sent).toHaveLength(1);
		expect(queue.sent[0]!.body.monitorId).toBe(monitor.id);
		expect(await billedEvents(testBilling)).toHaveLength(0);
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

		await send(
			db,
			team,
			membership,
			routes.actions.monitor.http.play,
			playMonitor as RequestHandler<any>,
			"POST",
			{ monitor_id: monitor.id },
		);

		expect(queue.sent).toHaveLength(0);
		expect(await billedEvents(testBilling)).toHaveLength(0);
	});
});

/**
 * The JSON branch a hydrated page takes: since the check is enqueued, not run,
 * the only thing this request can report is the baseline to compare a later
 * poll against, and a flash would otherwise queue for an unrelated navigation.
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

		let response = await sendJson(db, team, membership, monitor.id);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ queued: true, status: "up", checkedAt });
		expect(queue.sent).toHaveLength(1);
		expect(queue.sent[0]!.body.monitorId).toBe(monitor.id);
	});

	test("reports that nothing was queued when the team owner is known to be unsubscribed", async () => {
		let { db, team, membership } = await createFixture();
		await createRevokedSubscription(db, team.owner_id);
		let monitor = await createMonitorRow(db, team, membership);

		let response = await sendJson(db, team, membership, monitor.id);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ queued: false, status: null, checkedAt: null });
		expect(queue.sent).toHaveLength(0);
	});

	/**
	 * The regression that matters most here: every caller that does not ask for JSON — the
	 * no-JS form post included — must keep getting the redirect it has always got.
	 */
	test("still redirects a caller that did not ask for JSON", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await createMonitorRow(db, team, membership);

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
	/** Every activation note the requests' records carry. */
	function funnelEvents(records: Record<string, unknown>[]) {
		return records
			.flatMap((record) => (record.notes ?? []) as Record<string, unknown>[])
			.filter((note) => note.name === "funnel.second_monitor_created");
	}

	/** Creates one monitor through the real action, collecting the record it emitted. */
	async function create(
		db: Database,
		team: SelectTeam,
		membership: SelectMembership,
		name: string,
		url: string,
		records?: Record<string, unknown>[],
	) {
		return await send(
			db,
			team,
			membership,
			routes.actions.monitor.http.create,
			createMonitor as RequestHandler<any>,
			"POST",
			{ name, url },
			records,
		);
	}

	test("stays silent on a team's first monitor", async () => {
		let { db, team, membership } = await createFixture();
		let records: Record<string, unknown>[] = [];

		await create(db, team, membership, "First", "https://one.example.com", records);

		expect(funnelEvents(records)).toHaveLength(0);
	});

	test("fires on the second, with the team, the author and the count", async () => {
		let { db, team, membership } = await createFixture();
		let records: Record<string, unknown>[] = [];

		await create(db, team, membership, "First", "https://one.example.com", records);
		await create(db, team, membership, "Second", "https://two.example.com", records);

		expect(funnelEvents(records)).toHaveLength(1);
		expect(funnelEvents(records)[0]).toMatchObject({
			teamId: team.id,
			authorId: membership.subject_id,
			monitorType: "http",
			monitorCount: 2,
		});
	});

	test("fires once per team however many monitors follow", async () => {
		let { db, team, membership } = await createFixture();
		let records: Record<string, unknown>[] = [];

		await create(db, team, membership, "First", "https://one.example.com", records);
		await create(db, team, membership, "Second", "https://two.example.com", records);
		await create(db, team, membership, "Third", "https://three.example.com", records);
		await create(db, team, membership, "Fourth", "https://four.example.com", records);

		expect(funnelEvents(records)).toHaveLength(1);
	});

	test("names no monitored URL", async () => {
		let { db, team, membership } = await createFixture();
		let records: Record<string, unknown>[] = [];

		await create(db, team, membership, "First", "https://one.example.com", records);
		await create(db, team, membership, "Second", "https://private.example.com/admin", records);

		let [event] = funnelEvents(records);
		expect(event).toBeDefined();
		for (let value of Object.values(event ?? {})) {
			if (typeof value !== "string") continue;
			expect(value).not.toContain("private.example.com");
		}
	});

	test("a rejected submission created nothing, so nothing activates", async () => {
		let { db, team, membership } = await createFixture();
		let records: Record<string, unknown>[] = [];

		await create(db, team, membership, "First", "https://one.example.com", records);
		await create(db, team, membership, "Second", "not-a-url", records);

		expect(funnelEvents(records)).toHaveLength(0);
	});
});
