/**
 * Tests of the verification message on its own: that the link and the lifetime it quotes
 * both reach both body parts, and that every string it asks for exists in the catalog. The
 * paths that send it are covered where they are driven; this file covers the copy those
 * paths cannot vary.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import emails from "~/app/emails";
import { mail } from "~/app/initializers/mail";

const URL_UNDER_TEST = "https://auth.sergiodxa.com/verify-email?token=abc123";

/** Renders the message with everything held fixed. */
async function build() {
	let rendered = await mail.render(emails.verifyEmail, {
		props: { url: URL_UNDER_TEST, expiresInMinutes: 5 },
	});

	return unwrap(rendered);
}

describe("the verification message", () => {
	test("carries the link in both body parts", async () => {
		let { html, text } = await build();

		expect(html).toContain(URL_UNDER_TEST);
		expect(text).toContain(URL_UNDER_TEST);
	});

	test("quotes the lifetime it was rendered with", async () => {
		let { text } = await build();

		expect(text).toContain("5 minutes");
	});

	test("renders no locale key, so every string it asks for exists", async () => {
		let { subject, text } = await build();

		expect(subject).toBe("Confirm your email address");
		expect(text).not.toContain("emails.verifyEmail");
		expect(text).not.toContain("emails.footer");
	});
});
