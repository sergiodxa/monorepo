/**
 * The Encore support email, rendered through the site's email registry: the subject reads as
 * a triage label, and a request the spam filter doubted says so before the message.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vite-plus/test";

import emails from "~/app/emails";
import { mail } from "~/app/initializers/mail";

/** A complete request, as the form's validator produces one. */
const REQUEST = {
	name: "",
	email: "ada@example.com",
	topic: "Question",
	platform: "Mac",
	osVersion: "",
	appVersion: "",
	message: "How do I export my timers?",
};

describe("Encore support email", () => {
	test("leads the subject with the topic and the device", async () => {
		let rendered = unwrap(
			await mail.render(emails.encore.support, { props: { request: REQUEST } }),
		);

		expect(rendered.subject).toBe("[Encore] Question on Mac");
		expect(rendered.text).toContain("Not provided");
	});

	test("flags a request the spam filter was unsure about, with its signals", async () => {
		let flagged = { score: 6, signals: [{ check: "links.count", score: 6, detail: "4 links" }] };
		let rendered = unwrap(
			await mail.render(emails.encore.support, { props: { request: REQUEST, flagged } }),
		);

		expect(rendered.subject).toBe("[Possible spam] [Encore] Question on Mac");
		expect(rendered.text).toContain("links.count");
	});
});
