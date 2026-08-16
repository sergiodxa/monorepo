/**
 * Tests for the new API key form page controller. Like `./api-keys.test.ts`, this is
 * a full page-rendering controller and needs the same page-render harness (router
 * with `asyncContext()` + the real `i18n` middleware + `renderWith
 * (createHtmlRenderer)`, plus a `seedTeam` middleware standing in for
 * `requireUser`/`requireTeam`/`requireRole`). This controller doesn't touch the
 * database at all — it only renders a static form listing every `apiKeyScopes` value
 * as a checkbox — so the fixture only needs a team + admin membership.
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
import { memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

let { handler } = (await import("./api-key-new")).default as { handler: RequestHandler<any> };

/** Creates an in-memory database seeded with one team and an admin membership. */
async function createFixture() {
	let { db } = createTestDatabase();

	let team = await db.create(
		teams,
		{ id: crypto.randomUUID(), owner_id: "owner-1", name: "Acme", slug: "acme", logo: null },
		{ touch: true, returnRow: true },
	);
	let membership = await db.create(
		memberships,
		{ id: crypto.randomUUID(), subject_id: "owner-1", team_id: team.id, role: "admin" },
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

/** Sends a GET request for the new API key form page through a minimal router. */
async function get(
	db: Database,
	team: SelectTeam,
	membership: SelectMembership,
): Promise<Response> {
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({ middleware: [asyncContext()] });
	router.map(routes.app.team.apiKeys.new, {
		middleware: [seedTeam(team, membership), i18n, renderWith(createHtmlRenderer) as Middleware],
		handler,
	});

	let request = new Request(
		new URL(routes.app.team.apiKeys.new.href({ team: team.slug }), "https://uptime.test"),
	);

	return container.scope(() => router.fetch(request));
}

describe("api-key-new form controller", () => {
	test("renders the new API key form", async () => {
		let { db, team, membership } = await createFixture();

		let response = await get(db, team, membership);

		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Create New API Key");
		expect(body).toContain('name="name"');
		expect(body).toContain('name="expires_at"');
		expect(body).toContain('value="monitors:read"');
	});

	test("labels each scope with its raw string and describes it", async () => {
		let { db, team, membership } = await createFixture();

		let body = await (await get(db, team, membership)).text();

		expect(body).toContain('aria-describedby="api-key-scope-ping-trigger-description"');
		expect(body).toContain('<p id="api-key-scope-ping-trigger-description"');
		expect(body).toContain(">ping:trigger<");
		expect(body).toContain(
			"Run one-off HTTP, DNS and TCP checks without creating a monitor. Each check is billed as one ping and needs an active subscription.",
		);
	});

	test("splits the scope list into two columns only once the page is wide enough", async () => {
		let { db, team, membership } = await createFixture();

		let body = await (await get(db, team, membership)).text();

		let twoColumns = body.match(
			/@media \(min-width: 1024px\)\s*\{[^{]*\{\s*grid-template-columns:\s*repeat\(2, 1fr\);/,
		);
		expect(twoColumns).not.toBeNull();
		expect(body).toContain("max-inline-size: 880px");
	});

	test("spaces the card's fields from the card alone, never twice", async () => {
		let { db, team, membership } = await createFixture();

		let body = await (await get(db, team, membership)).text();

		// The card body states the field rhythm once, as a gap, in a single rule.
		expect(body.match(/gap: 28px;/g)).toEqual(["gap: 28px;"]);
		// And nothing inside restates it as its own trailing margin, which would
		// leave that one field sitting on a doubled gap.
		expect(body).not.toContain("margin-block-end: 28px");
		// The body pads all four edges now that the last field ends flush with it.
		expect(body).toContain("padding: calc(var(--ui-spacing, 0.25rem) * 6);");
	});
});
