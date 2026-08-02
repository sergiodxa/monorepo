/**
 * Tests the invite email as a value: it addresses the invitee it was constructed
 * with, takes its subject from the locale files rather than from a literal, and
 * renders the team name and the accept link into both body parts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { render } from "@pkg/mail";

import { emailTranslator } from "~/app/emails/locale";
import { TeamInviteEmail } from "~/app/emails/team-invite";

/** Builds the email with a real translator, so a missing locale key fails the test. */
async function makeEmail(overrides: Partial<TeamInviteEmail.Data> = {}) {
	let { locale, t } = await emailTranslator();
	return new TeamInviteEmail({
		team: "Acme",
		email: "invitee@example.com",
		url: "https://uptime.test/invite/abc-123",
		locale,
		t,
		...overrides,
	});
}

describe("TeamInviteEmail", () => {
	test("addresses the invitee the invite names", async () => {
		let email = await makeEmail();

		expect(email.to).toEqual({ email: "invitee@example.com" });
	});

	test("takes its subject from the locale files, interpolating the team", async () => {
		let email = await makeEmail();

		expect(email.subject).toBe("You've been invited to join Acme on Uptime");
	});

	test("renders the team and the accept link into both body parts", async () => {
		let email = await makeEmail();

		let { html, text } = await render(email.body());

		expect(html).toContain("Acme");
		expect(html).toContain("https://uptime.test/invite/abc-123");
		expect(text).toContain("Acme");
		expect(text).toContain("https://uptime.test/invite/abc-123");
	});

	test("writes the copy in the language it was constructed for", async () => {
		let { locale, t } = await emailTranslator("es");
		let email = await makeEmail({ locale, t });

		expect(email.subject).not.toBe("You've been invited to join Acme on Uptime");
		expect(email.subject).toContain("Acme");
	});
});
