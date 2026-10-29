/**
 * Tests the search box's prefetching: once results settle in the open dialog the top result's
 * page loads through the runtime's frame prefetch, and results in a closed dialog load nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

/** Stands in for the runtime's frame prefetch, which needs an interceptable Navigation API. */
const PREFETCH = vi.fn();

vi.doMock("remix/component", async (importOriginal) => ({
	...(await importOriginal<typeof import("remix/component")>()),
	prefetch: PREFETCH,
}));

const { SEARCH_LISTBOX_ID, SearchBox } = await import("~/resources/components/search-box");
const { LiveFrameEvent } = await import("@sdxc/ui/mixins");

let mounted: RenderResult | undefined;

beforeAll(() => {});

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	PREFETCH.mockClear();
});

/** Mounts the box for a query beside one result row linking to `href`, in a dialog that may be open. */
function mountWithResult(href: string, open: boolean): HTMLInputElement {
	mounted = render(
		<dialog id="dialog" open={open}>
			<SearchBox
				id="box"
				label="Search"
				query="remix"
				frameSrc="/frames/search"
				dialogId="dialog"
				optionCount={1}
				kind=""
				kinds={[]}
			/>
			<div id={SEARCH_LISTBOX_ID} role="listbox">
				<div id="row-0" role="option" aria-selected="false">
					<a href={href}>Top</a>
				</div>
			</div>
		</dialog>,
	);
	return mounted.$("#box") as HTMLInputElement;
}

describe("SearchBox", () => {
	test("settled results prefetch the top result while the dialog is open", () => {
		let box = mountWithResult("/docs/open-top", true);

		box.dispatchEvent(new LiveFrameEvent({ state: "settled", src: "/frames/search?q=remix" }));

		expect(PREFETCH).toHaveBeenCalledExactlyOnceWith(`${location.origin}/docs/open-top`, undefined);
	});

	test("settled results prefetch nothing in a closed dialog", () => {
		let box = mountWithResult("/docs/closed-top", false);

		box.dispatchEvent(new LiveFrameEvent({ state: "settled", src: "/frames/search?q=remix" }));

		expect(PREFETCH).not.toHaveBeenCalled();
	});
});
