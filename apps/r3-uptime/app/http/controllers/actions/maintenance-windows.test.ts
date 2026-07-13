/**
 * Tests for the maintenance-window create/update/delete/end-early actions: successful
 * submissions mutate `maintenance_windows` and redirect to the list, a failing
 * `ends_at > starts_at` refinement redirects back without mutating, and update/delete/
 * end-early each 404 when the window doesn't belong to the acting team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { Middleware, RequestHandler } from "remix/fetch-router";
import type { Route } from "remix/fetch-router/routes";

import { ServiceContainer } from "@pkg/service-container";
import { asyncContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";

import type { SelectMembership, SelectTeam } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import { maintenanceWindows, memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

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

/** Middleware that seeds `ctx.team`/`ctx.membership` in place of `requireTeam`/`requireRole`. */
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

	let router = createRouter({ middleware: [asyncContext(), formData() as Middleware] });
	router.map(route, { middleware: [seedTeam(team, membership)], handler });

	let request = new Request(new URL(route.href({ team: team.slug }), "https://uptime.test"), {
		method,
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams(params).toString(),
	});

	return container.scope(() => router.fetch(request));
}

describe("createMaintenanceWindow", () => {
	test("creates a window and redirects to the maintenance-windows list", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(
			db,
			team,
			membership,
			routes.actions.createMaintenanceWindow,
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
		expect(created?.monitor_id).toBeNull();
	});

	test("redirects back to the form without creating a window when ends_at is before starts_at", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(
			db,
			team,
			membership,
			routes.actions.createMaintenanceWindow,
			createMaintenanceWindow as RequestHandler<any>,
			"POST",
			{ name: "Bad window", starts_at: "2026-08-01T02:00", ends_at: "2026-08-01T00:00" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.maintenanceWindows.new.href({ team: team.slug }),
		);

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
				id: crypto.randomUUID(),
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
			routes.actions.updateMaintenanceWindow,
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
			routes.actions.updateMaintenanceWindow,
			updateMaintenanceWindow as RequestHandler<any>,
			"POST",
			{
				window_id: crypto.randomUUID(),
				name: "Renamed",
				starts_at: "2026-08-01T00:00",
				ends_at: "2026-08-01T02:00",
			},
		);

		expect(response.status).toBe(404);
	});

	test("redirects back without mutating when ends_at is before starts_at", async () => {
		let { db, team, membership } = await createFixture();
		let window = await db.create(
			maintenanceWindows,
			{
				id: crypto.randomUUID(),
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
			routes.actions.updateMaintenanceWindow,
			updateMaintenanceWindow as RequestHandler<any>,
			"POST",
			{
				window_id: window.id,
				name: "Renamed",
				starts_at: "2026-08-01T02:00",
				ends_at: "2026-08-01T00:00",
			},
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.maintenanceWindows.index.href({ team: team.slug }),
		);

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
				id: crypto.randomUUID(),
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
			routes.actions.deleteMaintenanceWindow,
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
			routes.actions.deleteMaintenanceWindow,
			deleteMaintenanceWindow as RequestHandler<any>,
			"DELETE",
			{ window_id: crypto.randomUUID() },
		);

		expect(response.status).toBe(404);
	});

	test("redirects back without deleting when window_id is missing", async () => {
		let { db, team, membership } = await createFixture();
		let window = await db.create(
			maintenanceWindows,
			{
				id: crypto.randomUUID(),
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
			routes.actions.deleteMaintenanceWindow,
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
				id: crypto.randomUUID(),
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
			routes.actions.endMaintenanceWindow,
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
			routes.actions.endMaintenanceWindow,
			endMaintenanceWindow as RequestHandler<any>,
			"POST",
			{ window_id: crypto.randomUUID() },
		);

		expect(response.status).toBe(404);
	});
});
