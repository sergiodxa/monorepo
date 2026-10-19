/**
 * Tests of the password-changed notice on its own: it reports the ended sessions and every
 * string it asks for exists in the catalog.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import emails from "~/app/emails";
import { mail } from "~/app/initializers/mail";

describe("the password-changed notice", () => {
	test("renders no locale key, so every string it asks for exists", async () => {
		let { subject, text } = unwrap(await mail.render(emails.passwordChanged, { props: {} }));

		expect(subject).not.toContain("emails.passwordChanged");
		expect(text).not.toContain("emails.passwordChanged");
		expect(text).not.toContain("emails.footer");
	});
});
