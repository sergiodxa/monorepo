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
					message: "My cron job shows as missed.",
					page: "https://uptime.sergiodxa.com/docs/quickstart",
				},
			}),
		);

		expect(rendered.subject).toBe("[Uptime docs] Question from Ada");
		expect(rendered.text).toContain("ada@example.com");
		expect(rendered.text).toContain("https://uptime.sergiodxa.com/docs/quickstart");
		expect(rendered.text).toContain("My cron job shows as missed.");
	});

	test("falls back to the address when the reader left their name out", async () => {
		let rendered = unwrap(
			await mail.render(emails.docsContact, {
				props: { name: "", email: "ada@example.com", message: "Hi", page: "" },
			}),
		);

		expect(rendered.subject).toBe("[Uptime docs] Question from ada@example.com");
	});
});
