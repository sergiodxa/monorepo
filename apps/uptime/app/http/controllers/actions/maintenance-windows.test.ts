/**
 * Tests for the maintenance-window create/update/delete/end-early actions: successful
 * submissions mutate `maintenance_windows` and redirect to the list, a failing
 * `ends_at > starts_at` refinement renders the form again with the posted values without
 * mutating, and update/delete/
 * end-early each 404 when the window doesn't belong to the acting team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { Database } from "remix/data-table";
import type { Middleware, RequestContext, RequestHandler } from "remix/router";
import type { Route } from "remix/routes";

import { database } from "@sdxc/database-middleware";
import { generateUUID } from "@sdxc/uuid/v4";
import { renderToStream } from "remix/component/server";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { formData } from "remix/middleware/form-data";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { SelectMembership, SelectTeam } from "~/database/schema";

import i18n from "~/app/http/middleware/i18n";
import models from "~/app/http/middleware/models";
import { createTestDatabase } from "~/app/test/db";
import { testAssets } from "~/app/test/document-assets";
import { dnsMonitors, maintenanceWindows, memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

/**
 * `@sdxc/validate`'s `validate()` flattens `FormData` before validation, but every schema
 * in this app validates raw `FormData`/`URLSearchParams` directly, so
 * `validate(ctx.formData, ...)` always fails until that upstream bug is fixed.
 */
let {
	createMaintenanceWindow,
	deleteMaintenanceWindow,
	endMaintenanceWindow,
	updateMaintenanceWindow,
} = await import("./maintenance-windows");

/** Creates an in-memory database seeded with one team and a member's membership. */
async function createFixture() {
	let { db } = createTestDatabase();

	let team = await db.create(
		teams,
		{ id: generateUUID(), owner_id: "owner-1", name: "Acme", slug: "acme", logo: null },
		{ touch: true, returnRow: true },
	);
	let membership = await db.create(
		memberships,
		{ id: generateUUID(), subject_id: "member-1", team_id: team.id, role: "member" },
		{ touch: true, returnRow: true },
	);

	return { db, team, membership };
}

/**
 * Middleware that seeds `ctx.team`/`ctx.membership`/`ctx.teams` and the signed-in viewer in
 * place of `requireUser`/`requireTeam`, so a refused submission can render its form again.
 */
function seedTeam(team: SelectTeam, membership: SelectMembership): Middleware {
	return (ctx, next) => {
		ctx.team = team;
		ctx.membership = membership;
		ctx.teams = [team];
		ctx.set(Auth, {
			ok: true,
			identity: { id: membership.subject_id, name: "Ada", email: "ada@acme.com", avatar: "" },
			method: "test",
		});
		return next();
	};
}

