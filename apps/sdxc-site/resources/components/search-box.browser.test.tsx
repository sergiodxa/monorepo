/**
 * Tests the search box: the first row starts chosen and every fresh list chooses its first row
 * again, arrows move the choice and Enter follows it, typing drops a stale choice, and the top
 * result's page prefetches once results settle in the open dialog.
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

/** Mounts the box over `count` result rows in an open dialog, each linking to `/docs/row-<n>`. */
function mountWithRows(count: number, kinds: Array<string> = []): HTMLInputElement {
	mounted = render(
		<dialog id="dialog" open>
			<SearchBox
				id="box"
				label="Search"
				query="remix"
				frameSrc="/frames/search"
				dialogId="dialog"
				optionCount={count}
				kind=""
				kinds={kinds}
			/>
			<div id={SEARCH_LISTBOX_ID} role="listbox">
				{Array.from({ length: count }, (_, index) => (
					<div key={index} id={`row-${index}`} role="option" aria-selected="false">
						<a href={`/docs/row-${index}`}>Row {index}</a>
					</div>
				))}
			</div>
		</dialog>,
	);
	return mounted.$("#box") as HTMLInputElement;
}

/** The id of the row the box has chosen, or `null` while none is. */
function chosen(box: HTMLInputElement): string | null {
	return box.getAttribute("aria-activedescendant");
}

/** Presses `key` in the box as a reader would. */
function press(box: HTMLInputElement, key: string): KeyboardEvent {
	let event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
	box.dispatchEvent(event);
	return event;
}

describe("SearchBox keyboard", () => {
	test("the first row starts chosen once the box hydrates", async () => {
		let box = mountWithRows(3);

		await expect.poll(() => chosen(box)).toBe("row-0");
		expect(mounted?.$("#row-0")?.getAttribute("aria-selected")).toBe("true");
	});

	test("arrows move the choice and Enter follows the chosen row", async () => {
		let box = mountWithRows(3);
		await expect.poll(() => chosen(box)).toBe("row-0");
		let followed: Array<string> = [];
		mounted?.$("#dialog")?.addEventListener("click", (event) => {
			let link = (event.target as Element).closest("a");
			if (link) followed.push(link.getAttribute("href") ?? "");
			event.preventDefault();
		});

		press(box, "ArrowDown");
		press(box, "ArrowDown");
		expect(chosen(box)).toBe("row-2");
		press(box, "ArrowUp");
		expect(chosen(box)).toBe("row-1");
		press(box, "Enter");

		expect(followed).toEqual(["/docs/row-1"]);
	});

	test("typing drops the choice until fresh rows settle with the first chosen", async () => {
		let box = mountWithRows(3);
		await expect.poll(() => chosen(box)).toBe("row-0");
		press(box, "ArrowDown");

		box.value = "remix router";
		box.dispatchEvent(new Event("input", { bubbles: true }));
		expect(chosen(box)).toBeNull();

		box.dispatchEvent(
			new LiveFrameEvent({ state: "settled", src: "/frames/search?q=remix+router" }),
		);
		expect(chosen(box)).toBe("row-0");
	});

	test("left and right stay with the caret while the first row is chosen for the reader", async () => {
		let box = mountWithRows(2, ["", "guide"]);
		await expect.poll(() => chosen(box)).toBe("row-0");

		expect(press(box, "ArrowRight").defaultPrevented).toBe(false);
		expect(press(box, "ArrowLeft").defaultPrevented).toBe(false);
		expect(chosen(box)).toBe("row-0");
	});
});
