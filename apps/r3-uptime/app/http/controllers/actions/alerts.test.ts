/**
 * Tests the alert create/update/delete actions: successful create/update/delete
 * mutate `alerts` and redirect to the list; validation failure redirects without
 * mutating anything; the per-team alert cap and each action's team-scoped
 * not-found guard are covered directly. *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { ServiceContainer } from "@pkg/service-container";
import { asyncContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createRouter, type Middleware } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";

import type { SelectMembership, SelectTeam } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import { alerts, memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

let { createAlert, updateAlert, deleteAlert } = await import("./alerts");
let { MAX_ALERTS_PER_TEAM } = await import("~/app/data/alert");

/** Installs `ctx.team`/`ctx.membership` directly, standing in for `requireTeam`/`requireRole`. */
function teamContextMiddleware(team: SelectTeam, membership: SelectMembership): Middleware {
	return (ctx, next) => {
		(ctx as unknown as { team: SelectTeam }).team = team;
		(ctx as unknown as { membership: SelectMembership }).membership = membership;
		return next();
	};
}

/** Posts a form body to one of the alert actions through the real action, DB, and service container. */
async function postAlertAction(
	action: unknown,
	route: { method: string; href: (params: { team: string }) => string },
	team: SelectTeam,
	membership: SelectMembership,
	db: ReturnType<typeof createTestDatabase>["db"],
	body: Record<string, string>,
	headers: Record<string, string> = {},
) {
	let container = new ServiceContainer();
	container.singleton(Database, () => db);

	let router = createRouter({ middleware: [asyncContext(), formData()] });
	/**
	 * Casts `router.map` itself (rather than its arguments) so this helper can map
	 * several differently-shaped routes without losing type-checking elsewhere.
	 */
	(router.map as (target: unknown, handler: unknown) => void)(route, {
		middleware: [teamContextMiddleware(team, membership)],
		handler: action,
	});

	/** `del(...)` routes (e.g. `delete-alert`) only match a real HTTP `DELETE` request. */
	let request = new Request(`https://uptime.test${route.href({ team: team.slug })}`, {
		method: route.method,
		body: new URLSearchParams(body),
		headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
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

/** Minimal well-formed email-strategy alert form body. */
function emailAlertBody(overrides: Record<string, string> = {}): Record<string, string> {
	return {
		name: "Site down",
		strategy: "email",
		email_to: "ops@example.com",
		email_subject_prefix: "",
		...overrides,
	};
}

describe("POST /actions/:team/create-alert", () => {
	test("creates an email-strategy alert and redirects to the alerts list", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);

		let response = await postAlertAction(
			createAlert,
			routes.actions.alert.create,
			team,
			membership,
			db,
			emailAlertBody(),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.alerts.index.href({ team: team.slug }),
		);

		let created = await db.findOne(alerts, { where: { team_id: team.id } });
		expect(created?.name).toBe("Site down");
		expect(created?.config).toEqual({
			strategy: "email",
			config: { to: "ops@example.com", subjectPrefix: "" },
		});
	});

	test("rejects a blank name and redirects to the new-alert form without creating a row", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);

		let response = await postAlertAction(
			createAlert,
			routes.actions.alert.create,
			team,
			membership,
			db,
			emailAlertBody({ name: "" }),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.alerts.new.href({ team: team.slug }),
		);
		expect(await db.count(alerts, { where: { team_id: team.id } })).toBe(0);
	});

	test("rejects the email strategy without a valid recipient email", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);

		let response = await postAlertAction(
			createAlert,
			routes.actions.alert.create,
			team,
			membership,
			db,
			emailAlertBody({ email_to: "not-an-email" }),
		);

		expect(response.status).toBe(303);
		expect(await db.count(alerts, { where: { team_id: team.id } })).toBe(0);
	});

	test("returns 422 once the team is at the per-team alert cap, without creating a row", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);

		for (let i = 0; i < MAX_ALERTS_PER_TEAM; i++) {
			await db.create(
				alerts,
				{
					id: crypto.randomUUID(),
					team_id: team.id,
					monitor_id: null,
					name: `Alert ${i}`,
					notify_on_recovery: true,
					cooldown_minutes: 0,
					config: { strategy: "email", config: { to: "a@example.com", subjectPrefix: "" } },
				},
				{ touch: true, returnRow: true },
			);
		}

		let response = await postAlertAction(
			createAlert,
			routes.actions.alert.create,
			team,
			membership,
			db,
			emailAlertBody(),
		);

		expect(response.status).toBe(422);
		expect(await db.count(alerts, { where: { team_id: team.id } })).toBe(MAX_ALERTS_PER_TEAM);
	});
});

