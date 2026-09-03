/**
 * Tests for the TCP monitor edit page controller. `~/app/data/tcp-monitor` doesn't
 * import `cloudflare:workers`, so no module mock is needed here. This controller is a
 * pure GET render with a 404 guard; it doesn't re-render the form with validation
 * errors inline (that only happens in the separate `update-tcp-monitor` action), so
 * there's no inline-error case to cover here. `getViewer()`/`ctx.team`/`ctx.membership`/
 * `ctx.teams` are seeded directly by a fake middleware standing in for the real
 * `auth`/`requireUser`/`requireTeam` chain, matching the template in
 * `app/http/controllers/actions/monitors.test.ts`.
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
import { memberships, teams, tcpMonitors } from "~/database/schema";
import routes from "~/routes/web";

let { handler } = (await import("./tcp-monitor-edit")).default as { handler: RequestHandler<any> };

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
	router.map(routes.app.team.tcpMonitors.edit, {
		middleware: [seedTeam(team, membership), i18n, renderWith(createHtmlRenderer) as Middleware],
		handler,
	});

	let request = new Request(
		new URL(
			routes.app.team.tcpMonitors.edit.href({ team: team.slug, monitorId }),
			"https://uptime.test",
		),
	);

	return container.scope(() => router.fetch(request));
}

describe("tcpMonitorEdit", () => {
	test("renders the edit form pre-filled with the monitor's values", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			tcpMonitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Database",
				host: "db.example.com",
				port: 5432,
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(db, team, membership, monitor.id);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Edit TCP Monitor");
		expect(body).toContain("Database");
		expect(body).toContain('value="db.example.com"');
		expect(body).toContain("Save Changes");
		/**
		 * The +/- buttons only step once their island hydrates, and the markup is
		 * identical before and after, so asserting the stepper's module URL is what
		 * proves the island is wired in.
		 */
		expect(body).toContain('"moduleUrl":"/resources/components/stepper-field.tsx"');
		expect(body).toContain('command="--step-up" commandfor="tcp-monitor-port"');
	});

	test("404s for a monitor that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(db, team, membership, crypto.randomUUID());
		expect(response.status).toBe(404);
	});
});
