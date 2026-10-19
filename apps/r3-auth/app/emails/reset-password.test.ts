/**
 * Tests of the recovery message on its own: the link reaches both body parts beside the
 * deadline it quotes, and every string it asks for exists in the catalog.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import emails from "~/app/emails";
import { mail } from "~/app/initializers/mail";

describe("the recovery message", () => {
	test("carries the link and its deadline", async () => {
		let url = "https://auth.sergiodxa.com/password/reset?token=abc123";
		let { html, text } = unwrap(
			await mail.render(emails.resetPassword, { props: { url, minutes: 30 } }),
		);

		expect(html).toContain(url);
		expect(text).toContain(url);
		expect(text).toContain("30 minutes");
		expect(text).not.toContain("emails.resetPassword");
	});
});
