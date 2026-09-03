/**
 * Tests for the `update-ssl` action: a successful submission classifies the SSL
 * status from the entered expiry date and redirects to the monitor's edit page,
 * disabling monitoring resets the status to `unknown`, an invalid submission
 * redirects back without mutating, and a monitor outside the team 404s.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestHandler } from "remix/router";

import { createEnv } from "@sdxc/cloudflare-mocks";
import { ServiceContainer } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";
import { describe, expect, test, vi } from "vitest";

import type { SelectMembership, SelectTeam } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import { memberships, monitors, teams } from "~/database/schema";
import routes from "~/routes/web";

/**
 * The action imports `~/app/data/monitor`, which imports `env` from
 * `cloudflare:workers`, so this test installs one before importing below. No
 * bindings are supplied, so reading one throws by name — proof these paths touch none.
 */
vi.doMock("cloudflare:workers", () => ({ env: createEnv<Env>({}) }));

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
	router.map(routes.actions.monitor.http.updateSsl, {
		middleware: [seedTeam(team, membership)],
		handler: updateSsl as RequestHandler<any>,
	});

	let request = new Request(
		new URL(routes.actions.monitor.http.updateSsl.href({ team: team.slug }), "https://uptime.test"),
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
			routes.app.team.monitors.edit.href({ team: team.slug, monitorId: monitor.id }),
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
