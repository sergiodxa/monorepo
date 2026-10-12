/**
 * Covers the drawer's motion, read from the stylesheet it emits: it enters
 * with the full slide from its edge and leaves on a shorter, gentler exit — a
 * fade with a small drift and blur rather than the whole slide back out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { durations } from "../animations/tokens.js";

import { Drawer } from "./drawer.js";

/** Renders a drawer docked to `placement` and returns its markup with whitespace collapsed. */
async function render(placement: Drawer.Placement): Promise<string> {
	let html = await renderToString(
		<Drawer id="cart" placement={placement}>
			Cart
		</Drawer>,
	);
	return html.replace(/\s+/g, " ");
}

describe("Drawer", () => {
	test("enters from fully off its edge and exits only a short drift toward it", async () => {
		let html = await render("right");

		expect(html).toContain("--ui-drawer-enter-offset: 100% 0");
		expect(html).toContain("--ui-drawer-exit-offset: 1rem 0");
		expect(html).toContain("translate: var(--ui-drawer-exit-offset)");
	});

	test("fades and blurs out on a clock shorter than its entry", async () => {
		let html = await render("bottom");

		expect(html).toContain("opacity: 0");
		expect(html).toContain("filter: blur(4px)");
		expect(html).toContain(`transition-duration: ${durations.fast}ms`);
		expect(html).toContain(`transition-duration: ${durations.slow}ms`);
	});
});
