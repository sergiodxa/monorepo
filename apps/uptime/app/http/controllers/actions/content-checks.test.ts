/**
 * Tests the monitor content-check create/delete actions: a successful create adds a
 * row (capped at 10 per monitor, invalid regexes rejected at creation time) and
 * redirects to the monitor's edit page; a successful delete removes the row;
 * validation failure and the monitor-scoped not-found guards leave
 * `monitor_content_checks` untouched.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEnv } from "@sdxc/cloudflare-mocks";
import { ServiceContainer } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { createRouter, type Middleware } from "remix/router";
import { describe, expect, test, vi } from "vitest";

import type { SelectMembership, SelectTeam } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import { memberships, monitorContentChecks, teams } from "~/database/schema";
import routes from "~/routes/web";

/**
 * `app/data/monitor.ts` reads `env` from `cloudflare:workers` at module load
 * time, so importing `./content-checks` needs one installed here. No binding
 * is supplied, so any path that reaches it fails by name, not as `undefined`.
 */
vi.doMock("cloudflare:workers", () => ({ env: createEnv<Env>({}) }));

let { createContentCheck, deleteContentCheck } = await import("./content-checks");
let { default: Monitor } = await import("~/app/data/monitor");

/** Installs `ctx.team`/`ctx.membership` directly, standing in for `requireTeam`/`requireRole`. */
function teamContextMiddleware(team: SelectTeam, membership: SelectMembership): Middleware {
	return (ctx, next) => {
		(ctx as unknown as { team: SelectTeam }).team = team;
		(ctx as unknown as { membership: SelectMembership }).membership = membership;
		return next();
	};
}

/** Posts a form body to one of the content-check actions through the real action, DB, and service container. */
async function postContentCheckAction(
	action: unknown,
	route: { method: string; href: (params: { team: string }) => string },
	team: SelectTeam,
	membership: SelectMembership,
	db: ReturnType<typeof createTestDatabase>["db"],
	body: Record<string, string>,
) {
	let container = new ServiceContainer();
	container.singleton(Database, () => db);

	let router = createRouter({ middleware: [asyncContext(), formData()] });
	/**
	 * Casts `router.map` itself so this helper can map several differently-shaped
	 * routes without losing type-checking elsewhere.
	 */
	(router.map as (target: unknown, handler: unknown) => void)(route, {
		middleware: [teamContextMiddleware(team, membership)],
		handler: action,
	});

	/** `del(...)` routes (e.g. `delete-content-check`) only match a real HTTP `DELETE` request. */
	let request = new Request(`https://uptime.test${route.href({ team: team.slug })}`, {
		method: route.method,
		body: new URLSearchParams(body),
		headers: { "content-type": "application/x-www-form-urlencoded" },
	});

	return container.scope(() => router.fetch(request));
}

async function createTeamRow(db: ReturnType<typeof createTestDatabase>["db"]) {
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

async function createMembershipRow(
	db: ReturnType<typeof createTestDatabase>["db"],
	teamId: string,
) {
	return await db.create(
		memberships,
		{ id: crypto.randomUUID(), team_id: teamId, subject_id: crypto.randomUUID(), role: "admin" },
		{ touch: true, returnRow: true },
	);
}

async function createMonitorRow(db: ReturnType<typeof createTestDatabase>["db"], teamId: string) {
	return await Monitor.create(db, teamId, "author-1", {
		name: "Homepage",
		url: "https://example.com",
	});
}

describe("POST /actions/:team/create-content-check", () => {
	test("creates a content check and redirects to the monitor's edit page", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let monitor = await createMonitorRow(db, team.id);

		let response = await postContentCheckAction(
			createContentCheck,
			routes.actions.monitor.http.createContentCheck,
			team,
			membership,
			db,
			{ monitor_id: monitor.id, type: "contains", value: "OK" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.monitors.edit.href({ team: team.slug, monitorId: monitor.id }),
		);

		let created = await db.findOne(monitorContentChecks, { where: { monitor_id: monitor.id } });
		expect(created?.type).toBe("contains");
		expect(created?.value).toBe("OK");
		expect(created?.is_enabled).toBeTruthy();
	});

	test("rejects a blank value and redirects to the dashboard without creating a row", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let monitor = await createMonitorRow(db, team.id);

		let response = await postContentCheckAction(
			createContentCheck,
			routes.actions.monitor.http.createContentCheck,
			team,
			membership,
			db,
			{ monitor_id: monitor.id, type: "contains", value: "" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.dashboard.index.href({ team: team.slug }),
		);
		expect(await db.count(monitorContentChecks, { where: { monitor_id: monitor.id } })).toBe(0);
	});

	test("rejects an invalid regex pattern, making no DB mutation", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let monitor = await createMonitorRow(db, team.id);

		let response = await postContentCheckAction(
			createContentCheck,
			routes.actions.monitor.http.createContentCheck,
			team,
			membership,
			db,
			{ monitor_id: monitor.id, type: "regex", value: "(unclosed" },
		);

		expect(response.status).toBe(303);
		expect(await db.count(monitorContentChecks, { where: { monitor_id: monitor.id } })).toBe(0);
	});

	test("404s when the monitor doesn't belong to the team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let otherTeam = await createTeamRow(db);
		let monitor = await createMonitorRow(db, otherTeam.id);

		let response = await postContentCheckAction(
			createContentCheck,
			routes.actions.monitor.http.createContentCheck,
			team,
			membership,
			db,
			{ monitor_id: monitor.id, type: "contains", value: "OK" },
		);

		expect(response.status).toBe(404);
		expect(await db.count(monitorContentChecks, { where: { monitor_id: monitor.id } })).toBe(0);
	});

	test("returns 422 once a monitor is at its 10 content-check cap, without creating a row", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let monitor = await createMonitorRow(db, team.id);

		for (let i = 0; i < 10; i++) {
			await db.create(
				monitorContentChecks,
				{
					id: crypto.randomUUID(),
					monitor_id: monitor.id,
					type: "contains",
					value: `check-${i}`,
					case_sensitive: false,
					is_enabled: true,
				},
				{ touch: true, returnRow: true },
			);
		}

		let response = await postContentCheckAction(
			createContentCheck,
			routes.actions.monitor.http.createContentCheck,
			team,
			membership,
			db,
			{ monitor_id: monitor.id, type: "contains", value: "one too many" },
		);

		expect(response.status).toBe(422);
		expect(await db.count(monitorContentChecks, { where: { monitor_id: monitor.id } })).toBe(10);
	});
});

