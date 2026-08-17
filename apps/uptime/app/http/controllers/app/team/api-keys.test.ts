/**
 * Tests for the API keys list page controller. This is a full page-rendering
 * controller (`ctx.render(<Jsx/>)`), so it needs a page-render harness rather than
 * the bare-action pattern used by `../actions/monitors.test.ts`: a router with
 * `asyncContext()` + the real `i18n` middleware (its `findLocale` calls `getViewer()`
 * and reads `userPreferences`, both of which resolve fine against the seeded auth
 * state and an empty test DB, falling back to English) + `renderWith
 * (createHtmlRenderer)`, plus a `seedTeam` middleware standing in for the real
 * `requireUser`/`requireTeam`/`requireRole` chain. Neither `cloudflare:workers` nor
 * `~/app/services/analytics` is touched by this controller (it only reads
 * `~/app/data/api-key`), so no `mock.module` is needed.
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
import { apiKeys, memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

let { handler } = (await import("./api-keys")).default as { handler: RequestHandler<any> };

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

/** Sends a GET request for the API keys index page through a minimal router. */
async function get(
	db: Database,
	team: SelectTeam,
	membership: SelectMembership,
): Promise<Response> {
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({ middleware: [asyncContext()] });
	router.map(routes.app.team.apiKeys.index, {
		middleware: [seedTeam(team, membership), i18n, renderWith(createHtmlRenderer) as Middleware],
		handler,
	});

	let request = new Request(
		new URL(routes.app.team.apiKeys.index.href({ team: team.slug }), "https://uptime.test"),
	);

	return container.scope(() => router.fetch(request));
}

describe("api-keys list controller", () => {
	test("renders the empty state when the team has no API keys", async () => {
		let { db, team, membership } = await createFixture();

		let response = await get(db, team, membership);

		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("No API keys yet");
		expect(body).toContain("Create an API key to access the Uptime API programmatically.");
		expect(body).toContain("Create API Key");
	});

	test("renders the table with a seeded API key", async () => {
		let { db, team, membership } = await createFixture();

		await db.create(
			apiKeys,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Production Key",
				key_hash: "hash123",
				key_prefix: "uptime_abcd1234",
				scopes: ["monitors:read"],
				expires_at: null,
				last_used_at: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await get(db, team, membership);

		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("API Keys");
		expect(body).toContain("Production Key");
		expect(body).toContain("uptime_abcd1234");
		expect(body).toContain("Never");
	});
});
