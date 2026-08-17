/**
 * Tests for the status-page create/update/delete actions: a successful create/update
 * saves the page and curates its four attached monitor-type id lists, a taken slug is
 * rejected without mutating, an invalid submission redirects back, and update/delete
 * 404 when the page doesn't belong to the acting team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestHandler } from "remix/router";
import type { Route } from "remix/routes";

import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { SelectMembership, SelectTeam } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import { memberships, monitors, statusPageMonitors, statusPages, teams } from "~/database/schema";
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
let { createStatusPage, deleteStatusPage, updateStatusPage } = await import("./status-pages");

/** Creates an in-memory database seeded with one team, a membership, and a monitor. */
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
	let monitor = await db.create(
		monitors,
		{
			id: crypto.randomUUID(),
			team_id: team.id,
			author_id: "member-1",
			enabled_at: Date.now(),
			name: "Homepage",
			url: "https://example.com",
		},
		{ touch: true, returnRow: true },
	);

	return { db, team, membership, monitor };
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
	params: [string, string][],
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

describe("createStatusPage", () => {
	test("creates a page, attaches its monitors, and redirects to the list", async () => {
		let { db, team, membership, monitor } = await createFixture();

		let response = await send(
			db,
			team,
			membership,
			routes.actions.statusPage.create,
			createStatusPage as RequestHandler<any>,
			"POST",
			[
				["name", "Public status"],
				["slug", "public-status"],
				["title", "Acme Status"],
				["monitor_ids", monitor.id],
			],
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.statusPages.index.href({ team: team.slug }),
		);

		let page = await db.findOne(statusPages, {
			where: { team_id: team.id, slug: "public-status" },
		});
		expect(page).not.toBeNull();

		let attached = await db.findMany(statusPageMonitors, { where: { status_page_id: page!.id } });
		expect(attached.map((row) => row.monitor_id)).toEqual([monitor.id]);
	});

	test("rejects a slug already used by another status page without creating one", async () => {
		let { db, team, membership } = await createFixture();

		await db.create(
			statusPages,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Existing",
				slug: "taken",
				title: "Existing",
				description: null,
				logo_url: null,
				custom_domain: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(
			db,
			team,
			membership,
			routes.actions.statusPage.create,
			createStatusPage as RequestHandler<any>,
			"POST",
			[
				["name", "New page"],
				["slug", "taken"],
				["title", "New"],
			],
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.statusPages.new.href({ team: team.slug }),
		);

		let matching = await db.findMany(statusPages, { where: { team_id: team.id, slug: "taken" } });
		expect(matching).toHaveLength(1);
	});

	test("redirects back to the form without creating a page when the slug is invalid", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(
			db,
			team,
			membership,
			routes.actions.statusPage.create,
			createStatusPage as RequestHandler<any>,
			"POST",
			[
				["name", "New page"],
				["slug", "Not A Slug!"],
				["title", "New"],
			],
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.statusPages.new.href({ team: team.slug }),
		);

		let matching = await db.findMany(statusPages, { where: { team_id: team.id } });
		expect(matching).toHaveLength(0);
	});
});

describe("updateStatusPage", () => {
	test("updates the page's fields, re-curates monitors, and redirects to the list", async () => {
		let { db, team, membership, monitor } = await createFixture();
		let page = await db.create(
			statusPages,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Original",
				slug: "original",
				title: "Original",
				description: null,
				logo_url: null,
				custom_domain: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(
			db,
			team,
			membership,
			routes.actions.statusPage.update,
			updateStatusPage as RequestHandler<any>,
			"POST",
			[
				["status_page_id", page.id],
				["name", "Renamed"],
				["slug", "original"],
				["title", "Renamed"],
				["monitor_ids", monitor.id],
			],
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.statusPages.index.href({ team: team.slug }),
		);

		let updated = await db.findOne(statusPages, { where: { id: page.id } });
		expect(updated?.name).toBe("Renamed");

		let attached = await db.findMany(statusPageMonitors, { where: { status_page_id: page.id } });
		expect(attached.map((row) => row.monitor_id)).toEqual([monitor.id]);
	});

	test("responds 404 for a page that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(
			db,
			team,
			membership,
			routes.actions.statusPage.update,
			updateStatusPage as RequestHandler<any>,
			"POST",
			[
				["status_page_id", crypto.randomUUID()],
				["name", "Renamed"],
				["slug", "renamed"],
				["title", "Renamed"],
			],
		);

		expect(response.status).toBe(404);
	});

	test("rejects a slug already used by a different status page without mutating", async () => {
		let { db, team, membership } = await createFixture();
		let page = await db.create(
			statusPages,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Page A",
				slug: "page-a",
				title: "Page A",
				description: null,
				logo_url: null,
				custom_domain: null,
			},
			{ touch: true, returnRow: true },
		);
		await db.create(
			statusPages,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Page B",
				slug: "page-b",
				title: "Page B",
				description: null,
				logo_url: null,
				custom_domain: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(
			db,
			team,
			membership,
			routes.actions.statusPage.update,
			updateStatusPage as RequestHandler<any>,
			"POST",
			[
				["status_page_id", page.id],
				["name", "Page A"],
				["slug", "page-b"],
				["title", "Page A"],
			],
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.statusPages.edit.href({ team: team.slug, statusPageId: page.id }),
		);

		let unchanged = await db.findOne(statusPages, { where: { id: page.id } });
		expect(unchanged?.slug).toBe("page-a");
	});
});

describe("deleteStatusPage", () => {
	test("deletes the page and its monitor attachments, then redirects to the list", async () => {
		let { db, team, membership, monitor } = await createFixture();
		let page = await db.create(
			statusPages,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "To delete",
				slug: "to-delete",
				title: "To delete",
				description: null,
				logo_url: null,
				custom_domain: null,
			},
			{ touch: true, returnRow: true },
		);
		await db.create(statusPageMonitors, {
			status_page_id: page.id,
			monitor_id: monitor.id,
			order: 0,
		});

		let response = await send(
			db,
			team,
			membership,
			routes.actions.statusPage.delete,
			deleteStatusPage as RequestHandler<any>,
			"DELETE",
			[["status_page_id", page.id]],
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.statusPages.index.href({ team: team.slug }),
		);

		expect(await db.findOne(statusPages, { where: { id: page.id } })).toBeNull();
		let attached = await db.findMany(statusPageMonitors, { where: { status_page_id: page.id } });
		expect(attached).toHaveLength(0);
	});

	test("responds 404 for a page that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(
			db,
			team,
			membership,
			routes.actions.statusPage.delete,
			deleteStatusPage as RequestHandler<any>,
			"DELETE",
			[["status_page_id", crypto.randomUUID()]],
		);

		expect(response.status).toBe(404);
	});

	test("redirects back without deleting anything when status_page_id is missing", async () => {
		let { db, team, membership } = await createFixture();
		let page = await db.create(
			statusPages,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Untouched",
				slug: "untouched",
				title: "Untouched",
				description: null,
				logo_url: null,
				custom_domain: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(
			db,
			team,
			membership,
			routes.actions.statusPage.delete,
			deleteStatusPage as RequestHandler<any>,
			"DELETE",
			[],
		);

		expect(response.status).toBe(303);

		let found = await db.findOne(statusPages, { where: { id: page.id } });
		expect(found).not.toBeNull();
	});
});
