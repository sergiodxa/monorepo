/**
 * The address-verification email, rendered through the app's email registry: the tenant in
 * the subject and the verification link in both body parts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vite-plus/test";

import emails from "~/app/emails";
import { mail } from "~/app/initializers/mail";

describe("verify address email", () => {
	test("names the tenant and carries the verification link", async () => {
		let url = "https://acme.example.com/u/verify?ticket=t1";
		let rendered = unwrap(
			await mail.render(emails.verifyAddress, { props: { url, tenantName: "Acme" } }),
		);

		expect(rendered.subject).toBe("Verify your email for Acme");
		expect(rendered.text).toContain("Follow this link to finish setting up your Acme account.");
		expect(rendered.html).toContain(url);
	});
});
