/**
 * The password-reset email, rendered through the app's email registry: the tenant in the
 * subject and the reset link in both body parts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vite-plus/test";

import emails from "~/app/emails";
import { mail } from "~/app/initializers/mail";

describe("reset password email", () => {
	test("names the tenant and carries the reset link", async () => {
		let url = "https://acme.example.com/u/reset?ticket=t1";
		let rendered = unwrap(
			await mail.render(emails.resetPassword, { props: { url, tenantName: "Acme" } }),
		);

		expect(rendered.subject).toBe("Reset your password for Acme");
		expect(rendered.text).toContain("choose a new password for your Acme account.");
		expect(rendered.text).toContain("If you didn't request this");
		expect(rendered.html).toContain(url);
	});
});