describe("POST /actions/:team/update-alert", () => {
	test("updates an existing alert and redirects to the alerts list", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let alert = await db.create(
			alerts,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				monitor_id: null,
				name: "Old name",
				notify_on_recovery: false,
				cooldown_minutes: 0,
				config: { strategy: "email", config: { to: "old@example.com", subjectPrefix: "" } },
			},
			{ touch: true, returnRow: true },
		);

		let response = await postAlertAction(
			updateAlert,
			routes.actions.alert.update,
			team,
			membership,
			db,
			emailAlertBody({ alert_id: alert.id, name: "New name" }),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.alerts.index.href({ team: team.slug }),
		);

		let updated = await db.findOne(alerts, { where: { id: alert.id } });
		expect(updated?.name).toBe("New name");
	});

	test("404s when the alert doesn't belong to the team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let otherTeam = await createTeamRow(db);
		let alert = await db.create(
			alerts,
			{
				id: crypto.randomUUID(),
				team_id: otherTeam.id,
				monitor_id: null,
				name: "Someone else's alert",
				notify_on_recovery: false,
				cooldown_minutes: 0,
				config: { strategy: "email", config: { to: "x@example.com", subjectPrefix: "" } },
			},
			{ touch: true, returnRow: true },
		);

		let response = await postAlertAction(
			updateAlert,
			routes.actions.alert.update,
			team,
			membership,
			db,
			emailAlertBody({ alert_id: alert.id, name: "Hijacked" }),
		);

		expect(response.status).toBe(404);
		let unchanged = await db.findOne(alerts, { where: { id: alert.id } });
		expect(unchanged?.name).toBe("Someone else's alert");
	});

	test("rejects a blank name and redirects without mutating the alert", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let alert = await db.create(
			alerts,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				monitor_id: null,
				name: "Original",
				notify_on_recovery: false,
				cooldown_minutes: 0,
				config: { strategy: "email", config: { to: "x@example.com", subjectPrefix: "" } },
			},
			{ touch: true, returnRow: true },
		);

		let response = await postAlertAction(
			updateAlert,
			routes.actions.alert.update,
			team,
			membership,
			db,
			emailAlertBody({ alert_id: alert.id, name: "" }),
		);

		expect(response.status).toBe(303);
		let unchanged = await db.findOne(alerts, { where: { id: alert.id } });
		expect(unchanged?.name).toBe("Original");
	});
});

describe("POST /actions/:team/delete-alert", () => {
	test("deletes an existing alert and redirects to the alerts list", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let alert = await db.create(
			alerts,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				monitor_id: null,
				name: "To delete",
				notify_on_recovery: false,
				cooldown_minutes: 0,
				config: { strategy: "email", config: { to: "x@example.com", subjectPrefix: "" } },
			},
			{ touch: true, returnRow: true },
		);

		let response = await postAlertAction(
			deleteAlert,
			routes.actions.alert.delete,
			team,
			membership,
			db,
			{ alert_id: alert.id },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.alerts.index.href({ team: team.slug }),
		);
		expect(await db.findOne(alerts, { where: { id: alert.id } })).toBeNull();
	});

	test("404s when the alert doesn't belong to the team, without deleting it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let otherTeam = await createTeamRow(db);
		let alert = await db.create(
			alerts,
			{
				id: crypto.randomUUID(),
				team_id: otherTeam.id,
				monitor_id: null,
				name: "Not yours",
				notify_on_recovery: false,
				cooldown_minutes: 0,
				config: { strategy: "email", config: { to: "x@example.com", subjectPrefix: "" } },
			},
			{ touch: true, returnRow: true },
		);

		let response = await postAlertAction(
			deleteAlert,
			routes.actions.alert.delete,
			team,
			membership,
			db,
			{ alert_id: alert.id },
		);

		expect(response.status).toBe(404);
		expect(await db.findOne(alerts, { where: { id: alert.id } })).not.toBeNull();
	});

	test("rejects a missing alert_id and redirects without deleting anything", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let alert = await db.create(
			alerts,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				monitor_id: null,
				name: "Still here",
				notify_on_recovery: false,
				cooldown_minutes: 0,
				config: { strategy: "email", config: { to: "x@example.com", subjectPrefix: "" } },
			},
			{ touch: true, returnRow: true },
		);

		let response = await postAlertAction(
			deleteAlert,
			routes.actions.alert.delete,
			team,
			membership,
			db,
			{ unrelated: "value" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.alerts.index.href({ team: team.slug }),
		);
		expect(await db.findOne(alerts, { where: { id: alert.id } })).not.toBeNull();
	});
});
