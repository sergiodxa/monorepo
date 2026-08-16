/**
 * Tests for the HTTP monitor edit page controller. `cloudflare:workers` is mocked
 * because `~/app/data/monitor` reads `env` at module load; the env carries no bindings
 * and is strict, so this page reaching for one would fail by name here. This
 * controller is a pure GET render with a 404 guard; it doesn't re-render the form with
 * validation errors inline (that only happens in the separate `update-monitor` action,
 * already covered by `app/http/controllers/actions/monitors.test.ts`), so there's no
 * inline-error case to cover here. `getViewer()`/`ctx.team`/`ctx.membership`/`ctx.teams`
 * are seeded directly by a fake middleware standing in for the real `auth`/
 * `requireUser`/`requireTeam` chain, matching the same template's `seedTeam` helper.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, mock, test } from "bun:test";

import type { Middleware, RequestContext, RequestHandler } from "remix/router";
import type { RemixNode } from "remix/ui";

import { createEnv } from "@pkg/cloudflare-mocks";
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
import { memberships, monitors, teams } from "~/database/schema";
import routes from "~/routes/web";

mock.module("cloudflare:workers", () => ({ env: createEnv<Env>({}) }));

let { handler } = (await import("./monitor-edit")).default as { handler: RequestHandler<any> };

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
	router.map(routes.app.team.monitors.edit, {
		middleware: [seedTeam(team, membership), i18n, renderWith(createHtmlRenderer) as Middleware],
		handler,
	});

	let request = new Request(
		new URL(
			routes.app.team.monitors.edit.href({ team: team.slug, monitorId }),
			"https://uptime.test",
		),
	);

	return container.scope(() => router.fetch(request));
}

describe("monitorEdit", () => {
	test("renders the edit form pre-filled with the monitor's values", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			monitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				author_id: membership.subject_id,
				enabled_at: Date.now(),
				name: "Homepage",
				url: "https://example.com",
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(db, team, membership, monitor.id);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Edit Monitor");
		expect(body).toContain("Homepage");
		expect(body).toContain('value="https://example.com"');
		expect(body).toContain("Save Changes");
	});

	test("reflects the stored SSL monitoring decision in the checkbox", async () => {
		let { db, team, membership } = await createFixture();

		/**
		 * Renders a monitor whose SSL monitoring flag is stored as `enabled` and returns the
		 * response body, so both directions of the boolean go through the same render path.
		 */
		async function renderWithSsl(enabled: boolean) {
			let monitor = await db.create(
				monitors,
				{
					id: crypto.randomUUID(),
					team_id: team.id,
					author_id: membership.subject_id,
					enabled_at: Date.now(),
					name: "Homepage",
					url: "https://example.com",
					ssl_monitoring_enabled: enabled,
				},
				{ touch: true, returnRow: true },
			);

			let response = await send(db, team, membership, monitor.id);
			expect(response.status).toBe(200);
			return await response.text();
		}

		// Anchored to the attribute inside this input's own tag, never to the bare word
		// `checked`: that word also shows up in the components' `input:checked` CSS
		// selectors, so a substring check would pass no matter what the input renders.
		let CHECKED_ATTRIBUTE = /<input[^>]*name="ssl_monitoring_enabled"[^>]*\schecked/;

		// Control case: proves the regex can actually see a present `checked` attribute,
		// so the negative assertion below is failing for the right reason.
		expect(await renderWithSsl(true)).toMatch(CHECKED_ATTRIBUTE);

		// SQLite stores booleans as 1/0. If a stored `false` came back as `0`,
		// `defaultChecked={0}` would still emit the attribute, and an HTML boolean
		// attribute is ON whenever it is merely present — so the switch would render
		// ticked and re-saving would silently flip the user's stored decision.
		expect(await renderWithSsl(false)).not.toMatch(CHECKED_ATTRIBUTE);
	});

	test("404s for a monitor that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(db, team, membership, crypto.randomUUID());
		expect(response.status).toBe(404);
	});
});
