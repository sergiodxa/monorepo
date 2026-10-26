/**
 * The press kit invitation email, rendered through the site's email registry: the subject reads
 * as a triage label, the organizer is the Reply-To, and a doubted message says so first.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import emails from "~/app/emails";
import { mail } from "~/app/initializers/mail";

/** A complete invitation, as the form's validator produces one. */
const REQUEST = {
	name: "Ada Lovelace",
	email: "ada@example.com",
	kind: "podcast",
	event: "",
	message: "Would you join us for an episode about Remix?",
};

describe("press contact email", () => {
	test("labels the subject with the kind and, without an event, the sender", async () => {
		let rendered = unwrap(
			await mail.render(emails.press.contact, {
				props: { request: REQUEST, pageLanguage: "es-AR" },
			}),
		);

		expect(rendered.subject).toBe("[Press] podcast: Ada Lovelace");
		expect(rendered.text).toContain("Not provided");
		expect(rendered.text).toContain("Page language es-AR");
	});

	test("flags a message the spam filter was unsure about, with its signals", async () => {
		let flagged = { score: 6, signals: [{ check: "links.count", score: 6, detail: "4 links" }] };
		let rendered = unwrap(
			await mail.render(emails.press.contact, {
				props: { request: { ...REQUEST, event: "Remix Radio" }, pageLanguage: "en", flagged },
			}),
		);

		expect(rendered.subject).toBe("[Possible spam] [Press] podcast: Remix Radio");
		expect(rendered.text).toContain("links.count");
	});
});
