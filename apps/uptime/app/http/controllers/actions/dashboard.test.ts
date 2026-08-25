/**
 * Tests the `setDashboardTab` action: a valid tab is written to the dashboard-tab
 * cookie and the visitor is redirected back to their dashboard; an invalid tab is
 * rejected by the schema but still redirects (there is no flash/error UI for this
 * one — the cookie is simply left unchanged). *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestHandler } from "remix/router";

import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { SelectMembership, SelectTeam } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import { teams } from "~/database/schema";
import routes from "~/routes/web";

let { setDashboardTab } = await import("./dashboard");

/** Installs `ctx.team`/`ctx.membership` directly, standing in for `requireTeam`/`requireRole`. */
function teamContextMiddleware(team: SelectTeam, membership: SelectMembership | null) {
	return (ctx: Record<string, unknown>, next: () => Response | Promise<Response>) => {
		ctx.team = team;
		ctx.membership = membership;
		return next();
	};
}

/**
 * Posts a `set-dashboard-tab` form body through the real action, DB, and
 * service container, using `teamContextMiddleware` in place of
 * `setDashboardTab`'s own `requireUser`/`requireTeam` chain.
 */
async function postSetDashboardTab(
	db: ReturnType<typeof createTestDatabase>["db"],
	team: SelectTeam,
	body: Record<string, string>,
) {
	let container = new ServiceContainer();
	container.singleton(Database, () => db);

	let router = createRouter({ middleware: [asyncContext(), formData()] });
	router.map(routes.actions.setDashboardTab, {
		middleware: [teamContextMiddleware(team, null) as never],
		handler: (setDashboardTab as { handler: RequestHandler }).handler,
	});

	let request = new Request(
		`https://uptime.test${routes.actions.setDashboardTab.href({ team: team.slug })}`,
		{
			method: "POST",
			body: new URLSearchParams(body),
			headers: { "content-type": "application/x-www-form-urlencoded" },
		},
	);

	return container.scope(() => router.fetch(request));
}

/** Inserts a minimal team row. */
async function createTeam(db: ReturnType<typeof createTestDatabase>["db"]) {
	return await db.create(
		teams,
		{
			id: crypto.randomUUID(),
			owner_id: crypto.randomUUID(),
			name: "Acme",
			slug: `acme-${crypto.randomUUID()}`,
			logo: null,
		},
		{ touch: true, returnRow: true },
	);
}

describe("POST /actions/:team/set-dashboard-tab", () => {
	test("stores a valid tab in the dashboard-tab cookie and redirects to the dashboard", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);

		let response = await postSetDashboardTab(db, team, { tab: "dns" });

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.dashboard.index.href({ team: team.slug }),
		);
		expect(response.headers.get("Set-Cookie")).not.toBeNull();
		expect(response.headers.get("Set-Cookie")).toContain("uptime:dashboard-tab=ZG5z");
	});

	test("rejects a tab outside the enum and redirects without setting the cookie", async () => {
		let { db } = createTestDatabase();
		let team = await createTeam(db);

		let response = await postSetDashboardTab(db, team, { tab: "not-a-real-tab" });

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.dashboard.index.href({ team: team.slug }),
		);
		expect(response.headers.get("Set-Cookie")).toBeNull();
	});
});
