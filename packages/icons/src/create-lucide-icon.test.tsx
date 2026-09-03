/**
 * Tests for the shared Lucide icon factory, covering the default `<svg>`
 * attributes, size/color/strokeWidth overrides, and the `aria-hidden` fallback.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import { createLucideIcon } from "./create-lucide-icon.js";

let HeartIcon = createLucideIcon("heart", [
	[
		"path",
		{
			d: "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z",
		},
	],
]);

describe(HeartIcon.name, () => {
	test("renders an svg with Lucide's default attributes", async () => {
		let html = await renderToString(<HeartIcon />);

		expect(html).toContain("<svg");
		expect(html).toContain('viewBox="0 0 24 24"');
		expect(html).toContain('width="24"');
		expect(html).toContain('stroke="currentColor"');
		expect(html).toContain('stroke-width="2"');
		expect(html).toContain('class="lucide lucide-heart"');
		expect(html).toContain('aria-hidden="true"');
		expect(html).toContain("<path");
	});

	test("overrides size, color, and strokeWidth via props", async () => {
		let html = await renderToString(<HeartIcon size={16} color="red" strokeWidth={1} />);

		expect(html).toContain('width="16"');
		expect(html).toContain('height="16"');
		expect(html).toContain('stroke="red"');
		expect(html).toContain('stroke-width="1"');
	});

	test("scales strokeWidth against size when absoluteStrokeWidth is set", async () => {
		let html = await renderToString(<HeartIcon size={12} strokeWidth={2} absoluteStrokeWidth />);

		expect(html).toContain('stroke-width="4"');
	});

	test("drops aria-hidden when an accessible name is provided", async () => {
		let html = await renderToString(<HeartIcon aria-label="Favorite" />);

		expect(html).not.toContain("aria-hidden");
		expect(html).toContain('aria-label="Favorite"');
	});

	test("merges a custom className with the lucide classes", async () => {
		let html = await renderToString(<HeartIcon className="text-red-500" />);

		expect(html).toContain('class="lucide lucide-heart text-red-500"');
	});
});
