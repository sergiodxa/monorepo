/**
 * Tests the invite email through the registry: it takes its subject from the locale files,
 * renders the team name and the accept link into both body parts, and writes the copy in the
 * language it was sent in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import emails from "~/app/emails";
import { mail } from "~/app/initializers/mail";

/** Renders the invite with a real translator, so a missing locale key fails the test. */
async function renderInvite(locale?: string) {
	return unwrap(
		await mail.render(emails.teams.invite, {
			locale,
			props: { team: "Acme", url: "https://uptime.test/invite/abc-123" },
		}),
	);
}

describe("teams.invite email", () => {
	test("takes its subject from the locale files, interpolating the team", async () => {
		let email = await renderInvite();

		expect(email.subject).toBe("You've been invited to join Acme on Uptime");
	});

	test("renders the team and the accept link into both body parts", async () => {
		let { html, text } = await renderInvite();

		expect(html).toContain("Acme");
		expect(html).toContain("https://uptime.test/invite/abc-123");
		expect(text).toContain("Acme");
		expect(text).toContain("https://uptime.test/invite/abc-123");
	});

	test("writes the copy in the language it was sent in", async () => {
		let email = await renderInvite("es");

		expect(email.subject).not.toBe("You've been invited to join Acme on Uptime");
		expect(email.subject).toContain("Acme");
	});
});
