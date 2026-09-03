/**
 * Tests for the new-DNS-monitor form page controller. `~/app/data/dns-monitor` imports
 * only portable runtime APIs, so this suite loads it directly. `getViewer()`/
 * `ctx.team`/`ctx.membership`/`ctx.teams` are seeded directly by a fake middleware
 * standing in for the real `auth`/`requireUser`/`requireTeam` chain, matching the
 * template in `app/http/controllers/actions/monitors.test.ts`.
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
import { memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

let { handler } = (await import("./dns-monitor-new")).default as { handler: RequestHandler<any> };

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
	router.map(routes.app.team.dnsMonitors.new, {
		middleware: [seedTeam(team, membership), i18n, renderWith(createHtmlRenderer) as Middleware],
		handler,
	});

	let request = new Request(
		new URL(routes.app.team.dnsMonitors.new.href({ team: team.slug }), "https://uptime.test"),
	);

	return container.scope(() => router.fetch(request));
}

describe("dnsMonitorNew", () => {
	/** The default lives on the selected `<option>`, the only place a `<select>` exposes it. */
	test("renders the empty new-DNS-monitor form", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(db, team, membership);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Create DNS Monitor");
		expect(body).toContain('name="domain"');
		expect(body).toContain("Domain");
		expect(body).toContain('value="86400" selected');
		expect(body).not.toContain("defaultvalue");
	});

	/**
	 * A sweep queries every type at every name, so a record's own TTL already floors
	 * detection latency past the point a faster cadence would help.
	 */
	test("offers no cadence below the domain-sweep floor", async () => {
		let { db, team, membership } = await createFixture();

		let body = await (await send(db, team, membership)).text();

		expect(body).not.toContain('value="300"');
		expect(body).toContain('value="900"');
	});

	/**
	 * The apex-only limit appears on this screen, where the visitor decides whether
	 * to paste, closing the gap between what "domain monitoring" sounds like and
	 * what it is.
	 */
	test("takes a zone file, and says what it cannot see without one", async () => {
		let { db, team, membership } = await createFixture();

		let body = await (await send(db, team, membership)).text();

		expect(body).toContain('name="zone_file"');
		expect(body).toContain("<textarea");
		expect(body).toContain('id="dns-apex-only-notice"');
		expect(body).toContain("we can only watch your domain's apex");
	});

	/**
	 * Asserted by its id: the copy interpolating the two numbers is a pending locale
	 * key, and the screen's contract holds however it states them, independent of
	 * the wording.
	 */
	test("states both bounds a paste is refused against", async () => {
		let { db, team, membership } = await createFixture();

		let body = await (await send(db, team, membership)).text();

		expect(body).toContain('id="dns-zone-file-limits"');
	});

	/**
	 * The card owns its field rhythm outright: the single `gap: 28px` rule between
	 * fields, and the padding around them now that the last field sits flush with
	 * the edge — both measurements come from the card alone.
	 */
	test("spaces the card's fields from the card alone, never twice", async () => {
		let { db, team, membership } = await createFixture();

		let body = await (await send(db, team, membership)).text();

		expect(body.match(/gap: 28px;/g)).toEqual(["gap: 28px;"]);
		expect(body).not.toContain("margin-block-end: 28px");
		expect(body).toContain("padding: calc(var(--ui-spacing, 0.25rem) * 6);");
	});
});
