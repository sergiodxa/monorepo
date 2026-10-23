/**
 * Tests for {@link LinkButton}: its children still render inside the anchor, a glyph at
 * either edge of a label is marked so that side's padding drops a step, and the anchor
 * carries an inset-free pointer target box.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { LinkButton } from "./link-button.js";

describe(LinkButton.name, () => {
	test("renders its label inside the anchor", async () => {
		let html = await renderToString(<LinkButton href="/new">Create</LinkButton>);

		expect(html).toMatch(/<a [^>]*href="\/new"[^>]*>Create<\/a>/);
	});

	test("marks a leading glyph and leaves the trailing edge alone", async () => {
		let html = await renderToString(
			<LinkButton href="/new">
				<svg />
				Create
			</LinkButton>,
		);

		expect(html).toMatch(/<a [^>]*data-glyph-start/);
		expect(html).not.toMatch(/<a [^>]*data-glyph-end/);
	});

	test("marks a trailing glyph after a label", async () => {
		let html = await renderToString(
			<LinkButton href="/next">
				Next
				<svg />
			</LinkButton>,
		);

		expect(html).toMatch(/<a [^>]*data-glyph-end/);
		expect(html).not.toMatch(/<a [^>]*data-glyph-start/);
	});

	test("draws a target-size box that holds however the anchor is positioned", async () => {
		let html = await renderToString(<LinkButton href="/new">Create</LinkButton>);

		expect(html).toMatch(
			/&::after \{[^}]*position: absolute;[^}]*inline-size: var\(--ui-target-size, 1\.5rem\);/,
		);
	});

	test("leaves prefetching off unless a mode is chosen", async () => {
		let html = await renderToString(<LinkButton href="/new">Create</LinkButton>);
		let none = await renderToString(
			<LinkButton href="/new" prefetch="none">
				Create
			</LinkButton>,
		);

		expect(html).not.toContain("data-rmx-prefetch");
		expect(none).not.toContain("data-rmx-prefetch");
	});

	test.each(["intent", "viewport"] as const)("prefetches on %s", async (prefetch) => {
		let html = await renderToString(
			<LinkButton href="/new" prefetch={prefetch}>
				Create
			</LinkButton>,
		);

		expect(html).toMatch(new RegExp(`<a [^>]*data-rmx-prefetch="${prefetch}"`));
	});
});
