/**
 * Tests for the monitor run-status probe controller. `cloudflare:workers` is mocked
 * because `~/app/data/monitor` reads `env` at module load. The route exists so a hydrated
 * page can tell a freshly committed check apart from the one that was already there, so
 * what is pinned here is that both the status and the instant come back verbatim —
 * including the never-checked case, where both are `null` and must not be coerced.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, mock, test } from "bun:test";

import type { Middleware, RequestHandler } from "remix/router";

import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { createRouter } from "remix/router";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import { memberships, monitors, teams } from "~/database/schema";
import routes from "~/routes/web";

mock.module("cloudflare:workers", () => ({
	env: { CLOUDFLARE_ACCOUNT_ID: "acct-1", CLOUDFLARE_ANALYTICS_TOKEN: "token-1" },
}));

let monitorRunStatus = (await import("./monitor-run-status")).default as {
	handler: RequestHandler<any>;
};

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
		ctx.teams = [team];
		ctx.set(Auth, { ok: true, identity: viewer, method: "test" });
		return next();
	};
}

/** Creates an in-memory database seeded with one team, an owner's membership, and one monitor. */
async function createFixture(monitorChanges: Record<string, unknown> = {}) {
	let { db } = createTestDatabase();

	let team = await db.create(
		teams,
		{ id: crypto.randomUUID(), owner_id: "owner-1", name: "Acme", slug: "acme", logo: null },
		{ touch: true, returnRow: true },
	);
	let membership = await db.create(
		memberships,
		{ id: crypto.randomUUID(), subject_id: "owner-1", team_id: team.id, role: "admin" },
		{ touch: true, returnRow: true },
	);
	let monitor = await db.create(
		monitors,
		{
			id: crypto.randomUUID(),
			team_id: team.id,
			author_id: membership.subject_id,
			enabled_at: Date.now(),
			name: "Homepage",
			url: "https://example.com",
			...monitorChanges,
		},
		{ touch: true, returnRow: true },
	);

	return { db, team, membership, monitor };
}

/** Sends a GET request through a minimal router mapping only the run-status route. */
async function send(
	db: Database,
	team: SelectTeam,
	membership: SelectMembership,
	monitorId: string,
): Promise<Response> {
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({ middleware: [asyncContext()] });
	router.map(routes.app.team.monitors.runStatus, {
		middleware: [seedTeam(team, membership)],
		handler: monitorRunStatus.handler,
	});

	let request = new Request(
		new URL(
			routes.app.team.monitors.runStatus.href({ team: team.slug, monitorId }),
			"https://uptime.test",
		),
	);

	return container.scope(() => router.fetch(request));
}

describe("monitor-run-status", () => {
	test("answers with the monitor's cached last status and last-checked instant", async () => {
		let checkedAt = Date.now();
		let { db, team, membership, monitor } = await createFixture({
			last_status: "degraded",
			last_checked_at: checkedAt,
		});

		let response = await send(db, team, membership, monitor.id);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: "degraded", checkedAt });
	});

	/**
	 * A monitor that has never completed a check is the baseline a first run is compared
	 * against, so both fields have to stay `null` rather than becoming `0`/`"unknown"` —
	 * the poller treats "the instant moved" as the signal that a check landed.
	 */
	test("reports nulls for a monitor that has never been checked", async () => {
		let { db, team, membership, monitor } = await createFixture();

		let response = await send(db, team, membership, monitor.id);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: null, checkedAt: null });
	});

	test("404s for a monitor that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(db, team, membership, crypto.randomUUID());
		expect(response.status).toBe(404);
	});
});
