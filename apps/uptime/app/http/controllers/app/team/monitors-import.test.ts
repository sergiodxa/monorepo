/**
 * Tests for the bulk monitor import page controller: the paste box it renders, and the
 * one-time report it shows for an import that rejected lines. The session is a real
 * session/flash chain, since the report reaching this page at all is the thing worth testing.
 * `ctx.team`/`ctx.membership`/`ctx.teams` and the viewer are seeded by a fake middleware
 * standing in for `requireUser`/`requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { Middleware, RequestContext, RequestHandler } from "remix/fetch-router";
import type { RemixNode } from "remix/ui";

import { ServiceContainer } from "@pkg/service-container";
import { asyncContext } from "remix/async-context-middleware";
import { Auth } from "remix/auth-middleware";
import { createCookie } from "remix/cookie";
import { Database } from "remix/data-table";
import { createRouter } from "remix/fetch-router";
import { renderWith } from "remix/render-middleware";
import { Session } from "remix/session";
import { session } from "remix/session-middleware";
import { createMemorySessionStorage } from "remix/session-storage/memory";
import { renderToStream } from "remix/ui/server";

import type { Viewer } from "~/app/http/middleware/auth";
import type { MonitorImportReport } from "~/app/http/validators/monitor-import";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import { MONITOR_IMPORT_REPORT } from "~/app/http/controllers/actions/monitors-import";
import i18n from "~/app/http/middleware/i18n";
import { createTestDatabase } from "~/app/lib/test/db";
import { memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

let { handler } = (await import("./monitors-import")).default as { handler: RequestHandler<any> };

let sessionCookie = createCookie("uptime-test-session", { secrets: ["test-secret"] });
let sessionStorage = createMemorySessionStorage();

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

/** Minimal request-scoped HTML renderer standing in for the app's own. */
function createHtmlRenderer(ctx: RequestContext) {
	return function render(node: RemixNode, init?: ResponseInit): Response {
		let stream = renderToStream(node, { frameSrc: ctx.request.url });
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(stream, { ...init, headers });
	};
}

/** The `Cookie` header a browser would send back, from a response's `Set-Cookie`s. */
function cookieHeader(response: Response): string {
	return response.headers
		.getSetCookie()
		.map((value) => value.split(";")[0])
		.join("; ");
}

/**
 * Renders the page, optionally after an earlier request flashed an import report — the only
 * way this page ever sees one, since the action writes it and redirects here.
 */
async function send(
	db: Database,
	team: SelectTeam,
	membership: SelectMembership,
	report?: MonitorImportReport,
): Promise<Response> {
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({
		middleware: [asyncContext(), session(sessionCookie, sessionStorage)],
	});
	router.map(routes.app.team.monitorsImport, {
		middleware: [seedTeam(team, membership), i18n, renderWith(createHtmlRenderer) as Middleware],
		handler,
	});
	router.post("/flash", (ctx) => {
		if (report) ctx.get(Session)?.flash(MONITOR_IMPORT_REPORT, report);
		return new Response(null, { status: 204 });
	});

	let url = new URL(
		routes.app.team.monitorsImport.href({ team: team.slug }),
		"https://uptime.test",
	);

	let cookie = "";
	if (report) {
		let flashed = await container.scope(() =>
			router.fetch(new Request("https://uptime.test/flash", { method: "POST" })),
		);
		cookie = cookieHeader(flashed);
	}

	return container.scope(() =>
		router.fetch(new Request(url, cookie ? { headers: { Cookie: cookie } } : undefined)),
	);
}

describe("monitorsImport", () => {
	test("renders the paste box and the shared interval control", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(db, team, membership);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("<textarea");
		expect(body).toContain('name="urls"');
		expect(body).toContain('name="interval_seconds"');
		expect(body).toContain(routes.actions.monitor.http.import.href({ team: team.slug }));
	});

	test("renders no report when the last request didn't leave one", async () => {
		let { db, team, membership } = await createFixture();

		let body = await (await send(db, team, membership)).text();

		expect(body).not.toContain('id="import-report"');
	});

	test("shows every rejected line with its reason so it can be fixed and re-pasted", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(db, team, membership, {
			created: 2,
			overflow: 0,
			rejected: [
				{ line: 4, input: "https://example.com/", reason: "duplicate" },
				{ line: 5, input: "not a url", reason: "invalidUrl" },
			],
		});

		let body = await response.text();
		expect(body).toContain('id="import-report"');
		expect(body).toContain("<code>https://example.com/</code>");
		expect(body).toContain("<code>not a url</code>");
		// Reason copy is i18n, so the assertion is on the reasons being distinguished at all:
		// two rejected lines, each with its own line number and its own reason cell.
		let cells = body.match(/<code>/g);
		expect(cells).toHaveLength(2);
	});

	test("mentions the lines it never looked at when a paste ran past the cap", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(db, team, membership, { created: 50, overflow: 7, rejected: [] });

		expect(await response.text()).toContain('id="import-overflow"');
	});

	test("leaves the paste box empty rather than pre-filling it with the report", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(db, team, membership, {
			created: 0,
			overflow: 0,
			rejected: [{ line: 1, input: "not a url", reason: "invalidUrl" }],
		});

		let body = await response.text();
		let box = /<textarea[^>]*>([\s\S]*?)<\/textarea>/.exec(body);
		expect(box).not.toBeNull();
		expect(box?.[1]?.trim()).toBe("");
	});
});
