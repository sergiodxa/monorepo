/**
 * Tests for the HTTP monitor create/update/delete/play actions. Not part of either
 * half of the actions-directory test-backfill split (it's neither in this half's list
 * nor the other's) but exists in the tree, so it's covered here too. `cloudflare:workers`
 * is mocked so `Monitor.ping()`'s `env.PING.create(...)` call never touches a real
 * Workflow binding, and `getViewer()` is seeded the same way `ctx.team`/`ctx.membership`
 * are, standing in for the real `auth`/`requireUser`/`requireTeam` middleware.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, mock, test } from "bun:test";

import type { Middleware, RequestHandler } from "remix/fetch-router";
import type { Route } from "remix/fetch-router/routes";

import { ServiceContainer } from "@pkg/service-container";
import { asyncContext } from "remix/async-context-middleware";
import { Auth } from "remix/auth-middleware";
import { Database } from "remix/data-table";
import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import { memberships, monitors, teams } from "~/database/schema";
import routes from "~/routes/web";

let pingCreate = mock(async () => ({ id: "instance_1" }));

mock.module("cloudflare:workers", () => ({
	env: { PING: { create: pingCreate } },
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
): Promise<Response> {
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({ middleware: [asyncContext(), formData() as Middleware] });
	router.map(route, { middleware: [seedTeam(team, membership)], handler });

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
		pingCreate.mockClear();

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
		expect(pingCreate).toHaveBeenCalledTimes(1);
	});

	test("redirects back to the form without creating a monitor when the url is invalid", async () => {
		let { db, team, membership } = await createFixture();
		pingCreate.mockClear();

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
		expect(pingCreate).not.toHaveBeenCalled();
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
		pingCreate.mockClear();

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
		expect(pingCreate).toHaveBeenCalledTimes(1);
	});

	test("responds 404 for a monitor that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();
		pingCreate.mockClear();

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
		expect(pingCreate).not.toHaveBeenCalled();
	});
});
