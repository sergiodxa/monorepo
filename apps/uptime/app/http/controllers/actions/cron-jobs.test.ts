/**
 * Tests the cron-job monitor create/update/delete actions: a successful create or update
 * schedules `next_expected_at` and redirects to the monitor; a refused save renders its form
 * again with what was typed and the issue, before any write; the team-scoped not-found guard
 * leaves `cron_job_monitors` untouched.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { Middleware, RequestContext } from "remix/router";

import { database } from "@sdxc/database-middleware";
import { generateUUID } from "@sdxc/uuid/v4";
import { renderToStream } from "remix/component/server";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { formData } from "remix/middleware/form-data";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import { teamAccess } from "~/app/http/middleware/access";
import i18n from "~/app/http/middleware/i18n";
import models from "~/app/http/middleware/models";
import { createTestDatabase } from "~/app/test/db";
import { testAssets } from "~/app/test/document-assets";
import { cronJobMonitors, memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

let { createCronJob, updateCronJob, deleteCronJob } = await import("./cron-jobs");

/**
 * Installs `ctx.team`/`ctx.membership`/`ctx.teams`, the signed-in viewer and `ctx.access`,
 * standing in for `requireUser`/`requireTeam`, since a refused save renders the form page.
 */
function teamContextMiddleware(team: SelectTeam, membership: SelectMembership): Middleware {
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
		return teamAccess(ctx, next);
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

/**
 * Posts a form body to one of the cron-job actions through the real action and a real
 * database, including `i18n` since the actions flash translated toasts and need
 * `ctx.intl` present when the router runs.
 */
async function postCronJobAction(
	action: unknown,
	route: { method: string; href: (params: { team: string }) => string },
	team: SelectTeam,
	membership: SelectMembership,
	db: ReturnType<typeof createTestDatabase>["db"],
	body: Record<string, string>,
	headers: Record<string, string> = {},
) {
	let router = createRouter({
		middleware: [
			asyncContext(),
			database(db),
			models(),
			formData(),
			i18n,
			testAssets(),
			renderWith(createHtmlRenderer) as Middleware,
		],
	});
	/**
	 * Casts `router.map` itself so this helper can map several differently-shaped
	 * routes without losing type-checking elsewhere.
	 */
	(router.map as (target: unknown, handler: unknown) => void)(route, {
		middleware: [teamContextMiddleware(team, membership)],
		handler: action,
	});

	/** `del(...)` routes (e.g. `delete-cron-job`) only match a real HTTP `DELETE` request. */
	let request = new Request(`https://uptime.test${route.href({ team: team.slug })}`, {
		method: route.method,
		body: new URLSearchParams(body),
		headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
	});

	return router.fetch(request);
}

async function createTeamRow(db: ReturnType<typeof createTestDatabase>["db"]) {
	return await db.create(
		teams,
		{
			id: generateUUID(),
			owner_id: generateUUID(),
			name: "Acme",
			slug: `acme-${generateUUID()}`,
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
		{ id: generateUUID(), team_id: teamId, subject_id: generateUUID(), role: "admin" },
		{ touch: true, returnRow: true },
	);
}

/** Minimal well-formed cron-job form body. */
function cronJobBody(overrides: Record<string, string> = {}): Record<string, string> {
	return {
		name: "Nightly backup",
		cron_expression: "0 0 * * *",
		timezone: "UTC",
		grace_period_seconds: "300",
		is_enabled: "true",
		...overrides,
	};
}

describe("POST /actions/:team/create-cron-job", () => {
	test("creates an enabled cron-job monitor with a scheduled next run, and redirects to it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);

		let response = await postCronJobAction(
			createCronJob,
			routes.actions.cronJob.create,
			team,
			membership,
			db,
			cronJobBody(),
		);

		let created = await db.findOne(cronJobMonitors, { where: { team_id: team.id } });
		expect(created?.name).toBe("Nightly backup");
		expect(created?.enabled_at).not.toBeNull();
		expect(created?.next_expected_at).not.toBeNull();

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.cronJobs.show.href({ team: team.slug, monitorId: created!.id }),
		);
	});

	test("stores the expression normalized, so one schedule has one spelling", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);

		await postCronJobAction(
			createCronJob,
			routes.actions.cronJob.create,
			team,
			membership,
			db,
			cronJobBody({ cron_expression: " @daily " }),
		);

		let created = await db.findOne(cronJobMonitors, { where: { team_id: team.id } });
		expect(created?.cron_expression).toBe("0 0 * * *");
	});

	test("rejects a blank name, rendering the form as typed without creating a row", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);

		let response = await postCronJobAction(
			createCronJob,
			routes.actions.cronJob.create,
			team,
			membership,
			db,
			cronJobBody({ name: "", cron_expression: "15 3 * * *", grace_period_seconds: "900" }),
		);

		expect(response.status).toBe(400);
		let body = await response.text();
		expect(body).toContain("Enter a name of up to 255 characters.");
		expect(body).toContain('value="15 3 * * *"');
		expect(body).toContain('value="900"');
		expect(await db.count(cronJobMonitors, { where: { team_id: team.id } })).toBe(0);
	});

	test("rejects an invalid cron expression, making no DB mutation", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);

		let response = await postCronJobAction(
			createCronJob,
			routes.actions.cronJob.create,
			team,
			membership,
			db,
			cronJobBody({ cron_expression: "not a cron expression" }),
		);

		expect(response.status).toBe(400);
		let body = await response.text();
		expect(body).toContain('value="Nightly backup"');
		expect(body).toContain('value="not a cron expression"');
		expect(await db.count(cronJobMonitors, { where: { team_id: team.id } })).toBe(0);
	});
});

