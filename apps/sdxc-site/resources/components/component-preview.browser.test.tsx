/**
 * Lays a component preview out in a real browser at phone widths: a demo wider than the
 * surface starts at its left edge and scrolls inside it, and a positioned part of the demo,
 * like a button's enlarged hit area, stays inside the surface rather than widening the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import ComponentPreview from "~/resources/components/component-preview";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";

/** Column widths of a docs page on a 320px to 414px phone, inside its 20px gutters. */
const WIDTHS = [280, 335, 374];

let cleanups: Array<() => void> = [];

afterEach(() => {
	for (let cleanup of cleanups) cleanup();
	cleanups = [];
	document.body.replaceChildren();
});

describe("ComponentPreview", () => {
	test.each(WIDTHS)("keeps a demo wider than a %ipx column inside its surface", (width) => {
		let host = document.createElement("div");
		host.style.width = `${width}px`;
		document.body.appendChild(host);
		let { cleanup } = render(
			<ComponentPreview>
				<div data-demo style={{ display: "flex", inlineSize: "24rem", flex: "none" }}>
					<span style={{ position: "absolute", insetInlineStart: "23rem", inlineSize: "4rem" }} />
				</div>
			</ComponentPreview>,
			{ container: host },
		);
		cleanups.push(cleanup);

		let demo = host.querySelector("[data-demo]")!.getBoundingClientRect();

		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
		expect(host.scrollWidth).toBeLessThanOrEqual(width);
		expect(demo.left).toBeGreaterThanOrEqual(host.getBoundingClientRect().left);
	});
});
