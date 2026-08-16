/**
 * Tests for the new alert page controller. `cloudflare:workers` is mocked because
 * `~/app/data/monitor` (used here to populate the monitor-scope dropdown) reads `env`
 * at module load — following the exact pattern established in
 * `app/http/controllers/actions/monitors.test.ts`. It renders an empty
 * `AlertFormFields` form, so this only checks the 200 response and that the form's
 * fields are present. `getViewer()`/`ctx.team`/`ctx.membership`/`ctx.teams` are seeded
 * directly by a fake middleware standing in for the real `auth`/`requireUser`/
 * `requireTeam` chain, matching the template in
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
import type { SelectMembership, SelectTeam } from "~/database/schema";

import i18n from "~/app/http/middleware/i18n";
import { createTestDatabase } from "~/app/lib/test/db";
import { dnsMonitors, memberships, monitors, teams } from "~/database/schema";
import routes from "~/routes/web";

mock.module("cloudflare:workers", () => ({ env: createEnv<Env>({}) }));

let { handler } = (await import("./alert-new")).default as { handler: RequestHandler<any> };

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
	router.map(routes.app.team.alerts.new, {
		middleware: [seedTeam(team, membership), i18n, renderWith(createHtmlRenderer) as Middleware],
		handler,
	});

	let request = new Request(
		new URL(routes.app.team.alerts.new.href({ team: team.slug }), "https://uptime.test"),
	);

	return container.scope(() => router.fetch(request));
}

describe("alertNew", () => {
	test("renders the empty create-alert form", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(db, team, membership);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Create Alert");
		expect(body).toContain('name="name"');
		expect(body).toContain('name="scope"');
		expect(body).toContain('name="strategy"');
		expect(body).toContain('name="notify_on_recovery"');
		expect(body).toContain('name="cooldown_minutes"');
		expect(body).toContain(`action="${routes.actions.alert.create.href({ team: team.slug })}"`);
	});

	test("posts every channel's inputs while showing only the selected channel", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(db, team, membership);
		let body = await response.text();

		// Every channel's inputs stay in the document — the validator only requires the
		// selected strategy's, and the action reads no others.
		for (let name of [
			"email_to",
			"email_subject_prefix",
			"webhook_url",
			"webhook_secret",
			"slack_webhook_url",
			"slack_channel",
			"discord_webhook_url",
		]) {
			expect(body).toContain(`name="${name}"`);
		}

		// The webhook signing note stays with the field it explains.
		expect(body).toContain("Webhook-Signature");

		// What hides the other three is CSS alone, so the picker works with no JavaScript.
		for (let channel of ["email", "webhook", "slack", "discord"]) {
			expect(body).toContain(`data-channel="${channel}"`);
			expect(body).toContain(
				`&:has(select[name="strategy"] option:checked:not([value="${channel}"]))`,
			);
		}
	});

	test("lists every type's monitors in the scope dropdown, grouped by type", async () => {
		let { db, team, membership } = await createFixture();
		await db.create(
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

		let response = await send(db, team, membership);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Homepage");
		// The per-type group and its "all of them" choice come with it, so a team can watch
		// a whole kind of monitor without naming each one.
		expect(body).toContain("HTTP Monitors");
		expect(body).toContain('value="type:http"');
	});

	test("offers a DNS monitor as its own scope, and its type as another", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			dnsMonitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Company domain",
				domain: "example.com",
			},
			{ touch: true, returnRow: true },
		);

		let body = await (await send(db, team, membership)).text();

		expect(body).toContain("Company domain");
		expect(body).toContain(`value="monitor:dns:${monitor.id}"`);
		expect(body).toContain('value="type:dns"');
	});

	test("omits a monitor type the team has none of", async () => {
		let { db, team, membership } = await createFixture();

		let body = await (await send(db, team, membership)).text();

		expect(body).not.toContain('value="type:tcp"');
		expect(body).not.toContain('value="type:cron"');
	});

	/**
	 * The default has to be marked on the option, not through a `defaultValue` on the
	 * host: `<select>` has no such attribute, so a form that names its default only there
	 * is one monitor away from posting something nobody picked.
	 */
	test("marks team-wide as the selected scope, and only it", async () => {
		let { db, team, membership } = await createFixture();
		await db.create(
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

		let body = await (await send(db, team, membership)).text();
		let scope = /<select[^>]*\bname="scope"[^>]*>([\s\S]*?)<\/select>/.exec(body)?.[1] ?? "";
		let selected = [...scope.matchAll(/<option\b[^>]*>/g)]
			.map((match) => match[0])
			.filter((tag) => /\sselected(?=[\s/>])/.test(tag))
			.map((tag) => /\bvalue="([^"]*)"/.exec(tag)?.[1] ?? "");

		expect(selected).toEqual([""]);
		expect(/<select[^>]*defaultvalue=/i.test(body)).toBe(false);
	});

	test("spaces the card's fields from the card alone, never twice", async () => {
		let { db, team, membership } = await createFixture();

		let body = await (await send(db, team, membership)).text();

		// The card body states the field rhythm once, as a gap, in a single rule.
		expect(body.match(/gap: 28px;/g)).toEqual(["gap: 28px;"]);
		// And nothing inside restates it as its own trailing margin, which would
		// leave that one field sitting on a doubled gap.
		expect(body).not.toContain("margin-block-end: 28px");
		// The body pads all four edges now that the last field ends flush with it.
		expect(body).toContain("padding: calc(var(--ui-spacing, 0.25rem) * 6);");

		// The channel fieldsets stack on that same rhythm from their own container, so
		// the three hidden ones cost no space and the visible one is spaced like a field.
		expect(body).toContain('<fieldset data-channel="email"');
	});
});
