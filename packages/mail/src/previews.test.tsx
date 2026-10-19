/**
 * Tests the preview middleware through a router: the list of every mapped email in every
 * locale, one email rendered as HTML or text in the locale asked for, 404s for an unmapped
 * email and one without `preview()`, and every other request passed on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { previews } from "./previews.js";

import { createEmail, createMail, Email, email, emails } from "./index.js";

/** The declarations the registry maps: one with a preview, one without. */
const EMAILS = emails({
	welcome: email({ props: s.object({ name: s.string() }) }),
	teams: { invite: email({ props: s.object({ team: s.string() }) }) },
});

/** Subjects per language, standing in for an app's message bundles. */
const SUBJECTS: Record<string, string> = { en: "Join {team}", es: "Únete a {team}" };

/** A registry whose invite reads its subject in the delivery's locale. */
function registry() {
	let mail = createMail({
		translator: (language) => {
			let locale = language !== undefined && language in SUBJECTS ? language : "en";
			return { locale, t: () => SUBJECTS[locale] ?? "" };
		},
	});
	mail.map(
		EMAILS.teams.invite,
		createEmail(EMAILS.teams.invite, {
			subject: ({ team, t }) => t("subject").replace("{team}", team),
			body: (handle) => () => (
				<Email.Layout lang={handle.props.locale} title={handle.props.team}>
					<Email.Text>Welcome to {handle.props.team}</Email.Text>
				</Email.Layout>
			),
			preview: () => ({ team: "Acme" }),
		}),
	);
	mail.map(
		EMAILS.welcome,
		createEmail(EMAILS.welcome, {
			subject: ({ name }) => `Welcome, ${name}`,
			body: (handle) => () => <p>Hello {handle.props.name}</p>,
		}),
	);
	return mail;
}

/** A router answering 418 for anything the previews pass on. */
function router() {
	let app = createRouter({
		middleware: [previews(registry(), { locales: ["en", "es"] })],
		defaultHandler: () => new Response("next", { status: 418 }),
	});
	return app;
}

describe("previews", () => {
	test("lists every mapped email in every locale, and those without a preview", async () => {
		let response = await router().fetch("https://example.com/_emails");
		let html = await response.text();

		expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
		expect(html).toContain("<code>teams.invite</code>");
		expect(html).toContain('href="/_emails/teams.invite?locale=es"');
		expect(html).toContain('href="/_emails/teams.invite?locale=en&amp;format=text"');
		expect(html).toMatch(/<code>welcome<\/code><\/td><td colspan="2">No preview/i);
	});

	test("renders an email's HTML from its preview props in the locale asked for", async () => {
		let response = await router().fetch("https://example.com/_emails/teams.invite?locale=es");
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toContain('lang="es"');
		expect(html).toContain("Welcome to Acme");
	});

	test("renders the subject and the text part with format=text", async () => {
		let response = await router().fetch(
			"https://example.com/_emails/teams.invite?locale=es&format=text",
		);

		expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
		expect(await response.text()).toMatch(/^Subject: Únete a Acme\n\n.*Welcome to Acme/s);
	});

	test("answers 404 for an unmapped email and for one without a preview", async () => {
		let unmapped = await router().fetch("https://example.com/_emails/billing.receipt");
		let none = await router().fetch("https://example.com/_emails/welcome");

		expect(unmapped.status).toBe(404);
		expect(await unmapped.text()).toContain('"billing.receipt"');
		expect(none.status).toBe(404);
		expect(await none.text()).toContain("has no preview()");
	});

	test("passes on every other path and method", async () => {
		let other = await router().fetch("https://example.com/emails");
		let posted = await router().fetch("https://example.com/_emails", { method: "POST" });

		expect(other.status).toBe(418);
		expect(posted.status).toBe(418);
	});

	test("passes every request on when it is not enabled", async () => {
		let app = createRouter({
			middleware: [previews(registry(), { enabled: false })],
			defaultHandler: () => new Response("next", { status: 418 }),
		});

		expect((await app.fetch("https://example.com/_emails")).status).toBe(418);
	});

	test("lists each email once without locales, linking the translator's fallback", async () => {
		let app = createRouter({ middleware: [previews(registry(), { path: "/dev/mail/" })] });

		let html = await (await app.fetch("https://example.com/dev/mail")).text();

		expect(html).toContain("Default locale");
		expect(html).toContain('href="/dev/mail/teams.invite"');
	});
});
