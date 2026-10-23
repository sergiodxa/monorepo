/**
 * Tests for {@link Breadcrumbs.Link}: a segment carries `data-rmx-prefetch` only for
 * the runtime's modes, and `"render"` adds a `<link rel="prefetch">` after it instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { Breadcrumbs } from "./breadcrumbs.js";

describe("Breadcrumbs.Link", () => {
	test("leaves prefetching off unless a mode is chosen", async () => {
		let html = await renderToString(<Breadcrumbs.Link href="/projects">Projects</Breadcrumbs.Link>);
		let none = await renderToString(
			<Breadcrumbs.Link href="/projects" prefetch="none">
				Projects
			</Breadcrumbs.Link>,
		);

		expect(html).toMatch(/<a [^>]*href="\/projects"[^>]*>Projects<\/a>/);
		expect(html).not.toContain("data-rmx-prefetch");
		expect(none).not.toContain("data-rmx-prefetch");
		expect(html).not.toContain("<link");
		expect(none).not.toContain("<link");
	});

	test.each(["intent", "viewport"] as const)("prefetches on %s", async (prefetch) => {
		let html = await renderToString(
			<Breadcrumbs.Link href="/projects" prefetch={prefetch}>
				Projects
			</Breadcrumbs.Link>,
		);

		expect(html).toMatch(new RegExp(`<a [^>]*data-rmx-prefetch="${prefetch}"`));
		expect(html).not.toContain("<link");
	});

	test("renders a prefetch hint after the segment's anchor on render", async () => {
		let html = await renderToString(
			<Breadcrumbs.Item>
				<Breadcrumbs.Link href="/projects" prefetch="render">
					Projects
				</Breadcrumbs.Link>
			</Breadcrumbs.Item>,
		);

		expect(html).toMatch(/Projects<\/a><link rel="prefetch" href="\/projects"\s*\/?><\/li>/);
		expect(html).not.toContain("data-rmx-prefetch");
	});

	test("renders no prefetch hint without a destination", async () => {
		let html = await renderToString(
			<Breadcrumbs.Link prefetch="render">Projects</Breadcrumbs.Link>,
		);

		expect(html).not.toContain("<link");
	});
});
