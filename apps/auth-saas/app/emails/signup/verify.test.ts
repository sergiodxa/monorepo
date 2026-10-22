/**
 * The platform signup verification email, rendered through the app's email registry: the
 * platform's name in the subject and the verification link in the body.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vite-plus/test";

import emails from "~/app/emails";
import { mail } from "~/app/initializers/mail";

describe("signup verify email", () => {
	test("names the platform and carries the verification link", async () => {
		let url = "https://auth.example.com/signup/verify?ticket=t1";
		let rendered = unwrap(await mail.render(emails.signup.verify, { props: { url } }));

		expect(rendered.subject).toBe("Verify your email for Auth SaaS");
		expect(rendered.text).toContain("your Auth SaaS account and your new organization.");
		expect(rendered.html).toContain(url);
	});
});
