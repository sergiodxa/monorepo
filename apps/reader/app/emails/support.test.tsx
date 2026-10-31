/**
 * Tests the support email: its subject names the topic and the message's first line, and
 * its body says who wrote and from which help page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import emails from "~/app/emails";
import { mail } from "~/app/initializers/mail";

describe("Support email", () => {
	test("names the topic, the sender and the help page", async () => {
		let rendered = unwrap(
			await mail.render(emails.support, {
				props: {
					page: "feed-not-updating",
					topic: "problem",
					email: "ada@example.com",
					name: "Ada",
					message: "My feed stopped updating.\n\nIt says the site answered with an error.",
					signedIn: true,
				},
			}),
		);

		expect(rendered.subject).toBe("[Reader · problem] My feed stopped updating.");
		expect(rendered.text).toContain("ada@example.com");
		expect(rendered.text).toContain("feed-not-updating");
		expect(rendered.text).toContain("signed in");
	});
});
