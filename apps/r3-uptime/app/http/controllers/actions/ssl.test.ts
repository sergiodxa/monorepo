/**
 * Tests for the `update-ssl` action: a successful submission classifies the SSL
 * status from the entered expiry date and redirects to the monitor's edit page,
 * disabling monitoring resets the status to `unknown`, an invalid submission
 * redirects back without mutating, and a monitor outside the team 404s.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { Middleware, RequestHandler } from "remix/fetch-router";

import { ServiceContainer } from "@pkg/service-container";
import { asyncContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";

import type { SelectMembership, SelectTeam } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import { memberships, monitors, teams } from "~/database/schema";
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
let { updateSsl } = await import("./ssl");

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

/** Sends a form request through a minimal router mapping the `update-ssl` action. */
async function send(
	db: Database,
	team: SelectTeam,
	membership: SelectMembership,
	params: Record<string, string>,
): Promise<Response> {
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({ middleware: [asyncContext(), formData() as Middleware] });
	router.map(routes.actions.updateSsl, {
		middleware: [seedTeam(team, membership)],
		handler: updateSsl as RequestHandler<any>,
	});

	let request = new Request(
		new URL(routes.actions.updateSsl.href({ team: team.slug }), "https://uptime.test"),
		{
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams(params).toString(),
		},
	);

	return container.scope(() => router.fetch(request));
}

describe("updateSsl", () => {
	test("saves the expiry, classifies it as valid, and redirects to the monitor's edit page", async () => {
		let { db, team, membership, monitor } = await createFixture();

		let farExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

		let response = await send(db, team, membership, {
			monitor_id: monitor.id,
			ssl_monitoring_enabled: "true",
			ssl_expiry_warning_days: "30",
			ssl_expires_at: farExpiry,
			ssl_issuer: "Let's Encrypt",
		});

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.monitorEdit.href({ team: team.slug, monitorId: monitor.id }),
		);

		let updated = await db.findOne(monitors, { where: { id: monitor.id } });
		expect(updated?.ssl_monitoring_enabled).toBeTruthy();
		expect(updated?.ssl_status).toBe("valid");
		expect(updated?.ssl_issuer).toBe("Let's Encrypt");
		expect(updated?.ssl_last_checked_at).not.toBeNull();
	});

	test("resets the status to unknown when monitoring is disabled", async () => {
		let { db, team, membership, monitor } = await createFixture();

		let response = await send(db, team, membership, {
			monitor_id: monitor.id,
			ssl_monitoring_enabled: "false",
		});

		expect(response.status).toBe(303);

		let updated = await db.findOne(monitors, { where: { id: monitor.id } });
		expect(updated?.ssl_monitoring_enabled).toBeFalsy();
		expect(updated?.ssl_status).toBe("unknown");
		expect(updated?.ssl_last_checked_at).toBeNull();
	});

	test("responds 404 for a monitor that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(db, team, membership, {
			monitor_id: crypto.randomUUID(),
			ssl_monitoring_enabled: "true",
		});

		expect(response.status).toBe(404);
	});

	test("redirects back to the dashboard without mutating when monitor_id is missing", async () => {
		let { db, team, membership, monitor } = await createFixture();

		let response = await send(db, team, membership, { ssl_monitoring_enabled: "true" });

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.dashboard.index.href({ team: team.slug }),
		);

		let unchanged = await db.findOne(monitors, { where: { id: monitor.id } });
		expect(unchanged?.ssl_monitoring_enabled).toBeFalsy();
	});
});
