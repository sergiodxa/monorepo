/**
 * Tests the search dialog body's no-results state in a browser: it says what found nothing,
 * points a kind filter at the kinds the same words reach, and offers the docs and `/search`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import type { SearchResults } from "~/app/services/search-results";

import { SearchFrameView } from "~/resources/views/search-frame";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** The dialog's state for `query` with nothing matched, and `elsewhere` as the other kinds. */
function noResults(
	query: string,
	elsewhere: Array<SearchResults.Tab> = [],
): SearchResults.Suggestions {
	return {
		state: "results",
		query,
		total: 0,
		listed: 0,
		items: [],
		seeAll: `/search?q=${encodeURIComponent(query)}`,
		kind: null,
		tabs: [],
		elsewhere,
	};
}

/** Every link's text and address inside the results card. */
function links(): Array<[string, string]> {
	return Array.from(mounted?.container.querySelectorAll("#site-search-results a") ?? []).map(
		(link) => [link.textContent ?? "", link.getAttribute("href") ?? ""],
	);
}

describe("SearchFrameView with no results", () => {
	test("says what found nothing, visibly, and offers the docs and the search page", () => {
		mounted = render(<SearchFrameView model={noResults("zzqxv")} />);

		let status = mounted.$('[role="status"]');
		expect(status?.textContent).toBe("No results for “zzqxv”");
		expect(status?.getBoundingClientRect().height).toBeGreaterThan(0);
		expect(links()).toEqual([
			["Browse the docs", "/docs"],
			["Open the search page", "/search?q=zzqxv"],
		]);
		expect(mounted.container.querySelector('[role="option"]')).toBeNull();
	});

	test("points at the kinds the words reach without their kind filter", () => {
		mounted = render(
			<SearchFrameView
				model={noResults("button kind:guides", [
					{
						kind: "ui",
						label: "UI",
						count: 3,
						href: "/search?q=button+kind%3Aui",
						current: false,
					},
				])}
			/>,
		);

		expect(links()[0]).toEqual(["UI (3)", "/search?q=button+kind%3Aui"]);
	});
});
