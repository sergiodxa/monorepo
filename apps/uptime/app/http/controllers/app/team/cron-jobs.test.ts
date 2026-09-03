/**
 * Tests for the cron-job monitors list page controller, exercising only
 * `~/app/data/cron-job` so it needs no `cloudflare:workers` mock. Status and
 * schedule rendering is what's covered here, since per-row ping URLs are
 * exercised on the detail page (`cron-job-show.tsx`). `getViewer()`,
 * `ctx.team`, `ctx.membership`, and `ctx.teams` are seeded directly by a fake
 * middleware standing in for the real `auth`/`requireUser`/`requireTeam` chain.
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
import { cronJobMonitors, memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

let { handler } = (await import("./cron-jobs")).default as { handler: RequestHandler<any> };

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
): Promise<Response> {
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({ middleware: [asyncContext()] });
	router.map(routes.app.team.cronJobs.index, {
		middleware: [seedTeam(team, membership), i18n, renderWith(createHtmlRenderer) as Middleware],
		handler,
	});

	let request = new Request(
		new URL(routes.app.team.cronJobs.index.href({ team: team.slug }), "https://uptime.test"),
	);

	return container.scope(() => router.fetch(request));
}

describe("cronJobs", () => {
	test("renders the empty state when the team has no cron-job monitors", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(db, team, membership);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Cron Jobs");
		expect(body).toContain("No cron jobs yet");
		expect(body).toContain("Create a cron job monitor to track your scheduled tasks.");
	});

	test("lists a team's cron-job monitors with their name, schedule, and status", async () => {
		let { db, team, membership } = await createFixture();
		await db.create(
			cronJobMonitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Nightly Backup",
				cron_expression: "0 0 * * *",
				timezone: "UTC",
				status: "healthy",
				enabled_at: Date.now(),
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(db, team, membership);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Nightly Backup");
		expect(body).toContain("Every day at 00:00");
		expect(body).toContain("Healthy");
	});

	test("shows a Disabled badge for a monitor with no enabled_at", async () => {
		let { db, team, membership } = await createFixture();
		await db.create(
			cronJobMonitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Paused Job",
				cron_expression: "0 * * * *",
				timezone: "UTC",
				status: "new",
				enabled_at: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(db, team, membership);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Paused Job");
		expect(body).toContain("Disabled");
	});
});
