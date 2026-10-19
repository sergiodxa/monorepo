/**
 * The notification email, rendered through the app's email registry: the count leads the
 * subject and the feed names reach the body, in the reader's language.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import emails from "~/app/emails";
import { mail } from "~/app/initializers/mail";

/** A summary of three posts from two feeds, with a signed way out. */
const PROPS = {
	posts: 3,
	feeds: 2,
	titles: ["Example Weekly", "Another Blog"],
	url: "https://reader.example.com/reading",
	unsubscribeUrl: "https://reader.example.com/notifications/unsubscribe/token",
};

describe("notification email", () => {
	test("leads with the count and names the feeds", async () => {
		let rendered = unwrap(await mail.render(emails.notification, { props: PROPS }));

		expect(rendered.subject).toBe("3 new posts");
		expect(rendered.text).toContain("Example Weekly, Another Blog");
		expect(rendered.text).toContain(PROPS.unsubscribeUrl);
	});

	test("writes in the language it is rendered in", async () => {
		let rendered = unwrap(await mail.render(emails.notification, { locale: "es", props: PROPS }));

		expect(rendered.html).toContain('lang="es"');
		expect(rendered.subject).not.toBe("3 new posts");
	});
});
