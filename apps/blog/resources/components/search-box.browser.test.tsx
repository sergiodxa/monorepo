/**
 * Tests the search box's server markup: the input is named and hinted by the label its page
 * passes, so every page words the box for what it searches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { SearchBox } from "~/resources/components/search-box";

/** The box the current test mounted, unmounted after it. */
let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

describe("SearchBox", () => {
	test("names the input and fills its placeholder from the label prop", () => {
		mounted = render(
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
		let input = mounted.$("#box");

		expect(input?.getAttribute("aria-label")).toBe("Search the glossary");
		expect(input?.getAttribute("placeholder")).toBe("Search the glossary");
	});
});
