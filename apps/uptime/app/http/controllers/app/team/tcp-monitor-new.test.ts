/**
 * Tests for the new-TCP-monitor form page controller. `~/app/data/tcp-monitor` doesn't
 * import `cloudflare:workers`, so no module mock is needed here. `getViewer()`/
 * `ctx.team`/`ctx.membership`/`ctx.teams` are seeded directly by a fake middleware
 * standing in for the real `auth`/`requireUser`/`requireTeam` chain, matching the
 * template in `app/http/controllers/actions/monitors.test.ts`.
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
import { memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

let { handler } = (await import("./tcp-monitor-new")).default as { handler: RequestHandler<any> };

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
	router.map(routes.app.team.tcpMonitors.new, {
		middleware: [seedTeam(team, membership), i18n, renderWith(createHtmlRenderer) as Middleware],
		handler,
	});

	let request = new Request(
		new URL(routes.app.team.tcpMonitors.new.href({ team: team.slug }), "https://uptime.test"),
	);

	return container.scope(() => router.fetch(request));
}

describe("tcpMonitorNew", () => {
	test("renders the empty new-TCP-monitor form", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(db, team, membership);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Create TCP Monitor");
		expect(body).toContain('name="host"');
		expect(body).toContain('name="port"');
		expect(body).toContain("Host");
	});

	test("posts to the create-TCP-monitor action with every field", async () => {
		let { db, team, membership } = await createFixture();

		let body = await (await send(db, team, membership)).text();

		// The card layout is presentation only: the request this form produces has to stay
		// exactly what the create action already accepts.
		expect(body).toContain('method="post"');
		expect(body).toContain(
			`action="${routes.actions.monitor.tcp.create.href({ team: team.slug })}"`,
		);
		expect(body).toContain('name="name"');
		expect(body).toContain('name="interval_seconds"');
		expect(body).toContain('name="timeout_ms"');
		// A new monitor is always created enabled, so the toggle is edit-only.
		expect(body).not.toContain('name="is_enabled"');
	});

	test("renders the fields inside a settings card", async () => {
		let { db, team, membership } = await createFixture();

		let body = await (await send(db, team, membership)).text();

		expect(body).toContain('<section id="basics"');
	});

	/**
	 * The numeric fields' +/- buttons only step once their island hydrates, and the
	 * page renders the same markup either way — so the hydration payload naming the
	 * island is the only thing on this page that tells a live stepper from an inert one.
	 */
	test("ships the numeric fields as hydrating steppers", async () => {
		let { db, team, membership } = await createFixture();

		let body = await (await send(db, team, membership)).text();

		expect(body).toContain('"moduleUrl":"/resources/components/stepper-field.tsx"');
		expect(body).toContain('command="--step-up" commandfor="tcp-monitor-port"');
		expect(body).toContain('command="--step-down" commandfor="tcp-monitor-timeout-ms"');
	});
});
