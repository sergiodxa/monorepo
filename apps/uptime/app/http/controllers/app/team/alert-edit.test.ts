/**
 * Tests for the edit alert page controller. `cloudflare:workers` is mocked because
 * `~/app/data/monitor` (used here to populate the monitor-scope dropdown) reads `env`
 * at module load — following the exact pattern established in
 * `app/http/controllers/actions/monitors.test.ts`. It's a plain GET handler with no
 * branch that re-renders the form with validation errors (that only happens in the
 * `actions/alerts.ts` form-submission controller, tested separately), so this only
 * covers the 404 and the pre-filled-form 200 cases. `getViewer()`/`ctx.team`/
 * `ctx.membership`/`ctx.teams` are seeded directly by a fake middleware standing in for
 * the real `auth`/`requireUser`/`requireTeam` chain, matching the template in
 * `app/http/controllers/app/team/http-monitors.test.ts`.
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
import type { AlertConfig, SelectMembership, SelectTeam } from "~/database/schema";

import i18n from "~/app/http/middleware/i18n";
import { createTestDatabase } from "~/app/lib/test/db";
import { alerts, memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

mock.module("cloudflare:workers", () => ({ env: createEnv<Env>({}) }));

let { handler } = (await import("./alert-edit")).default as { handler: RequestHandler<any> };

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
	alertId: string,
): Promise<Response> {
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({ middleware: [asyncContext()] });
	router.map(routes.app.team.alerts.edit, {
		middleware: [seedTeam(team, membership), i18n, renderWith(createHtmlRenderer) as Middleware],
		handler,
	});

	let request = new Request(
		new URL(routes.app.team.alerts.edit.href({ team: team.slug, alertId }), "https://uptime.test"),
	);

	return container.scope(() => router.fetch(request));
}

const WEBHOOK_CONFIG: AlertConfig = {
	strategy: "webhook",
	config: { url: "https://example.com/hook", secret: "shh" },
};

describe("alertEdit", () => {
	test("responds 404 for an alert that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(db, team, membership, crypto.randomUUID());
		expect(response.status).toBe(404);
	});

	test("renders the edit form pre-filled with the alert's values", async () => {
		let { db, team, membership } = await createFixture();
		let alert = await db.create(
			alerts,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				monitor_id: null,
				name: "CTO Alert",
				notify_on_recovery: true,
				cooldown_minutes: 30,
				config: WEBHOOK_CONFIG,
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(db, team, membership, alert.id);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Edit CTO Alert");
		expect(body).toContain('value="CTO Alert"');
		expect(body).toContain('value="https://example.com/hook"');
		expect(body).toContain(`action="${routes.actions.alert.update.href({ team: team.slug })}"`);
		expect(body).toContain(`value="${alert.id}"`);
	});

	test("reflects the stored recovery-notification decision in the switch", async () => {
		let { db, team, membership } = await createFixture();

		/**
		 * Renders an alert whose recovery-notification flag is stored as `notify` and returns
		 * the response body, so both directions of the boolean go through the same render path.
		 */
		async function renderWithRecovery(notify: boolean) {
			let alert = await db.create(
				alerts,
				{
					id: crypto.randomUUID(),
					team_id: team.id,
					monitor_id: null,
					name: "CTO Alert",
					notify_on_recovery: notify,
					cooldown_minutes: 30,
					config: WEBHOOK_CONFIG,
				},
				{ touch: true, returnRow: true },
			);

			let response = await send(db, team, membership, alert.id);
			expect(response.status).toBe(200);
			return await response.text();
		}

		// Anchored to the attribute inside this input's own tag, never to the bare word
		// `checked`: that word also shows up in the components' `input:checked` CSS
		// selectors, so a substring check would pass no matter what the input renders.
		let CHECKED_ATTRIBUTE = /<input[^>]*name="notify_on_recovery"[^>]*\schecked/;

		// Control case: proves the regex can actually see a present `checked` attribute,
		// so the negative assertion below is failing for the right reason.
		expect(await renderWithRecovery(true)).toMatch(CHECKED_ATTRIBUTE);

		// SQLite stores booleans as 1/0. If a stored `false` came back as `0`,
		// `defaultChecked={0}` would still emit the attribute, and an HTML boolean
		// attribute is ON whenever it is merely present — so the switch would render
		// ticked and re-saving would silently flip the user's stored decision.
		expect(await renderWithRecovery(false)).not.toMatch(CHECKED_ATTRIBUTE);
	});

	test("keeps the saved channel selected and switches the settings blocks in CSS", async () => {
		let { db, team, membership } = await createFixture();
		let alert = await db.create(
			alerts,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				monitor_id: null,
				name: "CTO Alert",
				notify_on_recovery: true,
				cooldown_minutes: 30,
				config: WEBHOOK_CONFIG,
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(db, team, membership, alert.id);
		let body = await response.text();

		// Exactly one option carries `selected`, so the saved channel is what the browser
		// shows and what `:checked` reads with no JavaScript involved.
		expect(body.match(/<option value="[a-z]+" selected/g)).toHaveLength(1);
		// The saved channel is the selected option, so its block is the one CSS leaves visible.
		expect(body).toContain('value="webhook" selected');
		expect(body).toContain('value="shh"');

		for (let channel of ["email", "webhook", "slack", "discord"]) {
			expect(body).toContain(`data-channel="${channel}"`);
			expect(body).toContain(
				`&:has(select[name="strategy"] option:checked:not([value="${channel}"]))`,
			);
		}
	});
});