/** Minimal request-scoped HTML renderer standing in for the app's `render()` middleware. */
function createHtmlRenderer(ctx: RequestContext) {
	return async function render(node: RemixNode, init?: ResponseInit): Promise<Response> {
		let stream = renderToStream(node, { frameSrc: ctx.request.url });
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(stream, { ...init, headers });
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
	let router = createRouter({
		middleware: [asyncContext(), database(db), models(), formData() as Middleware],
	});
	router.map(route, {
		middleware: [
			seedTeam(team, membership),
			i18n,
			testAssets(),
			renderWith(createHtmlRenderer) as Middleware,
		],
		handler,
	});

	let request = new Request(new URL(route.href({ team: team.slug }), "https://uptime.test"), {
		method,
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams(params).toString(),
	});

	return router.fetch(request);
}

describe("createMaintenanceWindow", () => {
	test("creates a window and redirects to the maintenance-windows list", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(
			db,
			team,
			membership,
			routes.actions.maintenanceWindow.create,
			createMaintenanceWindow as RequestHandler<any>,
			"POST",
			{ name: "Deploy window", starts_at: "2026-08-01T00:00", ends_at: "2026-08-01T02:00" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.maintenanceWindows.index.href({ team: team.slug }),
		);

		let created = await db.findOne(maintenanceWindows, { where: { team_id: team.id } });
		expect(created).not.toBeNull();
		expect(created?.name).toBe("Deploy window");
		expect(created?.monitor_type).toBeNull();
		expect(created?.monitor_id).toBeNull();
	});

	test("stores a type-wide scope for a monitor type the team owns none of yet", async () => {
		let { db, team, membership } = await createFixture();

		await send(
			db,
			team,
			membership,
			routes.actions.maintenanceWindow.create,
			createMaintenanceWindow as RequestHandler<any>,
			"POST",
			{
				name: "Zone freeze",
				scope: "type:dns",
				starts_at: "2026-08-01T00:00",
				ends_at: "2026-08-01T02:00",
			},
		);

		let created = await db.findOne(maintenanceWindows, { where: { team_id: team.id } });
		expect(created?.monitor_type).toBe("dns");
		expect(created?.monitor_id).toBeNull();
	});

	test("stores a monitor scope against the type's own table", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			dnsMonitors,
			{ id: generateUUID(), team_id: team.id, name: "Domain", domain: "example.com" },
			{ touch: true, returnRow: true },
		);

		await send(
			db,
			team,
			membership,
			routes.actions.maintenanceWindow.create,
			createMaintenanceWindow as RequestHandler<any>,
			"POST",
			{
				name: "Zone migration",
				scope: `monitor:dns:${monitor.id}`,
				starts_at: "2026-08-01T00:00",
				ends_at: "2026-08-01T02:00",
			},
		);

		let created = await db.findOne(maintenanceWindows, { where: { team_id: team.id } });
		expect(created?.monitor_type).toBe("dns");
		expect(created?.monitor_id).toBe(monitor.id);
	});

	/**
	 * A scope nobody could have picked signals a submission that diverges from the
	 * rendered form, so rejecting it keeps a mismatched scope from silently widening
	 * to every monitor the team has for the window's duration.
	 */
	test("rejects a scope naming a monitor the team doesn't own, without creating a row", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(
			db,
			team,
			membership,
			routes.actions.maintenanceWindow.create,
			createMaintenanceWindow as RequestHandler<any>,
			"POST",
			{
				name: "Not our monitor",
				scope: "monitor:dns:not-ours",
				starts_at: "2026-08-01T00:00",
				ends_at: "2026-08-01T02:00",
			},
		);

		expect(response.status).toBe(400);
		let body = await response.text();
		expect(body).toContain('value="Not our monitor"');
		expect(body).toContain("Pick a scope from the list. The monitor this one named is gone.");
		expect(await db.findMany(maintenanceWindows, { where: { team_id: team.id } })).toHaveLength(0);
	});

	test("renders the form again with the posted times when ends_at is before starts_at", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(
			db,
			team,
			membership,
			routes.actions.maintenanceWindow.create,
			createMaintenanceWindow as RequestHandler<any>,
			"POST",
			{ name: "Bad window", starts_at: "2026-08-01T02:00", ends_at: "2026-08-01T00:00" },
		);

		expect(response.status).toBe(400);
		let body = await response.text();
		expect(body).toContain('value="Bad window"');
		expect(body).toContain('value="2026-08-01T02:00"');
		expect(body).toContain('value="2026-08-01T00:00"');
		expect(body).toContain("End the window after it starts.");

		let matching = await db.findMany(maintenanceWindows, { where: { team_id: team.id } });
		expect(matching).toHaveLength(0);
	});
});

