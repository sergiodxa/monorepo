// @vitest-environment happy-dom

/**
 * Tests the search dialog's kind tabs: the strip keeps a minimum height of its own, so a
 * results card capped to a short screen scrolls its rows instead of squeezing the tabs away.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { SearchTabs } from "~/resources/components/search-tabs";

describe("SearchTabs", () => {
	test("gives the scrolling strip a minimum block size", async () => {
		let template = document.createElement("template");
		template.innerHTML = await renderToString(
			<SearchTabs
				tabs={[{ kind: null, label: "All", count: 2, href: "/search?q=remix", current: true }]}
			/>,
		);
		let strip = template.content.querySelector('ul[aria-label="Narrow by kind"]');
		let rules = Array.from(strip?.classList ?? [], (name) => {
			return template.content.querySelector(`style[data-rmx-style="${name}"]`)?.textContent ?? "";
		}).join("\n");

		expect(rules).toContain("overflow-x");
		expect(rules).toContain("min-block-size");
	});
});
