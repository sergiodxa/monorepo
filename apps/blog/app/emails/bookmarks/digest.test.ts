/**
 * The bookmarks digest, rendered through the site's email registry: the count leads the
 * subject and each flag reads as what the check saw.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import emails from "~/app/emails";
import { mail } from "~/app/initializers/mail";

describe("bookmarks digest email", () => {
	test("counts the flags and says what the check found for each", async () => {
		let rendered = unwrap(
			await mail.render(emails.bookmarks.digest, {
				props: {
					items: [
						{
							title: "Gone",
							url: "https://example.com/gone",
							flag: "gone",
							httpStatus: null,
							finalUrl: null,
							editUrl: "https://sergiodxa.com/cms/bookmarks/1/edit",
						},
						{
							title: "Moved",
							url: "https://example.com/old",
							flag: "moved",
							httpStatus: 200,
							finalUrl: "https://example.com/new",
							editUrl: "https://sergiodxa.com/cms/bookmarks/2/edit",
						},
					],
				},
			}),
		);

		expect(rendered.subject).toBe("[Bookmarks] 2 to review");
		expect(rendered.text).toContain("Gone (no answer)");
		expect(rendered.text).toContain("Moved to https://example.com/new");
	});
});
