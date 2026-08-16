/**
 * Tests for the DNS monitors list page controller. Unlike the HTTP monitor
 * controllers, `~/app/data/dns-monitor` doesn't import `cloudflare:workers`, so no
 * module mock is needed here. `getViewer()`/`ctx.team`/`ctx.membership`/`ctx.teams` are
 * seeded directly by a fake middleware standing in for the real `auth`/`requireUser`/
 * `requireTeam` chain, matching the template in `app/http/controllers/actions/
 * monitors.test.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { Middleware, RequestContext, RequestHandler } from "remix/router";
import type { RemixNode } from "remix/ui";

import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { renderToStream } from "remix/ui/server";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import i18n from "~/app/http/middleware/i18n";
import { createTestDatabase } from "~/app/lib/test/db";
import { dnsMonitorRecords, dnsMonitors, memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

let { handler } = (await import("./dns-monitors")).default as { handler: RequestHandler<any> };

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
	router.map(routes.app.team.dnsMonitors.index, {
		middleware: [seedTeam(team, membership), i18n, renderWith(createHtmlRenderer) as Middleware],
		handler,
	});

	let request = new Request(
		new URL(routes.app.team.dnsMonitors.index.href({ team: team.slug }), "https://uptime.test"),
	);

	return container.scope(() => router.fetch(request));
}

describe("dnsMonitors", () => {
	test("renders the empty state when the team has no DNS monitors", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(db, team, membership);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("DNS Monitors");
		expect(body).toContain("No DNS monitors yet");
		expect(body).toContain("Create a DNS monitor to track DNS record changes.");
	});

	test("lists a team's DNS monitors with their name and domain", async () => {
		let { db, team, membership } = await createFixture();
		await db.create(
			dnsMonitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Production DNS",
				domain: "example.com",
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(db, team, membership);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Production DNS");
		expect(body).toContain("example.com");
	});

	/**
	 * A monitor is a domain, so what a row has to say about size is how many records it
	 * tracks and how many of those a deviation would alert on — the two numbers the old
	 * record-type column stood in for.
	 */
	test("counts each monitor's records, and says so per monitor", async () => {
		let { db, team, membership } = await createFixture();

		let watched = await db.create(
			dnsMonitors,
			{ id: crypto.randomUUID(), team_id: team.id, name: "Acme DNS", domain: "acme.test" },
			{ touch: true, returnRow: true },
		);
		await db.create(
			dnsMonitors,
			{ id: crypto.randomUUID(), team_id: team.id, name: "Spare DNS", domain: "spare.test" },
			{ touch: true },
		);

		for (let [value, isEnabled] of [
			["192.0.2.1", true],
			["192.0.2.2", true],
			["192.0.2.3", false],
		] as const) {
			await db.create(
				dnsMonitorRecords,
				{
					id: crypto.randomUUID(),
					dns_monitor_id: watched.id,
					name: "acme.test",
					record_type: "A",
					value,
					source: "resolver",
					is_enabled: isEnabled,
					status: isEnabled ? "ok" : "new",
					first_seen_at: 0,
					last_seen_at: 0,
					last_checked_at: 0,
				},
				{ touch: true, returnRow: true },
			);
		}

		let body = await (await send(db, team, membership)).text();

		expect(body).toContain("2 of 3 watched");
		// A monitor discovery has never run for reads as "none yet" rather than as a
		// settled "0 of 0", which would claim we looked and found nothing.
		expect(body).toContain("None yet");
	});
});
