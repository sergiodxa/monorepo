/**
 * Tests of the verification message on its own: that the link and the lifetime it quotes
 * both reach both body parts, and that every string it asks for exists in the catalog. The
 * paths that send it are covered where they are driven; this file covers the copy those
 * paths cannot vary.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "@pkg/mail";
import { describe, expect, test } from "vitest";

import { emailTranslator } from "~/app/emails/locale";
import { VerifyEmailEmail } from "~/app/emails/verify-email";

const URL_UNDER_TEST = "https://auth.sergiodxa.com/verify-email?token=abc123";

/** Builds the message with everything held fixed. */
async function build(): Promise<VerifyEmailEmail> {
	let { locale, t } = await emailTranslator();

	return new VerifyEmailEmail({
		email: "jane@example.com",
		url: URL_UNDER_TEST,
		expiresInMinutes: 5,
		locale,
		t,
	});
}

describe("the verification message", () => {
	test("is addressed to the address it confirms, and to nowhere else", async () => {
		expect((await build()).to).toEqual({ email: "jane@example.com" });
	});

	test("carries the link in both body parts", async () => {
		let { html, text } = await render((await build()).body());

		expect(html).toContain(URL_UNDER_TEST);
		expect(text).toContain(URL_UNDER_TEST);
	});

	test("quotes the lifetime it was constructed with", async () => {
		let { text } = await render((await build()).body());

		expect(text).toContain("5 minutes");
	});

	test("renders no locale key, so every string it asks for exists", async () => {
		let email = await build();
		let { text } = await render(email.body());

		expect(email.subject).toBe("Confirm your email address");
		expect(text).not.toContain("emails.verifyEmail");
		expect(text).not.toContain("emails.footer");
	});
});
