/**
 * Tests the docs contact email: its subject names the reader, and its body carries their
 * address, the page they asked from and their message.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import emails from "~/app/emails";
import { mail } from "~/app/initializers/mail";

describe("Docs contact email", () => {
	test("names the reader and carries the page and their message", async () => {
		let rendered = unwrap(
			await mail.render(emails.docsContact, {
				props: {
					name: "Ada",
					email: "ada@example.com",
					message: "How do I run a migration first?",
					page: "https://sdxc.dev/docs/sdxc/deploy",
				},
			}),
		);

		expect(rendered.subject).toBe("[sdxc docs] Question from Ada");
		expect(rendered.text).toContain("ada@example.com");
		expect(rendered.text).toContain("https://sdxc.dev/docs/sdxc/deploy");
		expect(rendered.text).toContain("How do I run a migration first?");
		expect(rendered.html).toContain('href="https://sdxc.dev/docs/sdxc/deploy"');
	});

	test("names the reader by address when they left their name out", async () => {
		let rendered = unwrap(
			await mail.render(emails.docsContact, {
				props: { name: "", email: "ada@example.com", message: "Hi", page: "" },
			}),
		);

		expect(rendered.subject).toBe("[sdxc docs] Question from ada@example.com");
		expect(rendered.text).toContain("Not given");
	});
});
