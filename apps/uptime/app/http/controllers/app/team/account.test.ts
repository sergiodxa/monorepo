/**
 * Tests for the account page controller. No `cloudflare:workers` mock is needed —
 * this controller only touches `~/app/data/team` and `~/app/data/user-preferences`,
 * neither of which depends on a queue binding. `ctx.team`/`ctx.membership`/
 * `Auth`/`ctx.i18next` are seeded directly, standing in for the real
 * `requireUser`/`requireTeam` middleware chain.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestContext, RequestHandler } from "remix/router";
import type { RemixNode } from "remix/ui";

import { createTranslator } from "@pkg/i18n";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { renderToStream } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";
import type { OptionalEmail, SelectMembership, SelectTeam } from "~/database/schema";

import AccountDeletion from "~/app/data/account-deletion";
import { createTestDatabase } from "~/app/lib/test/db";
import en from "~/app/locales/en";
import { memberships, optionalEmails, teams, userPreferences } from "~/database/schema";
import routes from "~/routes/web";

import * as accountModule from "./account";

function createHtmlRenderer(ctx: RequestContext) {
	return function render(node: RemixNode, init?: ResponseInit) {
		let stream = renderToStream(node, { frameSrc: ctx.request.url, resolveFrame: async () => "" });
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(stream, { ...init, headers });
	};
}

let { i18n: i18nextInstance } = await createTranslator({
	resources: { en: { translation: en } },
	supportedLanguages: ["en"],
	fallbackLanguage: "en",
})();

function seedTeam(
	team: SelectTeam,
	membership: SelectMembership,
	teamsList: SelectTeam[] = [team],
): Middleware {
	let viewer: Viewer = {
		id: membership.subject_id,
		name: "Test Viewer",
		email: "viewer@example.com",
		avatar: "",
	};
	return (ctx, next) => {
		ctx.team = team;
		ctx.membership = membership;
		ctx.teams = teamsList;
		ctx.locale = "en";
		ctx.i18next = i18nextInstance;
		ctx.set(Auth, { ok: true, identity: viewer, method: "test" });
		return next();
	};
}

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

/**
 * The rendered `<input>` of one email's switch. Matched on its `value`, which is what the
 * action reads the form back by.
 */
function switchTag(body: string, email: OptionalEmail): string {
	let tag = new RegExp(`<input[^>]*value="${email}"[^>]*>`).exec(body)?.[0];
	if (tag === undefined) throw new Error(`The page rendered no switch for ${email}`);
	return tag;
}

/**
 * Whether one email's switch arrives on, read off the native `checked` attribute — the
 * one a browser submits, since a true boolean serializes as a bare attribute and a false
 * one drops it entirely; the lookbehind keeps the match off `aria-checked`.
 */
function isSwitchOn(body: string, email: OptionalEmail): boolean {
	return /(?<!aria-)\bchecked\b/.test(switchTag(body, email));
}

/** The inner markup of one named `<select>`, so option assertions match only this field's options. */
function optionsOf(body: string, name: string): string {
	let match = new RegExp(`<select[^>]*\\bname="${name}"[^>]*>([\\s\\S]*?)</select>`).exec(body);
	if (match?.[1] === undefined) throw new Error(`The page rendered no <select name="${name}">`);
	return match[1];
}

/**
 * Every `value` whose `<option>` carries the bare `selected` attribute — the one a
 * browser actually honors, since a `defaultValue` prop only sets the DOM property and
 * leaves the browser on the first option, which is how the saved language used to be lost.
 */
function selectedValues(body: string, name: string): string[] {
	return [...optionsOf(body, name).matchAll(/<option\b[^>]*>/g)]
		.map((match) => match[0])
		.filter((tag) => /\sselected(?=[\s/>])/.test(tag))
		.map((tag) => /\bvalue="([^"]*)"/.exec(tag)?.[1] ?? "");
}

async function renderAccount(db: Database, team: SelectTeam, membership: SelectMembership) {
	let router = createRouter({
		middleware: [asyncContext(), renderWith(createHtmlRenderer) as Middleware],
	});
	router.map(routes.app.team.account, {
		middleware: [seedTeam(team, membership)],
		handler: (accountModule.default as { handler: RequestHandler<any> }).handler,
	});

	let container = new ServiceContainer();
	container.instance(Database, db);

	let request = new Request(
		new URL(routes.app.team.account.href({ team: team.slug }), "https://uptime.test"),
	);
	return container.scope(() => router.fetch(request));
}

