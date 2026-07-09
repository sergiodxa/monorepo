/**
 * Tests the `setDashboardTab` action: a valid tab is written to the dashboard-tab
 * cookie and the visitor is redirected back to their dashboard; an invalid tab is
 * rejected by the schema but still redirects (there is no flash/error UI for this
 * one — the cookie is simply left unchanged).
 *
 * `@pkg/validate` flattens `FormData`/`URLSearchParams` into a plain object before
 * handing it to the schema, but `remix/data-schema/form-data`'s `f.object()` (which
 * every schema in this app is built with) validates the raw `FormData`/
 * `URLSearchParams` directly and rejects a flattened object with "Expected FormData
 * or URLSearchParams". As shipped, that means `validate(ctx.formData, ...)` always
 * fails — for every action in this app, regardless of whether the submitted data is
 * actually valid. This is a real, reproducible bug in the shared `@pkg/validate`
 * package (see the task flagged for it), not something wrong with this action. The
 * mock below forwards the form container straight to the schema instead of
 * flattening it, so these tests exercise `setDashboardTab`'s real branching instead
 * of always hitting the validation-error path; it can be deleted once the real
 * `@pkg/validate` is fixed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, mock, test } from "bun:test";

import type { RequestHandler } from "remix/fetch-router";

import { failure, success } from "@pkg/result";
import { ServiceContainer } from "@pkg/service-container";
import { asyncContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";

import type { SelectMembership, SelectTeam } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import { teams } from "~/database/schema";
import routes from "~/routes/web";

mock.module("@pkg/validate", () => ({
	async validate(
		input: unknown,
		schema: { "~standard": { validate: (value: unknown) => unknown } },
	) {
		let result = (await schema["~standard"].validate(input)) as
			| { issues: Array<{ message: string }> }
			| { value: unknown };

		if ("issues" in result && result.issues) {
			let error = new Error(result.issues[0]?.message ?? "Validation failed") as Error & {
				issues: Array<{ message: string }>;
			};
			error.issues = result.issues;
			return failure(error);
		}

		return success((result as { value: unknown }).value);
	},
}));

let { setDashboardTab } = await import("./dashboard");

/** Installs `ctx.team`/`ctx.membership` directly, standing in for `requireTeam`/`requireRole`. */
function teamContextMiddleware(team: SelectTeam, membership: SelectMembership | null) {
	return (ctx: Record<string, unknown>, next: () => Response | Promise<Response>) => {
		ctx.team = team;
		ctx.membership = membership;
		return next();
	};
}

/** Posts a `set-dashboard-tab` form body through the real action, DB, and service container. */
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
		handler: setDashboardTab as RequestHandler,
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
			routes.app.team.dashboard.href({ team: team.slug }),
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
			routes.app.team.dashboard.href({ team: team.slug }),
		);
		expect(response.headers.get("Set-Cookie")).toBeNull();
	});
});
