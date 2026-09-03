/**
 * Tests for the cron-job monitor detail page controller. Skips `~/app/data/monitor`,
 * so no `cloudflare:workers` mock is needed. Checks the ping URL's relative path,
 * since the origin is request-specific, and guards decisions an ordinary edit could
 * silently undo: the status badge living in the shell header, and the bare `POST
 * <url>` snippet staying replaced by an authenticated `curl` line.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestContext, RequestHandler } from "remix/router";
import type { RemixNode } from "remix/ui";

import { ServiceContainer } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { renderToStream } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import i18n from "~/app/http/middleware/i18n";
import { createTestDatabase } from "~/app/lib/test/db";
import { cronJobMonitors, cronJobPings, memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

let { handler } = (await import("./cron-job-show")).default as { handler: RequestHandler<any> };

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

/** Middleware that seeds `ctx.team`/`ctx.membership`/`ctx.teams`/auth state, standing in for the real chain. */
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

/** Minimal request-scoped HTML renderer standing in for `bootstrap/app.tsx`'s `createHtmlRenderer`. */
function createHtmlRenderer(ctx: RequestContext) {
	return function render(node: RemixNode, init?: ResponseInit): Response {
		let stream = renderToStream(node, { frameSrc: ctx.request.url });
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(stream, { ...init, headers });
	};
}

/** Sends a GET request through a minimal router mapping a single page route. */
async function send(
	db: Database,
	team: SelectTeam,
	membership: SelectMembership,
	monitorId: string,
): Promise<Response> {
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({ middleware: [asyncContext()] });
	router.map(routes.app.team.cronJobs.show, {
		middleware: [seedTeam(team, membership), i18n, renderWith(createHtmlRenderer) as Middleware],
		handler,
	});

	let request = new Request(
		new URL(
			routes.app.team.cronJobs.show.href({ team: team.slug, monitorId }),
			"https://uptime.test",
		),
	);

	return container.scope(() => router.fetch(request));
}

describe("cronJobShow", () => {
	test("responds 404 for a cron-job monitor that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(db, team, membership, crypto.randomUUID());
		expect(response.status).toBe(404);
	});

	/**
	 * The 90-day bar is the uptime history section, so "90 days ago" is the caption
	 * this page must carry.
	 */
	test("renders the monitor's detail page with its ping URL and empty ping history", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			cronJobMonitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Nightly Backup",
				cron_expression: "0 0 * * *",
				timezone: "UTC",
				grace_period_seconds: 900,
				status: "new",
				enabled_at: Date.now(),
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(db, team, membership, monitor.id);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Nightly Backup");
		expect(body).toContain(routes.api.cronJobPing.href({ cronJobId: monitor.id }));
		expect(body).toContain("No pings received yet");
		expect(body).toContain("90 days ago");
		expect(body).not.toContain("Failure");
	});

	test("shows the status badge in the shell header rather than as a stat card", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			cronJobMonitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Nightly Backup",
				cron_expression: "0 0 * * *",
				timezone: "UTC",
				grace_period_seconds: 900,
				status: "missed",
				enabled_at: Date.now(),
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(db, team, membership, monitor.id);
		let body = await response.text();

		expect(body).toContain("Missed");
		expect(body.indexOf("Missed")).toBeLessThan(body.indexOf("<main"));
		expect(body.lastIndexOf("Missed")).toBeLessThan(body.indexOf("<main"));
	});

	test("folds timezone and grace period into the schedule card as a worded duration", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			cronJobMonitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Nightly Backup",
				cron_expression: "0 3 * * *",
				timezone: "UTC",
				grace_period_seconds: 900,
				status: "healthy",
				enabled_at: Date.now(),
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(db, team, membership, monitor.id);
		let body = await response.text();

		expect(body).toContain("UTC · 15 minutes grace");
		expect(body).not.toContain("900s");
	});

	/**
	 * Every rendered snippet wraps its request in an authenticated `curl` command,
	 * leaving `<code>POST` unmatched.
	 */
	test("offers authenticated snippets and a route to a scoped API key, and no bare POST line", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			cronJobMonitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Nightly Backup",
				cron_expression: "0 0 * * *",
				timezone: "UTC",
				grace_period_seconds: 900,
				status: "new",
				enabled_at: Date.now(),
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(db, team, membership, monitor.id);
		let body = await response.text();

		expect(body).not.toContain("<code>POST");
		expect(body).toContain("curl -X POST");
		expect(body).toContain("Authorization: Bearer $UPTIME_API_KEY");
		expect(body).toContain("Copy command");
		expect(body).toContain("Copy crontab line");
		expect(body).toContain(routes.app.team.apiKeys.new.href({ team: team.slug }));
		expect(body).toContain("Create an API key");
	});

	test("lists the monitor's recent pings", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			cronJobMonitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Nightly Backup",
				cron_expression: "0 0 * * *",
				timezone: "UTC",
				grace_period_seconds: 300,
				status: "healthy",
				enabled_at: Date.now(),
			},
			{ touch: true, returnRow: true },
		);
		await db.create(
			cronJobPings,
			{
				id: crypto.randomUUID(),
				cron_job_monitor_id: monitor.id,
				was_on_time: true,
				source_ip: "203.0.113.5",
				user_agent: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(db, team, membership, monitor.id);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("203.0.113.5");
		expect(body).toContain("On Time");
	});

	test("words every instant as a distance from now, with the absolute time on hover", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			cronJobMonitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Nightly Backup",
				cron_expression: "0 0 * * *",
				timezone: "UTC",
				grace_period_seconds: 900,
				status: "healthy",
				last_ping_at: Date.now() - 2 * 60 * 1000,
				next_expected_at: Date.now() + 4 * 60 * 60 * 1000,
				enabled_at: Date.now(),
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(db, team, membership, monitor.id);
		let body = await response.text();

		expect(body).toContain("2 minutes ago");
		expect(body).toContain("in 4 hours");
		expect(body).toMatch(/<span title="[^"]+">2 minutes ago<\/span>/);
		expect(body).not.toMatch(/\d{1,2}\/\d{1,2}\/\d{4}, \d/);
	});
});
