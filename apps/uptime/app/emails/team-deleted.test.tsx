/**
 * Tests the team-deleted notice as a value: it addresses the former member it was constructed
 * with, takes its copy from the locale files rather than from literals, and names the team in
 * both body parts.
 *
 * The privacy assertion is the one that would be easy to regress: the notice must say the owner
 * deleted their account without carrying that person's address, which is being erased.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "@pkg/mail";
import { describe, expect, test } from "vitest";

import { emailTranslator } from "~/app/emails/locale";
import { TeamDeletedEmail } from "~/app/emails/team-deleted";

/** Builds the email with a real translator, so a missing locale key fails the test. */
async function makeEmail(overrides: Partial<TeamDeletedEmail.Data> = {}) {
	let { locale, t } = await emailTranslator();
	return new TeamDeletedEmail({
		team: "Acme",
		email: "colleague@example.com",
		locale,
		t,
		...overrides,
	});
}

describe("TeamDeletedEmail", () => {
	test("addresses the former member it was built for", async () => {
		let email = await makeEmail();

		expect(email.to).toEqual({ email: "colleague@example.com" });
	});

	test("takes its subject from the locale files, interpolating the team", async () => {
		let email = await makeEmail();

		expect(email.subject).toBe("Acme has been deleted on Uptime");
	});

	test("names the team and says the owner deleted their account, in both body parts", async () => {
		let email = await makeEmail();

		let { html, text } = await render(email.body());

		for (let part of [html, text]) {
			expect(part).toContain("Acme");
			expect(part).toContain("owner");
			expect(part).toContain("deleted their Uptime account");
		}
	});

	test("says what is gone and that it cannot be recovered", async () => {
		let email = await makeEmail();

		let { text } = await render(email.body());

		expect(text).toContain("monitors");
		expect(text).toContain("alerts");
		expect(text).toContain("status pages");
		expect(text).toContain("none of it can be recovered");
	});

	test("offers starting over as the only next step, with no link into the deleted team", async () => {
		let email = await makeEmail({ team: "Acme" });

		let { html, text } = await render(email.body());

		expect(text).toContain("create a team of your own");
		// Nothing to open: a link to the team would lead to a page that no longer exists.
		expect(html).not.toContain("<a ");
	});

	/** The deleted account's own data must not travel into somebody else's mailbox. */
	test("never carries the deleted owner's address or name", async () => {
		let email = await makeEmail();

		let { html, text } = await render(email.body());

		expect(html).not.toContain("@example.com");
		expect(text).not.toContain("@example.com");
	});
});
