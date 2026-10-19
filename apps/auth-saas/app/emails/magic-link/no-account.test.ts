/**
 * The magic-link no-account notice, rendered through the app's email registry: it names the
 * tenant and carries no link to follow.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import emails from "~/app/emails";
import { mail } from "~/app/initializers/mail";

describe("magic link no-account email", () => {
	test("tells the reader a sign-in was attempted, with nothing to follow", async () => {
		let rendered = unwrap(
			await mail.render(emails.magicLink.noAccount, { props: { tenantName: "Acme" } }),
		);

		expect(rendered.subject).toBe("Sign-in attempted for Acme");
		expect(rendered.text).toContain("Someone just tried to sign in to Acme");
		expect(rendered.html).not.toContain("href=");
	});
});
