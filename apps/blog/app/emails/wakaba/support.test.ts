/**
 * The Wakaba support email, rendered through the site's email registry: the subject reads as
 * a triage label, and a request the spam filter doubted says so before the message.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import emails from "~/app/emails";
import { mail } from "~/app/initializers/mail";

/** A complete request, as the form's validator produces one. */
const REQUEST = {
	name: "",
	email: "ada@example.com",
	topic: "Question",
	platform: "iPad",
	osVersion: "",
	appVersion: "",
	message: "How do I export my progress?",
};

describe("Wakaba support email", () => {
	test("leads the subject with the topic and the device", async () => {
		let rendered = unwrap(
			await mail.render(emails.wakaba.support, { props: { request: REQUEST } }),
		);

		expect(rendered.subject).toBe("[Wakaba] Question on iPad");
		expect(rendered.text).toContain("Not provided");
	});

	test("names the Wakaba support form in the footer", async () => {
		let rendered = unwrap(
			await mail.render(emails.wakaba.support, { props: { request: REQUEST } }),
		);

		expect(rendered.text).toContain("sergiodxa.com/apps/wakaba/support");
	});

	test("flags a request the spam filter was unsure about, with its signals", async () => {
		let flagged = { score: 6, signals: [{ check: "links.count", score: 6, detail: "4 links" }] };
		let rendered = unwrap(
			await mail.render(emails.wakaba.support, { props: { request: REQUEST, flagged } }),
		);

		expect(rendered.subject).toBe("[Possible spam] [Wakaba] Question on iPad");
		expect(rendered.text).toContain("links.count");
	});
});
