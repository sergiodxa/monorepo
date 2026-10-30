/**
 * Lays a component's composition tree out in a real browser at phone widths, in a column that
 * breaks long words as the docs column does: a description naming a long part wraps inside it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import CompositionTree from "~/resources/components/composition-tree";

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

describe("CompositionTree", () => {
	test.each(WIDTHS)("wraps every description inside a %ipx column", (width) => {
		let host = document.createElement("div");
		host.style.width = `${width}px`;
		host.style.overflowWrap = "break-word";
		document.body.appendChild(host);
		let { cleanup } = render(
			<CompositionTree
				host="NavigationMenu"
				parts={[
					{
						name: "NavigationMenu.Content",
						description:
							"Renders `NavigationMenu.ContentColumnGroupHeading` over a column of the panel a trigger opens.",
						props: { rows: [], inherits: [] },
					},
				]}
			/>,
			{ container: host },
		);
		cleanups.push(cleanup);

		expect(host.scrollWidth).toBeLessThanOrEqual(width);
		for (let item of host.querySelectorAll("li")) {
			expect(item.getBoundingClientRect().right).toBeLessThanOrEqual(
				host.getBoundingClientRect().right,
			);
		}
	});
});