describe("POST /actions/:team/update-cron-job", () => {
	test("updates an existing cron-job monitor and redirects to it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let monitor = await db.create(
			cronJobMonitors,
			{
				id: generateUUID(),
				team_id: team.id,
				name: "Old name",
				description: null,
				cron_expression: "0 0 * * *",
				grace_period_seconds: 300,
				timezone: "UTC",
				status: "new",
				alert_on_late: false,
				last_ping_at: null,
				next_expected_at: null,
				enabled_at: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await postCronJobAction(
			updateCronJob,
			routes.actions.cronJob.update,
			team,
			membership,
			db,
			cronJobBody({ monitor_id: monitor.id, name: "New name" }),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.cronJobs.show.href({ team: team.slug, monitorId: monitor.id }),
		);

		let updated = await db.findOne(cronJobMonitors, { where: { id: monitor.id } });
		expect(updated?.name).toBe("New name");
		expect(updated?.enabled_at).not.toBeNull();
	});

	test("404s when the monitor doesn't belong to the team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let otherTeam = await createTeamRow(db);
		let monitor = await db.create(
			cronJobMonitors,
			{
				id: generateUUID(),
				team_id: otherTeam.id,
				name: "Someone else's",
				description: null,
				cron_expression: "0 0 * * *",
				grace_period_seconds: 300,
				timezone: "UTC",
				status: "new",
				alert_on_late: false,
				last_ping_at: null,
				next_expected_at: null,
				enabled_at: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await postCronJobAction(
			updateCronJob,
			routes.actions.cronJob.update,
			team,
			membership,
			db,
			cronJobBody({ monitor_id: monitor.id, name: "Hijacked" }),
		);

		expect(response.status).toBe(404);
		let unchanged = await db.findOne(cronJobMonitors, { where: { id: monitor.id } });
		expect(unchanged?.name).toBe("Someone else's");
	});

	test("rejects an invalid cron expression, rendering the edit form as typed without mutating the monitor", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let monitor = await db.create(
			cronJobMonitors,
			{
				id: generateUUID(),
				team_id: team.id,
				name: "Original",
				description: null,
				cron_expression: "0 0 * * *",
				grace_period_seconds: 300,
				timezone: "UTC",
				status: "new",
				alert_on_late: false,
				last_ping_at: null,
				next_expected_at: null,
				enabled_at: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await postCronJobAction(
			updateCronJob,
			routes.actions.cronJob.update,
			team,
			membership,
			db,
			cronJobBody({
				monitor_id: monitor.id,
				name: "Should not stick",
				cron_expression: "not a cron expression",
			}),
		);

		expect(response.status).toBe(400);
		let body = await response.text();
		expect(body).toContain('value="Should not stick"');
		expect(body).toContain('value="not a cron expression"');
		let unchanged = await db.findOne(cronJobMonitors, { where: { id: monitor.id } });
		expect(unchanged?.name).toBe("Original");
	});

	test("rejects a blank name, rendering the edit form with the issue without mutating the monitor", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let monitor = await db.create(
			cronJobMonitors,
			{
				id: generateUUID(),
				team_id: team.id,
				name: "Original",
				description: null,
				cron_expression: "0 0 * * *",
				grace_period_seconds: 300,
				timezone: "UTC",
				status: "new",
				alert_on_late: false,
				last_ping_at: null,
				next_expected_at: null,
				enabled_at: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await postCronJobAction(
			updateCronJob,
			routes.actions.cronJob.update,
			team,
			membership,
			db,
			cronJobBody({ monitor_id: monitor.id, name: "", cron_expression: "*/5 * * * *" }),
			{ Referer: "https://uptime.test/back" },
		);

		expect(response.status).toBe(400);
		let body = await response.text();
		expect(body).toContain("Enter a name of up to 255 characters.");
		expect(body).toContain('value="*/5 * * * *"');
		let unchanged = await db.findOne(cronJobMonitors, { where: { id: monitor.id } });
		expect(unchanged?.name).toBe("Original");
	});

	test("rejects a save naming another team's monitor by redirecting to the Referer", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);

		let response = await postCronJobAction(
			updateCronJob,
			routes.actions.cronJob.update,
			team,
			membership,
			db,
			cronJobBody({ monitor_id: generateUUID(), name: "" }),
			{ Referer: "https://uptime.test/back" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe("https://uptime.test/back");
	});
});

describe("DELETE /actions/:team/delete-cron-job", () => {
	test("deletes an existing cron-job monitor and redirects to the list", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let monitor = await db.create(
			cronJobMonitors,
			{
				id: generateUUID(),
				team_id: team.id,
				name: "To delete",
				description: null,
				cron_expression: "0 0 * * *",
				grace_period_seconds: 300,
				timezone: "UTC",
				status: "new",
				alert_on_late: false,
				last_ping_at: null,
				next_expected_at: null,
				enabled_at: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await postCronJobAction(
			deleteCronJob,
			routes.actions.cronJob.delete,
			team,
			membership,
			db,
			{ monitor_id: monitor.id },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.cronJobs.index.href({ team: team.slug }),
		);
		expect(await db.findOne(cronJobMonitors, { where: { id: monitor.id } })).toBeNull();
	});

	test("404s when the monitor doesn't belong to the team, without deleting it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let otherTeam = await createTeamRow(db);
		let monitor = await db.create(
			cronJobMonitors,
			{
				id: generateUUID(),
				team_id: otherTeam.id,
				name: "Not yours",
				description: null,
				cron_expression: "0 0 * * *",
				grace_period_seconds: 300,
				timezone: "UTC",
				status: "new",
				alert_on_late: false,
				last_ping_at: null,
				next_expected_at: null,
				enabled_at: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await postCronJobAction(
			deleteCronJob,
			routes.actions.cronJob.delete,
			team,
			membership,
			db,
			{ monitor_id: monitor.id },
		);

		expect(response.status).toBe(404);
		expect(await db.findOne(cronJobMonitors, { where: { id: monitor.id } })).not.toBeNull();
	});

	test("rejects a missing monitor_id and redirects without deleting anything", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let monitor = await db.create(
			cronJobMonitors,
			{
				id: generateUUID(),
				team_id: team.id,
				name: "Still here",
				description: null,
				cron_expression: "0 0 * * *",
				grace_period_seconds: 300,
				timezone: "UTC",
				status: "new",
				alert_on_late: false,
				last_ping_at: null,
				next_expected_at: null,
				enabled_at: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await postCronJobAction(
			deleteCronJob,
			routes.actions.cronJob.delete,
			team,
			membership,
			db,
			{ unrelated: "value" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.cronJobs.index.href({ team: team.slug }),
		);
		expect(await db.findOne(cronJobMonitors, { where: { id: monitor.id } })).not.toBeNull();
	});
});
