/**
 * The magic-link sign-in email, rendered through the app's email registry: the tenant in the
 * subject, and both the link and the code in the body.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vite-plus/test";

import emails from "~/app/emails";
import { mail } from "~/app/initializers/mail";

describe("magic link sign-in email", () => {
	test("carries the link and the code", async () => {
		let url = "https://acme.example.com/u/magic-link/complete?token=t1";
		let rendered = unwrap(
			await mail.render(emails.magicLink.signIn, {
				props: { url, code: "ABCD-EFGH", tenantName: "Acme" },
			}),
		);

		expect(rendered.subject).toBe("Your sign-in link for Acme");
		expect(rendered.text).toContain("Or enter this code where you started signing in:");
		expect(rendered.text).toContain("ABCD-EFGH");
		expect(rendered.html).toContain(url);
	});
});
