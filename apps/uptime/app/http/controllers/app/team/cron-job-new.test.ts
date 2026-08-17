/**
 * Tests for the new cron-job monitor page controller. It renders an empty form with
 * no data dependency beyond the team, so this only checks the 200 response, that the
 * form's fields are present, and that they are framed as the three settings cards the
 * page groups them into (asserted through the sections' anchor ids, which stay stable
 * while their translated headings can change). Doesn't import
 * `~/app/data/monitor`, so no `cloudflare:workers` mock is needed. `getViewer()`/
 * `ctx.team`/`ctx.membership`/`ctx.teams` are seeded directly by a fake middleware
 * standing in for the real `auth`/`requireUser`/`requireTeam` chain, matching the
 * template in `app/http/controllers/app/team/http-monitors.test.ts`.
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
import { memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

let { handler } = (await import("./cron-job-new")).default as { handler: RequestHandler<any> };

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
	router.map(routes.app.team.cronJobs.new, {
		middleware: [seedTeam(team, membership), i18n, renderWith(createHtmlRenderer) as Middleware],
		handler,
	});

	let request = new Request(
		new URL(routes.app.team.cronJobs.new.href({ team: team.slug }), "https://uptime.test"),
	);

	return container.scope(() => router.fetch(request));
}

describe("cronJobNew", () => {
	test("renders the empty create-cron-job form", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(db, team, membership);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Create Cron Job");
		expect(body).toContain('name="name"');
		expect(body).toContain('name="cron_expression"');
		expect(body).toContain('name="timezone"');
		expect(body).toContain('name="grace_period_seconds"');
		expect(body).toContain('name="alert_on_late"');
		expect(body).toContain('name="is_enabled"');
		expect(body).toContain(`action="${routes.actions.cronJob.create.href({ team: team.slug })}"`);
	});

	test("groups the fields into the basics, schedule and alerting cards", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(db, team, membership);
		let body = await response.text();

		expect(body).toContain('id="basics"');
		expect(body).toContain('id="schedule"');
		expect(body).toContain('id="alerting"');
	});

	/**
	 * The grace period's +/- buttons only step once their island hydrates, and the page
	 * renders the same markup either way — so the hydration payload naming the island is
	 * the only thing on this page that tells a live stepper from an inert one.
	 */
	test("ships the grace period as a hydrating stepper", async () => {
		let { db, team, membership } = await createFixture();

		let body = await (await send(db, team, membership)).text();

		expect(body).toContain('"moduleUrl":"/resources/components/stepper-field.tsx"');
		expect(body).toContain('command="--step-up" commandfor="cron-job-grace-period-seconds"');
		expect(body).toContain('command="--step-down" commandfor="cron-job-grace-period-seconds"');
	});

	test("offers the timezone as a grouped picker defaulting to UTC", async () => {
		let { db, team, membership } = await createFixture();

		let body = await (await send(db, team, membership)).text();

		let markup = /<select[^>]*\bname="timezone"[^>]*>([\s\S]*?)<\/select>/.exec(body)?.[1] ?? "";
		expect(markup).not.toBe("");

		// Exactly one option claims `selected` — a second claimant would leave which one
		// the browser honours up to the browser rather than to the markup.
		let selected = [...markup.matchAll(/<option\b[^>]*>/g)]
			.map((match) => match[0])
			.filter((tag) => /\sselected(?=[\s/>])/.test(tag))
			.map((tag) => /\bvalue="([^"]*)"/.exec(tag)?.[1] ?? "");
		expect(selected).toEqual(["UTC"]);

		// The zones are grouped by region rather than listed as one 400-entry run.
		expect(markup).toContain('<optgroup label="Europe"');
		expect(markup).toContain('<option value="Europe/Madrid"');
		// A `<select>` has no `defaultValue` attribute; spelling one renders inert markup.
		expect(/<select[^>]*defaultvalue=/i.test(body)).toBe(false);
	});
});
