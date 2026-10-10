/**
 * Tests the DNS monitors list page against models bound to an in-memory database. A fake
 * middleware seeds `getViewer()`, `ctx.team`, `ctx.membership` and `ctx.teams` in place of
 * the real `auth`/`requireUser`/`requireTeam` chain.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { Database } from "remix/data-table";
import type { Middleware, RequestContext, RequestHandler } from "remix/router";

import { unwrap } from "@sdxc/result";
import { renderToStream } from "remix/component/server";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import { database } from "~/app/http/middleware/database";
import i18n from "~/app/http/middleware/i18n";
import models from "~/app/http/middleware/models";
import { createTestDatabase } from "~/app/lib/test/db";
import { withDocumentAssets } from "~/app/lib/test/document-assets";
import { bindModels } from "~/app/lib/test/models";
import { memberships, teams } from "~/database/schema";
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

/** Minimal request-scoped HTML renderer standing in for the app's `htmlRendering()` chain. */
function createHtmlRenderer(ctx: RequestContext) {
	return async function render(node: RemixNode, init?: ResponseInit): Promise<Response> {
		let stream = renderToStream(await withDocumentAssets(node), { frameSrc: ctx.request.url });
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
	let router = createRouter({ middleware: [asyncContext(), database(() => db), models()] });
	router.map(routes.app.team.dnsMonitors.index, {
		middleware: [seedTeam(team, membership), i18n, renderWith(createHtmlRenderer) as Middleware],
		handler,
	});

	let request = new Request(
		new URL(routes.app.team.dnsMonitors.index.href({ team: team.slug }), "https://uptime.test"),
	);

	return router.fetch(request);
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
		let models = bindModels(db);
		unwrap(
			await models.dnsMonitors.create({
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Production DNS",
				domain: "example.com",
			}),
		);

		let response = await send(db, team, membership);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Production DNS");
		expect(body).toContain("example.com");
	});

	test("shows each monitor's registration status and expiry date", async () => {
		let { db, team, membership } = await createFixture();
		let models = bindModels(db);
		unwrap(
			await models.dnsMonitors.create({
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Expiring DNS",
				domain: "example.com",
				registration_status: "expiring",
				registration_expires_at: Date.UTC(2026, 10, 1),
			}),
		);
		unwrap(
			await models.dnsMonitors.create({
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "New DNS",
				domain: "example.org",
			}),
		);

		let body = await (await send(db, team, membership)).text();

		expect(body).toContain("Registration");
		expect(body).toContain("Expiring");
		expect(body).toContain("Nov 1, 2026");
		expect(body).toContain("Not looked up yet");
	});

	/**
	 * A monitor is a domain, so what a row has to say about size is how many records it
	 * tracks and how many of those a deviation would alert on — the two numbers the old
	 * record-type column stood in for.
	 */
	test("counts each monitor's records, and says so per monitor", async () => {
		let { db, team, membership } = await createFixture();
		let models = bindModels(db);

		let watched = unwrap(
			await models.dnsMonitors.create({
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Acme DNS",
				domain: "acme.test",
			}),
		);
		unwrap(
			await models.dnsMonitors.create({
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Spare DNS",
				domain: "spare.test",
			}),
		);

		for (let [value, isEnabled] of [
			["192.0.2.1", true],
			["192.0.2.2", true],
			["192.0.2.3", false],
		] as const) {
			unwrap(
				await models.dnsMonitorRecords.create({
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
				}),
			);
		}

		let body = await (await send(db, team, membership)).text();

		expect(body).toContain("2 of 3 watched");
		expect(body).toContain("None yet");
	});
});
