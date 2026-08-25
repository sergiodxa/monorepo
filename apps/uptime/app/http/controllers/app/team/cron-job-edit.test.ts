/**
 * Tests for the edit cron-job monitor page controller. Covers the 404 and
 * pre-filled-form 200 cases; the validation-error re-render lives in the
 * `actions/cron-jobs.ts` form-submission controller.
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
import { cronJobMonitors, memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

let { handler } = (await import("./cron-job-edit")).default as { handler: RequestHandler<any> };

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
	router.map(routes.app.team.cronJobs.edit, {
		middleware: [seedTeam(team, membership), i18n, renderWith(createHtmlRenderer) as Middleware],
		handler,
	});

	let request = new Request(
		new URL(
			routes.app.team.cronJobs.edit.href({ team: team.slug, monitorId }),
			"https://uptime.test",
		),
	);

	return container.scope(() => router.fetch(request));
}

/**
 * The `value` of every `<option>` inside the timezone `<select>` that
 * carries `selected`. Exactly one should, since a second claimant leaves
 * the browser to decide which one wins.
 */
function selectedTimezones(body: string): string[] {
	let markup = /<select[^>]*\bname="timezone"[^>]*>([\s\S]*?)<\/select>/.exec(body)?.[1] ?? "";
	return [...markup.matchAll(/<option\b[^>]*>/g)]
		.map((match) => match[0])
		.filter((tag) => /\sselected(?=[\s/>])/.test(tag))
		.map((tag) => /\bvalue="([^"]*)"/.exec(tag)?.[1] ?? "");
}

describe("cronJobEdit", () => {
	test("responds 404 for a cron-job monitor that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(db, team, membership, crypto.randomUUID());
		expect(response.status).toBe(404);
	});

	test("renders the edit form pre-filled with the monitor's values", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			cronJobMonitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Nightly Backup",
				cron_expression: "0 0 * * *",
				timezone: "UTC",
				grace_period_seconds: 300,
				status: "new",
				enabled_at: Date.now(),
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(db, team, membership, monitor.id);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Edit Cron Job");
		expect(body).toContain('value="Nightly Backup"');
		expect(body).toContain('value="0 0 * * *"');
		expect(body).toContain(`action="${routes.actions.cronJob.update.href({ team: team.slug })}"`);
		expect(body).toContain(`value="${monitor.id}"`);
		/**
		 * The grace period's +/- buttons only step once their island hydrates, and
		 * the page renders the same markup either way, so the payload naming it is
		 * the proof.
		 */
		expect(body).toContain('"moduleUrl":"/resources/components/stepper-field.tsx"');
		expect(body).toContain('command="--step-up" commandfor="cron-job-grace-period-seconds"');
	});

	test("marks the stored timezone as the one selected option", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			cronJobMonitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Nightly Backup",
				cron_expression: "0 0 * * *",
				timezone: "Europe/Madrid",
				grace_period_seconds: 300,
				status: "new",
				enabled_at: Date.now(),
			},
			{ touch: true, returnRow: true },
		);

		let body = await (await send(db, team, membership, monitor.id)).text();

		/** Exactly one option claims `selected`, and it is the zone the job runs in. */
		expect(selectedTimezones(body)).toEqual(["Europe/Madrid"]);
	});

	test("only marks the alert-on-late switch checked when the stored value is true", async () => {
		let { db, team, membership } = await createFixture();

		async function renderWith(alertOnLate: boolean) {
			let monitor = await db.create(
				cronJobMonitors,
				{
					id: crypto.randomUUID(),
					team_id: team.id,
					name: "Nightly Backup",
					cron_expression: "0 0 * * *",
					timezone: "UTC",
					grace_period_seconds: 300,
					status: "new",
					alert_on_late: alertOnLate,
					enabled_at: Date.now(),
				},
				{ touch: true, returnRow: true },
			);
			return await (await send(db, team, membership, monitor.id)).text();
		}

		/**
		 * Matching happens within the switch's own tag, since the bare word
		 * `checked` also appears in the component's `~ input:checked` CSS. `checked`
		 * is an HTML boolean attribute: its mere presence — even as `checked="0"`
		 * for a `false` that came back from SQLite as the integer 0 — renders the
		 * switch ON, and re-saving would flip the stored decision.
		 */
		let checkedInput = /<input[^>]*\bname="alert_on_late"[^>]*\schecked/;

		expect(await renderWith(true)).toMatch(checkedInput);
		expect(await renderWith(false)).not.toMatch(checkedInput);
	});

	test("still selects UTC, which the IANA enumeration does not list", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			cronJobMonitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Nightly Backup",
				cron_expression: "0 0 * * *",
				timezone: "UTC",
				grace_period_seconds: 300,
				status: "new",
				enabled_at: Date.now(),
			},
			{ touch: true, returnRow: true },
		);

		let body = await (await send(db, team, membership, monitor.id)).text();

		/** UTC is offered as its own leading option, so the default keeps matching. */
		expect(selectedTimezones(body)).toEqual(["UTC"]);
	});
});
