/**
 * Tests for {@link Highlight} in a real browser: a match's tint stays inside its own
 * glyphs, so it never paints over the letter before or after it, and it is strong enough
 * to see against the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { Highlight } from "./highlight.js";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.innerHTML = "";
});

describe("Highlight", () => {
	test("keeps the mark clear of the text either side of it", () => {
		mounted = render(
			<p style="font-size: 32px; margin: 0">
				<Highlight
					segments={[
						{ text: "webhooks", match: false },
						{ text: "alert", match: true },
						{ text: "s", match: false },
					]}
				/>
			</p>,
		);
		let mark = document.querySelector("mark")!;
		let before = mark.previousSibling!;
		let range = document.createRange();
		range.selectNodeContents(before);
		let beforeBox = range.getBoundingClientRect();
		expect(mark.getBoundingClientRect().left).toBeGreaterThanOrEqual(beforeBox.right - 0.5);
	});

	test("tints the mark visibly", () => {
		mounted = render(
			<div style="--ui-brand-fg: rgb(37 99 235)">
				<Highlight segments={[{ text: "alert", match: true }]} />
			</div>,
		);
		let tint = getComputedStyle(document.querySelector("mark")!).backgroundColor;
		let alpha = Number(/[\d.]+(?=\)$)/.exec(tint)?.[0] ?? 1);
		expect(tint).not.toBe("rgba(0, 0, 0, 0)");
		expect(alpha).toBeGreaterThanOrEqual(0.15);
	});
});
