/**
 * Tests the search dialog's kind tabs: the strip keeps a minimum height of its own, so a
 * results card capped to a short screen scrolls its rows instead of squeezing the tabs away.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { SearchTabs } from "~/resources/components/search-tabs";

/** The tabs the current test mounted, unmounted after it. */
let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

describe("SearchTabs", () => {
	test("keeps the scrolling strip's height when a column squeezes it", () => {
		let column = document.createElement("div");
		column.style.cssText = "display: flex; flex-direction: column; block-size: 4rem";
		document.body.appendChild(column);
		mounted = render(
			<SearchTabs
				tabs={[{ kind: null, label: "All", count: 2, href: "/search?q=remix", current: true }]}
			/>,
			{ container: column },
		);
		let card = document.createElement("div");
		card.style.blockSize = "40rem";
		column.appendChild(card);
		let strip = mounted.$('ul[aria-label="Narrow by kind"]');
		let tab = mounted.$("a");
		if (!strip || !tab) throw new Error("The tabs rendered no strip");

		expect(getComputedStyle(strip).overflowX).toBe("auto");
		expect(strip.getBoundingClientRect().height).toBeGreaterThanOrEqual(
			tab.getBoundingClientRect().height,
		);
	});
});