describe("updateMaintenanceWindow", () => {
	test("updates the window's fields and redirects to the list", async () => {
		let { db, team, membership } = await createFixture();
		let window = await db.create(
			maintenanceWindows,
			{
				id: generateUUID(),
				team_id: team.id,
				monitor_id: null,
				name: "Original",
				starts_at: Date.now(),
				ends_at: Date.now() + 60_000,
				ended_early_at: null,
				suppress_alerts: true,
				show_on_status_page: true,
				is_recurring: false,
				recurring_pattern: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(
			db,
			team,
			membership,
			routes.actions.maintenanceWindow.update,
			updateMaintenanceWindow as RequestHandler<any>,
			"POST",
			{
				window_id: window.id,
				name: "Renamed",
				starts_at: "2026-08-01T00:00",
				ends_at: "2026-08-01T02:00",
			},
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.maintenanceWindows.index.href({ team: team.slug }),
		);

		let updated = await db.findOne(maintenanceWindows, { where: { id: window.id } });
		expect(updated?.name).toBe("Renamed");
	});

	test("responds 404 for a window that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(
			db,
			team,
			membership,
			routes.actions.maintenanceWindow.update,
			updateMaintenanceWindow as RequestHandler<any>,
			"POST",
			{
				window_id: generateUUID(),
				name: "Renamed",
				starts_at: "2026-08-01T00:00",
				ends_at: "2026-08-01T02:00",
			},
		);

		expect(response.status).toBe(404);
	});

	test("renders the edit form again without mutating when ends_at is before starts_at", async () => {
		let { db, team, membership } = await createFixture();
		let window = await db.create(
			maintenanceWindows,
			{
				id: generateUUID(),
				team_id: team.id,
				monitor_id: null,
				name: "Original",
				starts_at: Date.now(),
				ends_at: Date.now() + 60_000,
				ended_early_at: null,
				suppress_alerts: true,
				show_on_status_page: true,
				is_recurring: false,
				recurring_pattern: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(
			db,
			team,
			membership,
			routes.actions.maintenanceWindow.update,
			updateMaintenanceWindow as RequestHandler<any>,
			"POST",
			{
				window_id: window.id,
				name: "Renamed",
				starts_at: "2026-08-01T02:00",
				ends_at: "2026-08-01T00:00",
			},
		);

		expect(response.status).toBe(400);
		let body = await response.text();
		expect(body).toContain('value="Renamed"');
		expect(body).toContain("End the window after it starts.");

		let unchanged = await db.findOne(maintenanceWindows, { where: { id: window.id } });
		expect(unchanged?.name).toBe("Original");
	});
});

describe("deleteMaintenanceWindow", () => {
	test("deletes the window and redirects to the list", async () => {
		let { db, team, membership } = await createFixture();
		let window = await db.create(
			maintenanceWindows,
			{
				id: generateUUID(),
				team_id: team.id,
				monitor_id: null,
				name: "To delete",
				starts_at: Date.now(),
				ends_at: Date.now() + 60_000,
				ended_early_at: null,
				suppress_alerts: true,
				show_on_status_page: true,
				is_recurring: false,
				recurring_pattern: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(
			db,
			team,
			membership,
			routes.actions.maintenanceWindow.delete,
			deleteMaintenanceWindow as RequestHandler<any>,
			"DELETE",
			{ window_id: window.id },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.maintenanceWindows.index.href({ team: team.slug }),
		);

		let found = await db.findOne(maintenanceWindows, { where: { id: window.id } });
		expect(found).toBeNull();
	});

	test("responds 404 for a window that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(
			db,
			team,
			membership,
			routes.actions.maintenanceWindow.delete,
			deleteMaintenanceWindow as RequestHandler<any>,
			"DELETE",
			{ window_id: generateUUID() },
		);

		expect(response.status).toBe(404);
	});

	test("redirects back without deleting when window_id is missing", async () => {
		let { db, team, membership } = await createFixture();
		let window = await db.create(
			maintenanceWindows,
			{
				id: generateUUID(),
				team_id: team.id,
				monitor_id: null,
				name: "Untouched",
				starts_at: Date.now(),
				ends_at: Date.now() + 60_000,
				ended_early_at: null,
				suppress_alerts: true,
				show_on_status_page: true,
				is_recurring: false,
				recurring_pattern: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(
			db,
			team,
			membership,
			routes.actions.maintenanceWindow.delete,
			deleteMaintenanceWindow as RequestHandler<any>,
			"DELETE",
			{},
		);

		expect(response.status).toBe(303);

		let found = await db.findOne(maintenanceWindows, { where: { id: window.id } });
		expect(found).not.toBeNull();
	});
});

describe("endMaintenanceWindow", () => {
	test("marks the window ended early and redirects to the list", async () => {
		let { db, team, membership } = await createFixture();
		let window = await db.create(
			maintenanceWindows,
			{
				id: generateUUID(),
				team_id: team.id,
				monitor_id: null,
				name: "Active window",
				starts_at: Date.now() - 60_000,
				ends_at: Date.now() + 60_000,
				ended_early_at: null,
				suppress_alerts: true,
				show_on_status_page: true,
				is_recurring: false,
				recurring_pattern: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(
			db,
			team,
			membership,
			routes.actions.maintenanceWindow.end,
			endMaintenanceWindow as RequestHandler<any>,
			"POST",
			{ window_id: window.id },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.maintenanceWindows.index.href({ team: team.slug }),
		);

		let updated = await db.findOne(maintenanceWindows, { where: { id: window.id } });
		expect(updated?.ended_early_at).not.toBeNull();
	});

	test("responds 404 for a window that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(
			db,
			team,
			membership,
			routes.actions.maintenanceWindow.end,
			endMaintenanceWindow as RequestHandler<any>,
			"POST",
			{ window_id: generateUUID() },
		);

		expect(response.status).toBe(404);
	});
});
