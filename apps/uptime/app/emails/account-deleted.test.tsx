/**
 * Tests the deletion confirmation as a value: it addresses the account it was constructed for,
 * takes its copy from the locale files, and — the part worth a test rather than a reading — puts
 * all four retention facts into the plain-text alternative as well as the HTML, since that
 * honesty is the substance of the message and the text part is where a lot of people read it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { render } from "@pkg/mail";

import { AccountDeletedEmail } from "~/app/emails/account-deleted";
import { emailTranslator } from "~/app/emails/locale";

/** Builds the email with a real translator, so a missing locale key fails the test. */
async function makeEmail() {
	let { locale, t } = await emailTranslator();
	return new AccountDeletedEmail({ email: "ada@example.com", locale, t });
}

describe("AccountDeletedEmail", () => {
	test("addresses the account that asked to be deleted", async () => {
		let email = await makeEmail();

		expect(email.to).toEqual({ email: "ada@example.com" });
	});

	test("takes its subject from the locale files", async () => {
		let email = await makeEmail();

		expect(email.subject).toBe("Your Uptime account has been deleted");
	});

	test("states plainly that the account is gone, in both body parts", async () => {
		let email = await makeEmail();

		let { html, text } = await render(email.body());

		expect(html).toContain("Your account has been deleted");
		expect(text).toContain("Your account has been deleted");
	});

	/**
	 * The claim the whole email exists to make honest. Each of the four is a real retention we
	 * verified, and none of them may be dropped by a layout change.
	 */
	test("names every retention we cannot avoid, in the plain-text part too", async () => {
		let email = await makeEmail();

		let { html, text } = await render(email.body());

		for (let body of [html, text]) {
			expect(body).toContain("Invoices");
			expect(body).toContain("append-only");
			expect(body).toContain("retention schedule");
			expect(body).toContain("identity provider");
		}
	});

	/** The row holding this address is deleted right after the send, and the copy says so. */
	test("tells the reader the address it reached them at has been deleted as well", async () => {
		let email = await makeEmail();

		let { text } = await render(email.body());

		expect(text).toContain("This email address was stored only so we could send you this message");
	});

	test("carries no call to action, since there is nothing left to sign in to", async () => {
		let email = await makeEmail();

		let { html } = await render(email.body());

		expect(html).not.toContain("uptime.sergiodxa.com");
	});
});
