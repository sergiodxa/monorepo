/**
 * The posting confirmation, rendered through the board's email registry in each language a
 * submission can be made in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import emails from "~/app/emails";
import { mail } from "~/app/initializers/mail";

describe("posting published email", () => {
	test("names the posting in the subject and the body", async () => {
		let rendered = unwrap(
			await mail.render(emails.postingPublished, {
				locale: "en",
				props: { title: "Senior Remix Engineer", company: "Acme" },
			}),
		);

		expect(rendered.subject).toBe("Senior Remix Engineer is live on the Remix Job Board");
		expect(rendered.text).toContain("Senior Remix Engineer at Acme is now on the board.");
	});

	test("writes in the language the submission was made in", async () => {
		let rendered = unwrap(await mail.preview(emails.postingPublished, "es"));

		expect(rendered.html).toContain('lang="es"');
		expect(rendered.subject).not.toBe(
			unwrap(await mail.preview(emails.postingPublished, "en")).subject,
		);
	});
});
