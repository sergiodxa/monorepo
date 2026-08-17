/**
 * Tests for the flow monitor detail page shell. `~/app/data/flow-monitor` doesn't import
 * `cloudflare:workers`, so no module mock is needed here. `getViewer()`/`ctx.team`/
 * `ctx.membership`/`ctx.teams` are seeded directly by a fake middleware standing in for the real
 * `auth`/`requireUser`/`requireTeam` chain, matching the template in
 * `app/http/controllers/actions/monitors.test.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestContext, RequestHandler } from "remix/router";
import type { RemixNode } from "remix/ui";

import { ServiceContainer } from "@pkg/service-container";
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
import { flowMonitors, memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

let { handler } = (await import("./flow-monitor-show")).default as { handler: RequestHandler<any> };

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

/** Middleware that seeds `ctx.team`/`ctx.membership`/`ctx.teams`/auth state. */
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

/**
 * Minimal request-scoped HTML renderer standing in for `bootstrap/app.tsx`'s renderer. Frame
 * resolution isn't exercised by a single-request page test, so `resolveFrame` is a no-op — the
 * results fragment this page frames has its own test.
 */
function createHtmlRenderer(ctx: RequestContext) {
	return function render(node: RemixNode, init?: ResponseInit): Response {
		let stream = renderToStream(node, { frameSrc: ctx.request.url, resolveFrame: async () => "" });
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
	router.map(routes.app.team.flowMonitors.show, {
		middleware: [seedTeam(team, membership), i18n, renderWith(createHtmlRenderer) as Middleware],
		handler,
	});

	let request = new Request(
		new URL(
			routes.app.team.flowMonitors.show.href({ team: team.slug, monitorId }),
			"https://uptime.test",
		),
	);

	return container.scope(() => router.fetch(request));
}

/** Seeds one flow monitor, with whatever the case cares about overridden. */
async function seedMonitor(db: Database, teamId: string, changes: Record<string, unknown> = {}) {
	return await db.create(
		flowMonitors,
		{
			id: crypto.randomUUID(),
			team_id: teamId,
			name: "Sign in",
			source: 'test "signs in" {\n\tthen {\n\t\texpect true\n\t}\n}',
			interval_seconds: 3600,
			...changes,
		},
		{ touch: true, returnRow: true },
	);
}

describe("flowMonitor", () => {
	test("renders the monitor's name, schedule and never-checked status", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await seedMonitor(db, team.id, { name: "Checkout", interval_seconds: 21_600 });

		let response = await send(db, team, membership, monitor.id);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Checkout");
		expect(body).toContain("6 hours");
		expect(body).toContain("Not checked yet");
	});

	test("a failing monitor reads as failing", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await seedMonitor(db, team.id, { last_status: "down" });

		let body = await (await send(db, team, membership, monitor.id)).text();
		expect(body).toContain("Failing");
	});

	test("a monitor that could not run reads as such, not as an outage", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await seedMonitor(db, team.id, { last_status: "error" });

		let body = await (await send(db, team, membership, monitor.id)).text();
		expect(body).toContain("Cannot run");
		expect(body).not.toContain("Failing");
	});

	test("a disabled monitor says so in its own card", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await seedMonitor(db, team.id, { is_enabled: false });

		let body = await (await send(db, team, membership, monitor.id)).text();
		expect(body).toContain("Disabled");
	});

	test("404s on another team's monitor", async () => {
		let { db, team, membership } = await createFixture();
		let other = await db.create(
			teams,
			{ id: crypto.randomUUID(), owner_id: "owner-2", name: "Other", slug: "other", logo: null },
			{ touch: true, returnRow: true },
		);
		let monitor = await seedMonitor(db, other.id, { name: "Not Yours" });

		let response = await send(db, team, membership, monitor.id);
		expect(response.status).toBe(404);
	});
});