describe("account page", () => {
	test("renders the account page with the viewer's profile and teams", async () => {
		let { db, team, membership } = await createFixture();

		let response = await renderAccount(db, team, membership);
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain(en.page.account.header.title);
		expect(body).toContain(`mailto:viewer@example.com`);
		expect(body).toContain("viewer@example.com");
		expect(body).toContain(team.name);
	});

	/**
	 * The Emails section is the switches, and what a switch is *worth* is whether it arrives
	 * reflecting what the viewer chose: a checked switch that should have been off re-subscribes
	 * the reader the moment they save anything else on the form.
	 */
	test("renders one switch per optional email, all on for a viewer who has never chosen", async () => {
		let { db, team, membership } = await createFixture();

		let response = await renderAccount(db, team, membership);
		let body = await response.text();

		expect(body).toContain(en.page.account.emails.title);
		expect(body.match(/name="emails"/g)).toHaveLength(optionalEmails.length);

		for (let email of optionalEmails) {
			expect(isSwitchOn(body, email)).toBe(true);
			expect(body).toContain(en.page.account.emails.list[email].name);
		}
	});

	test("renders the switch of an email the viewer turned off as unchecked, leaving the rest on", async () => {
		let { db, team, membership } = await createFixture();
		await db.create(
			userPreferences,
			{
				id: crypto.randomUUID(),
				subject_id: membership.subject_id,
				unsubscribed_emails: ["teamDailyDigest"],
			},
			{ touch: true, returnRow: true },
		);

		let response = await renderAccount(db, team, membership);
		let body = await response.text();

		expect(isSwitchOn(body, "teamDailyDigest")).toBe(false);
		expect(isSwitchOn(body, "teamWeeklyDigest")).toBe(true);
	});

	/**
	 * A leavable row renders the label twice — once in its row menu, once in its
	 * confirmation dialog's submit button — so the occurrence count doubles per row.
	 */
	test("shows the Leave button only for a membership where the viewer is a plain member, not the owner", async () => {
		let { db, team, membership } = await createFixture();

		let otherTeam = await db.create(
			teams,
			{ id: crypto.randomUUID(), owner_id: "someone-else", name: "Beta", slug: "beta", logo: null },
			{ touch: true, returnRow: true },
		);
		await db.create(
			memberships,
			{
				id: crypto.randomUUID(),
				subject_id: membership.subject_id,
				team_id: otherTeam.id,
				role: "member",
			},
			{ touch: true, returnRow: true },
		);

		let response = await renderAccount(db, team, membership);
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain(team.name);
		expect(body).toContain(otherTeam.name);

		let leaveLabel = en.page.account.teams.table.actions.leave;
		let occurrences = body.split(leaveLabel).length - 1;
		expect(occurrences).toBe(2);
	});
});

describe("account page — Language", () => {
	test("selects Automatic for a viewer who has never chosen, and nothing else", async () => {
		let { db, team, membership } = await createFixture();

		let body = await (await renderAccount(db, team, membership)).text();

		expect(selectedValues(body, "language")).toEqual(["auto"]);
	});

	/**
	 * The data-losing case: the form posts every field, so a select showing the wrong
	 * language writes that wrong language back the next time the viewer saves.
	 */
	test("selects the stored language, and only it", async () => {
		let { db, team, membership } = await createFixture();
		await db.create(
			userPreferences,
			{
				id: crypto.randomUUID(),
				subject_id: membership.subject_id,
				preferred_language: "es",
			},
			{ touch: true, returnRow: true },
		);

		let body = await (await renderAccount(db, team, membership)).text();

		expect(selectedValues(body, "language")).toEqual(["es"]);
	});
});

