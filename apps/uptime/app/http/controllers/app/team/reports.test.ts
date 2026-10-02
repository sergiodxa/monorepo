/**
 * Tests for the report builder page: the form a first visit gets, the problem shown for a
 * query a download sent back, and the controls that carry the team's status pages and the
 * current selection into each download and preset.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { Database } from "remix/data-table";
import type { Middleware, RequestContext, RequestHandler } from "remix/router";

import { renderToStream } from "remix/component/server";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import { database } from "~/app/http/middleware/database";
import i18n from "~/app/http/middleware/i18n";
import { createTestDatabase } from "~/app/lib/test/db";
import { memberships, statusPages, teams } from "~/database/schema";
import routes from "~/routes/web";

let { handler } = (await import("./reports")).default as { handler: RequestHandler<any> };

/** 2026-09-29T10:00Z, so "last month" is August 2026. */
const NOW = Date.UTC(2026, 8, 29, 10);

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(NOW);
});

afterEach(() => {
	vi.useRealTimers();
});

/** One team with a member and one status page. */
async function createFixture() {
	let { db } = createTestDatabase();
	let write = { touch: true, returnRow: true } as const;

	let team = await db.create(
		teams,
		{ id: crypto.randomUUID(), owner_id: "owner-1", name: "Acme", slug: "acme", logo: null },
		write,
	);
	let membership = await db.create(
		memberships,
		{ id: crypto.randomUUID(), subject_id: "member-1", team_id: team.id, role: "member" },
		write,
	);
	let page = await db.create(
		statusPages,
		{ id: crypto.randomUUID(), team_id: team.id, name: "Client A", slug: "client-a", title: "A" },
		write,
	);

	return { db, team, membership, page };
}

/** Seeds `ctx.team`/`ctx.membership`/`ctx.teams`/auth state in place of the real chain. */
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

/** A request-scoped HTML renderer standing in for the bootstrap's. */
function createHtmlRenderer(ctx: RequestContext) {
	return function render(node: RemixNode, init?: ResponseInit): Response {
		let stream = renderToStream(node, { frameSrc: ctx.request.url });
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(stream, { ...init, headers });
	};
}

/** Sends a GET for the builder with an optional query. */
async function visit(
	fixture: { db: Database; team: SelectTeam; membership: SelectMembership },
	query = "",
): Promise<Response> {
	let router = createRouter({ middleware: [asyncContext(), database(() => fixture.db)] });
	router.map(routes.app.team.reports.index, {
		middleware: [
			seedTeam(fixture.team, fixture.membership),
			i18n,
			renderWith(createHtmlRenderer) as Middleware,
		],
		handler,
	});

	let path = routes.app.team.reports.index.href({ team: fixture.team.slug });
	return router.fetch(new Request(new URL(`${path}${query}`, "https://uptime.test")));
}

describe("report builder", () => {
	test("starts on last month with both downloads", async () => {
		let fixture = await createFixture();
		let response = await visit(fixture);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain('value="2026-08-01"');
		expect(body).toContain('value="2026-08-31"');
		expect(body).toContain('max="2026-09-28"');
		expect(body).toContain('formaction="/app/acme/reports/uptime-summary.csv"');
		expect(body).toContain('formaction="/app/acme/reports/uptime-daily.csv"');
		expect(body).not.toContain("Enter both dates");
		expect(body).not.toContain("Reports end yesterday");
	});

	test("lists the team's status pages as monitor filters", async () => {
		let fixture = await createFixture();
		let body = await (await visit(fixture)).text();

		expect(body).toContain(`value="status-page:${fixture.page.id}"`);
		expect(body).toContain("Client A");
		expect(body).toContain('value="type:tcp"');
	});

	test("keeps a sent-back query and explains what is wrong with it", async () => {
		let fixture = await createFixture();
		let response = await visit(
			fixture,
			`?from=2026-09-01&to=2026-09-29&monitors=status-page:${fixture.page.id}&dialect=standard`,
		);

		expect(response.status).toBe(400);
		let body = await response.text();
		expect(body).toContain("Reports end yesterday at the latest");
		expect(body).toContain('value="2026-09-29"');
		expect(body).toMatch(new RegExp(`value="status-page:${fixture.page.id}"[^>]*selected`));
	});

	test("presets keep the chosen monitors and format", async () => {
		let fixture = await createFixture();
		let body = await (await visit(fixture, "?monitors=type:dns&dialect=standard")).text();

		expect(body).toContain(
			'href="/app/acme/reports?from=2026-04-01&amp;to=2026-06-30&amp;monitors=type%3Adns&amp;dialect=standard"',
		);
	});
});