describe("DELETE /actions/:team/delete-content-check", () => {
	test("deletes an existing content check and redirects to the monitor's edit page", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let monitor = await createMonitorRow(db, team.id);
		let check = await db.create(
			monitorContentChecks,
			{
				id: crypto.randomUUID(),
				monitor_id: monitor.id,
				type: "contains",
				value: "to delete",
				case_sensitive: false,
				is_enabled: true,
			},
			{ touch: true, returnRow: true },
		);

		let response = await postContentCheckAction(
			deleteContentCheck,
			routes.actions.monitor.http.deleteContentCheck,
			team,
			membership,
			db,
			{ monitor_id: monitor.id, content_check_id: check.id },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.monitors.edit.href({ team: team.slug, monitorId: monitor.id }),
		);
		expect(await db.findOne(monitorContentChecks, { where: { id: check.id } })).toBeNull();
	});

	test("404s when the monitor doesn't belong to the team, without deleting the check", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let otherTeam = await createTeamRow(db);
		let monitor = await createMonitorRow(db, otherTeam.id);
		let check = await db.create(
			monitorContentChecks,
			{
				id: crypto.randomUUID(),
				monitor_id: monitor.id,
				type: "contains",
				value: "not yours",
				case_sensitive: false,
				is_enabled: true,
			},
			{ touch: true, returnRow: true },
		);

		let response = await postContentCheckAction(
			deleteContentCheck,
			routes.actions.monitor.http.deleteContentCheck,
			team,
			membership,
			db,
			{ monitor_id: monitor.id, content_check_id: check.id },
		);

		expect(response.status).toBe(404);
		expect(await db.findOne(monitorContentChecks, { where: { id: check.id } })).not.toBeNull();
	});

	test("404s when the check doesn't belong to the monitor, without deleting it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let monitor = await createMonitorRow(db, team.id);
		let otherMonitor = await createMonitorRow(db, team.id);
		let check = await db.create(
			monitorContentChecks,
			{
				id: crypto.randomUUID(),
				monitor_id: otherMonitor.id,
				type: "contains",
				value: "wrong monitor",
				case_sensitive: false,
				is_enabled: true,
			},
			{ touch: true, returnRow: true },
		);

		let response = await postContentCheckAction(
			deleteContentCheck,
			routes.actions.monitor.http.deleteContentCheck,
			team,
			membership,
			db,
			{ monitor_id: monitor.id, content_check_id: check.id },
		);

		expect(response.status).toBe(404);
		expect(await db.findOne(monitorContentChecks, { where: { id: check.id } })).not.toBeNull();
	});

	test("rejects a missing content_check_id and redirects without deleting anything", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let monitor = await createMonitorRow(db, team.id);
		let check = await db.create(
			monitorContentChecks,
			{
				id: crypto.randomUUID(),
				monitor_id: monitor.id,
				type: "contains",
				value: "still here",
				case_sensitive: false,
				is_enabled: true,
			},
			{ touch: true, returnRow: true },
		);

		let response = await postContentCheckAction(
			deleteContentCheck,
			routes.actions.monitor.http.deleteContentCheck,
			team,
			membership,
			db,
			{ monitor_id: monitor.id },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.dashboard.index.href({ team: team.slug }),
		);
		expect(await db.findOne(monitorContentChecks, { where: { id: check.id } })).not.toBeNull();
	});
});