describe("account page — Your Data", () => {
	/**
	 * A GET that returned the whole export would be a URL any other site could link to,
	 * so the request only succeeds as a POST, which keeps it unforgeable from outside.
	 */
	test("offers the export as a POST form rather than a link, and says what it leaves out", async () => {
		let { db, team, membership } = await createFixture();

		let response = await renderAccount(db, team, membership);
		let body = await response.text();

		expect(body).toContain(en.page.account.dataExport.title);
		expect(body).toContain(en.page.account.dataExport.form.cta);
		expect(body).toContain(`action="${routes.accountActions.exportData.href()}"`);
		expect(body).toContain("API key hashes");
	});
});

describe("account page — Delete Account", () => {
	test("renders the typed confirmation, natively gated, and no bare button", async () => {
		let { db, team, membership } = await createFixture();

		let response = await renderAccount(db, team, membership);
		let body = await response.text();

		expect(body).toContain(en.page.account.deleteAccount.title);
		expect(body).toContain(`action="${routes.accountActions.requestDeletion.href()}"`);
		expect(body).toContain('name="confirmation"');
		expect(body).toContain('pattern="DELETE"');
	});

	/** The copy has to say queued, because that is what the action does. */
	test("says the account is queued and not deleted, and that signing back in cancels it", async () => {
		let { db, team, membership } = await createFixture();

		let body = await (await renderAccount(db, team, membership)).text();

		expect(body).toContain(en.page.account.deleteAccount.card.whatHappens);
		expect(body).toContain("signing back in lets you cancel");
	});

	/**
	 * Each of these four is a retention this app genuinely cannot avoid, so the confirmation
	 * lists all of them to keep its deletion promise accurate.
	 */
	test("lists what cannot be deleted", async () => {
		let { db, team, membership } = await createFixture();

		let body = await (await renderAccount(db, team, membership)).text();

		expect(body).toContain(en.page.account.deleteAccount.card.retained.billing);
		expect(body).toContain(en.page.account.deleteAccount.card.retained.analytics);
		expect(body).toContain(en.page.account.deleteAccount.card.retained.logs);
		expect(body).toContain(en.page.account.deleteAccount.card.retained.identity);
	});

	/**
	 * A personal team is most accounts, so a warning that fires even with no one to lose
	 * access would train viewers to ignore it.
	 */
	test("warns about no one when the owned team has no other members", async () => {
		let { db, team, membership } = await createFixture();

		let body = await (await renderAccount(db, team, membership)).text();

		expect(body).toContain(team.name);
		expect(body).not.toContain("will lose access");
	});

	/**
	 * The warning reports a count so a viewer never sees who else uses the product.
	 */
	test("names the owned team and counts exactly the other members who lose access", async () => {
		let { db, team, membership } = await createFixture();
		for (let subjectId of ["colleague-1", "colleague-2"]) {
			await db.create(
				memberships,
				{ id: crypto.randomUUID(), subject_id: subjectId, team_id: team.id, role: "member" },
				{ touch: true, returnRow: true },
			);
		}

		let body = await (await renderAccount(db, team, membership)).text();

		expect(body).toContain(`${team.name} — 2 other members lose access.`);
		expect(body).toContain("2 other people will lose access");
		expect(body).not.toContain("colleague-1");
	});

	/**
	 * `teams.owner_id` is fixed at creation, so the copy states that directly instead of
	 * pointing anywhere else to change it.
	 */
	test("does not suggest handing the team over first", async () => {
		let { db, team, membership } = await createFixture();

		let body = await (await renderAccount(db, team, membership)).text();

		expect(body).toContain("no way to hand a team over");
		expect(body).not.toContain("change the owner");
	});

	/**
	 * The queued view drops the confirmation field entirely, so nothing suggests the
	 * first request needs redoing.
	 */
	test("shows a viewer who is already queued that state plus a cancel button, and not the form", async () => {
		let { db, team, membership } = await createFixture();
		await AccountDeletion.enqueue(db, membership.subject_id, "viewer@example.com");

		let body = await (await renderAccount(db, team, membership)).text();

		expect(body).toContain(en.page.account.deleteAccount.queued.title);
		expect(body).toContain(en.page.account.deleteAccount.queued.cta);
		expect(body).toContain(`action="${routes.accountActions.cancelDeletion.href()}"`);
		expect(body).not.toContain('pattern="DELETE"');
	});
});
