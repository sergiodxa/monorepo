/**
 * Tests for {@link Link}: the anchor carries `data-rmx-prefetch` only for the
 * runtime's modes, and `"render"` adds a `<link rel="prefetch">` after it instead.
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
		expect(html).not.toContain("<link");
		expect(none).not.toContain("<link");
	});

	test.each(["intent", "viewport"] as const)("prefetches on %s", async (prefetch) => {
		let html = await renderToString(
			<Link href="/about" prefetch={prefetch}>
				About
			</Link>,
		);

		expect(html).toMatch(new RegExp(`<a [^>]*data-rmx-prefetch="${prefetch}"`));
		expect(html).not.toContain("<link");
	});

	test("renders a prefetch hint after the anchor on render", async () => {
		let html = await renderToString(
			<Link href="/about" prefetch="render">
				About
			</Link>,
		);

		expect(html).toMatch(/About<\/a><link rel="prefetch" href="\/about"/);
		expect(html).not.toContain("data-rmx-prefetch");
	});

	test("renders no prefetch hint without a destination", async () => {
		let html = await renderToString(<Link prefetch="render">About</Link>);

		expect(html).not.toContain("<link");
	});
});
