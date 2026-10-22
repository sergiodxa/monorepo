/**
 * Tests for the HTTP monitor edit page controller. `cloudflare:workers` is mocked
 * because `~/app/initializers/queue` reads `env` at module load, and the mock's strict,
 * bindingless env matches what a page doing only a GET render and 404 guard needs.
 * Validation-error rendering belongs to the separate `update-monitor` action and is
 * covered by its own suite. `getViewer()`/`ctx.team`/`ctx.membership`/`ctx.teams`
 * are seeded directly by a fake middleware standing in for the real `auth`/
 * `requireUser`/`requireTeam` chain.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { Database } from "remix/data-table";
import type { Middleware, RequestContext, RequestHandler } from "remix/router";

import { createEnv } from "@sdxc/cloudflare-mocks";
import { database } from "@sdxc/database-middleware";
import { unwrap } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";
import { renderToStream } from "remix/component/server";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { describe, expect, test, vi } from "vite-plus/test";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import { teamAccess } from "~/app/http/middleware/access";
import i18n from "~/app/http/middleware/i18n";
import { createTestDatabase } from "~/app/test/db";
import { testAssets } from "~/app/test/document-assets";
import { memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

vi.doMock("cloudflare:workers", () => ({ env: createEnv<Env>({}) }));

let { bindModels } = await import("~/app/test/models");
let { default: models } = await import("~/app/http/middleware/models");
let { handler } = (await import("./monitor-edit")).default as { handler: RequestHandler<any> };

/** Creates an in-memory database seeded with one team and a member's membership. */
async function createFixture() {
	let { db } = createTestDatabase();

	let team = await db.create(
		teams,
		{ id: generateUUID(), owner_id: "owner-1", name: "Acme", slug: "acme", logo: null },
		{ touch: true, returnRow: true },
	);
	let membership = await db.create(
		memberships,
		{ id: generateUUID(), subject_id: "member-1", team_id: team.id, role: "member" },
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

/** Minimal request-scoped HTML renderer standing in for the app's `render()` middleware. */
function createHtmlRenderer(ctx: RequestContext) {
	return async function render(node: RemixNode, init?: ResponseInit): Promise<Response> {
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
	let router = createRouter({ middleware: [asyncContext(), database(db), models()] });
	router.map(routes.app.team.monitors.edit, {
		middleware: [
			seedTeam(team, membership),
			teamAccess,
			i18n,
			testAssets(),
			renderWith(createHtmlRenderer) as Middleware,
		],
		handler,
	});

	let request = new Request(
		new URL(
			routes.app.team.monitors.edit.href({ team: team.slug, monitorId }),
			"https://uptime.test",
		),
	);

	return router.fetch(request);
}

describe("monitorEdit", () => {
	test("renders the edit form pre-filled with the monitor's values", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = unwrap(
			await bindModels(db).monitors.create({
				id: generateUUID(),
				team_id: team.id,
				author_id: membership.subject_id,
				enabled_at: Date.now(),
				name: "Homepage",
				url: "https://example.com",
			}),
		);

		let response = await send(db, team, membership, monitor.id);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Edit Monitor");
		expect(body).toContain("Homepage");
		expect(body).toContain('value="https://example.com"');
		expect(body).toContain("Save Changes");
	});

	/**
	 * Anchored to the input's own tag, since the bare `checked` word also appears
	 * in the components' CSS selectors. Guards against SQLite's stored 1/0 leaking as
	 * a present HTML attribute, which would tick the switch and flip the saved decision.
	 */
	test("reflects the stored SSL monitoring decision in the checkbox", async () => {
		let { db, team, membership } = await createFixture();

		/**
		 * Renders a monitor whose SSL monitoring flag is stored as `enabled` and returns the
		 * response body, so both directions of the boolean go through the same render path.
		 */
		async function renderWithSsl(enabled: boolean) {
			let monitor = unwrap(
				await bindModels(db).monitors.create({
					id: generateUUID(),
					team_id: team.id,
					author_id: membership.subject_id,
					enabled_at: Date.now(),
					name: "Homepage",
					url: "https://example.com",
					ssl_monitoring_enabled: enabled,
				}),
			);

			let response = await send(db, team, membership, monitor.id);
			expect(response.status).toBe(200);
			return await response.text();
		}

		let CHECKED_ATTRIBUTE = /<input[^>]*name="ssl_monitoring_enabled"[^>]*\schecked/;

		expect(await renderWithSsl(true)).toMatch(CHECKED_ATTRIBUTE);

		expect(await renderWithSsl(false)).not.toMatch(CHECKED_ATTRIBUTE);
	});

	test("404s for a monitor that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(db, team, membership, generateUUID());
		expect(response.status).toBe(404);
	});

	test("offers the delete control to an admin alone", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = unwrap(
			await bindModels(db).monitors.create({
				id: generateUUID(),
				team_id: team.id,
				author_id: membership.subject_id,
				enabled_at: Date.now(),
				name: "Homepage",
				url: "https://example.com",
			}),
		);
		let admin = await db.create(
			memberships,
			{ id: generateUUID(), subject_id: "admin-1", team_id: team.id, role: "admin" },
			{ touch: true, returnRow: true },
		);
		let deleteAction = routes.actions.monitor.http.delete.href({ team: team.slug });

		let asMember = await (await send(db, team, membership, monitor.id)).text();
		let asAdmin = await (await send(db, team, admin, monitor.id)).text();

		expect(asMember).not.toContain(deleteAction);
		expect(asAdmin).toContain(deleteAction);
	});
});
