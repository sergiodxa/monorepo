/**
 * Tests for {@link Link}: the anchor carries `data-rmx-prefetch` only when a
 * prefetch mode other than `"none"` is chosen, so links stay inert by default.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { Link } from "./link.js";

describe(Link.name, () => {
	test("leaves prefetching off unless a mode is chosen", async () => {
		let html = await renderToString(<Link href="/about">About</Link>);
		let none = await renderToString(
			<Link href="/about" prefetch="none">
				About
			</Link>,
		);

		expect(html).toMatch(/<a [^>]*href="\/about"[^>]*>About<\/a>/);
		expect(html).not.toContain("data-rmx-prefetch");
		expect(none).not.toContain("data-rmx-prefetch");
	});

	test.each(["intent", "viewport"] as const)("prefetches on %s", async (prefetch) => {
		let html = await renderToString(
			<Link href="/about" prefetch={prefetch}>
				About
			</Link>,
		);

		expect(html).toMatch(new RegExp(`<a [^>]*data-rmx-prefetch="${prefetch}"`));
	});
});
