// @vitest-environment happy-dom

/**
 * Tests the search box's server markup: the input is named and hinted by the label its page
 * passes, so every page words the box for what it searches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { SearchBox } from "~/resources/components/search-box";

describe("SearchBox", () => {
	test("names the input and fills its placeholder from the label prop", async () => {
		let template = document.createElement("template");
		template.innerHTML = await renderToString(
			<SearchBox
				id="box"
				label="Search the glossary"
				query=""
				frameSrc="/frames/search"
				dialogId="dialog"
				optionCount={0}
				kind=""
				kinds={[]}
			/>,
		);
		let input = template.content.getElementById("box");

		expect(input?.getAttribute("aria-label")).toBe("Search the glossary");
		expect(input?.getAttribute("placeholder")).toBe("Search the glossary");
	});
});
