/**
 * Tests for the DNS monitor check-history fragment controller — the raw log of checks
 * that renders at the very bottom of the detail page, and in particular how a findings
 * cell reads a partial sweep. `getViewer()`/`ctx.team`/`ctx.membership`/`ctx.teams` are
 * seeded directly by a fake middleware standing in for the real
 * `auth`/`requireUser`/`requireTeam` chain.
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
import { dnsMonitorResults, dnsMonitors, memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

let { handler } = (await import("./dns-monitor-card-check-history")).default as {
	handler: RequestHandler<any>;
};

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
	router.map(routes.app.team.dnsMonitors.cards.checkHistory, {
		middleware: [seedTeam(team, membership), i18n, renderWith(createHtmlRenderer) as Middleware],
		handler,
	});

	let request = new Request(
		new URL(
			routes.app.team.dnsMonitors.cards.checkHistory.href({ team: team.slug, monitorId }),
			"https://uptime.test",
		),
	);

	return container.scope(() => router.fetch(request));
}

describe("dns-monitor-card-check-history", () => {
	test("renders the empty state for a monitor that has never been checked", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			dnsMonitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Production DNS",
				domain: "example.com",
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(db, team, membership, monitor.id);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Check History");
		expect(body).toContain("No checks have been performed yet.");
	});

	/**
	 * A query that did not answer is never diffed, so a check that lost some of its queries
	 * knows less about the domain than a whole one does. Reporting it as "no changes" would
	 * turn the part we never looked at into a clean bill of health.
	 */
	test("reports a partial sweep as partial rather than as a clean check", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			dnsMonitors,
			{ id: crypto.randomUUID(), team_id: team.id, name: "Acme DNS", domain: "acme.test" },
			{ touch: true, returnRow: true },
		);

		await db.create(dnsMonitorResults, {
			id: crypto.randomUUID(),
			dns_monitor_id: monitor.id,
			status: "ok",
			records_checked: 12,
			queries_failed: 2,
			response_time_ms: 40,
			error_message: null,
			checked_at: Date.now(),
		});

		let body = await (await send(db, team, membership, monitor.id)).text();

		expect(body).toContain("2 queries did not answer");
		expect(body).not.toContain("No changes");
	});

	test("says nothing moved only when the whole sweep answered", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			dnsMonitors,
			{ id: crypto.randomUUID(), team_id: team.id, name: "Acme DNS", domain: "acme.test" },
			{ touch: true, returnRow: true },
		);

		await db.create(dnsMonitorResults, {
			id: crypto.randomUUID(),
			dns_monitor_id: monitor.id,
			status: "ok",
			records_checked: 12,
			queries_failed: 0,
			response_time_ms: 40,
			error_message: null,
			checked_at: Date.now(),
		});

		let body = await (await send(db, team, membership, monitor.id)).text();

		expect(body).toContain("No changes");
		expect(body).not.toContain("did not answer");
	});

	test("404s for a monitor that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(db, team, membership, crypto.randomUUID());
		expect(response.status).toBe(404);
	});
});
