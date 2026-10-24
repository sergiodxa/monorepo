/**
 * Tests for {@link "./active-descendant-keys"}: arrows choose among the options the host
 * controls while focus stays put, Enter follows the chosen one, or the only fresh one, and a
 * resting choice loads its destination ahead through the strategy the host asks for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { ActiveDescendantKeys } from "./active-descendant-keys.js";

/** Stands in for the runtime's frame prefetch, which needs an interceptable Navigation API. */
const PREFETCH = vi.fn();

vi.doMock("remix/component", async (importOriginal) => ({
	...(await importOriginal<typeof import("remix/component")>()),
	prefetch: PREFETCH,
}));

const { activeDescendantKeys, chooseOption, chosenOption, prefetchOption } =
	await import("./active-descendant-keys.js");

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	PREFETCH.mockClear();
	vi.useRealTimers();
	Reflect.deleteProperty(navigator, "connection");
	for (let hint of document.head.querySelectorAll('link[rel="prefetch"]')) hint.remove();
});

/** Mounts a combobox over one option per href, inside a region that may be busy. */
function mount(
	hrefs: Array<string>,
	busy = false,
	options?: ActiveDescendantKeys.Options,
): HTMLInputElement {
	mounted = render(
		<div>
			<input
				role="combobox"
				aria-expanded="true"
				aria-controls="options"
				mix={[activeDescendantKeys(options)]}
			/>
			<div aria-busy={busy ? "true" : undefined}>
				<div id="options" role="listbox">
					{hrefs.map((href, index) => (
						<div key={href} id={`option-${index}`} role="option" aria-selected="false">
							<a href={href}>{href}</a>
						</div>
					))}
				</div>
			</div>
		</div>,
	);
	return mounted.$("input") as HTMLInputElement;
}

/** Presses `key` in `box`, returning whether the mixin took it. */
function press(box: HTMLInputElement, key: string): boolean {
	let event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
	box.dispatchEvent(event);
	return event.defaultPrevented;
}

describe(activeDescendantKeys.name, () => {
	test("Down chooses the first option and wraps around from the last", () => {
		let box = mount(["/a", "/b"]);

		press(box, "ArrowDown");
		expect(box.getAttribute("aria-activedescendant")).toBe("option-0");
		expect(mounted?.$("#option-0")?.getAttribute("aria-selected")).toBe("true");

		press(box, "ArrowDown");
		press(box, "ArrowDown");
		expect(chosenOption(box)).toBe(0);
	});

	test("Up from the first option hands the choice back to the box", () => {
		let box = mount(["/a", "/b"]);

		press(box, "ArrowDown");
		press(box, "ArrowUp");

		expect(box.hasAttribute("aria-activedescendant")).toBe(false);
		expect(press(box, "ArrowUp")).toBe(false);
	});

	test("Enter follows the chosen option's link", () => {
		let box = mount(["/a", "/b"]);
		let click = vi.fn((event: Event) => event.preventDefault());
		mounted?.$('a[href="/b"]')?.addEventListener("click", click);

		chooseOption(box, 1);
		expect(press(box, "Enter")).toBe(true);
		expect(click).toHaveBeenCalledOnce();
	});

	test("Enter follows a sole option only while its results are not busy", () => {
		let click = vi.fn((event: Event) => event.preventDefault());
		let fresh = mount(["/a"]);
		mounted?.$('a[href="/a"]')?.addEventListener("click", click);
		expect(press(fresh, "Enter")).toBe(true);
		expect(click).toHaveBeenCalledOnce();
		mounted?.cleanup();

		let stale = mount(["/a"], true);
		mounted?.$('a[href="/a"]')?.addEventListener("click", click);
		expect(press(stale, "Enter")).toBe(false);
		expect(click).toHaveBeenCalledOnce();
	});
});

describe("prefetching", () => {
	test("loads the option the arrows rest on, once they rest 100ms", () => {
		vi.useFakeTimers();
		let box = mount(["/rest-a", "/rest-b"], false, { prefetch: "frame" });

		press(box, "ArrowDown");
		vi.advanceTimersByTime(50);
		press(box, "ArrowDown");
		vi.advanceTimersByTime(99);
		expect(PREFETCH).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(PREFETCH).toHaveBeenCalledExactlyOnceWith(`${location.origin}/rest-b`, undefined);
	});

	test("loads nothing without a strategy", () => {
		vi.useFakeTimers();
		let box = mount(["/none-a"]);

		press(box, "ArrowDown");
		vi.advanceTimersByTime(200);

		expect(PREFETCH).not.toHaveBeenCalled();
	});

	test("loads a destination once while it stays fresh", () => {
		let box = mount(["/once-a"]);

		prefetchOption(box, 0, "frame");
		prefetchOption(box, 0, "frame");

		expect(PREFETCH).toHaveBeenCalledOnce();
	});

	test("skips a reader saving data or on 2G", () => {
		let box = mount(["/slow-a", "/slow-b"]);

		Object.defineProperty(navigator, "connection", {
			value: { saveData: true },
			configurable: true,
		});
		prefetchOption(box, 0, "frame");
		Object.defineProperty(navigator, "connection", {
			value: { effectiveType: "2g" },
			configurable: true,
		});
		prefetchOption(box, 1, "frame");

		expect(PREFETCH).not.toHaveBeenCalled();
	});

	test("the document strategy adds one prefetch hint per destination", () => {
		let box = mount(["/doc-a"]);

		prefetchOption(box, 0, "document");
		prefetchOption(box, 0, "document");

		let hints = document.head.querySelectorAll<HTMLLinkElement>('link[rel="prefetch"]');
		expect(Array.from(hints, (hint) => hint.href)).toEqual([`${location.origin}/doc-a`]);
		expect(PREFETCH).not.toHaveBeenCalled();
	});

	test("skips another origin and the page already showing", () => {
		let box = mount(["https://elsewhere.com/x", `${location.pathname}${location.search}`]);

		prefetchOption(box, 0, "document");
		prefetchOption(box, 1, "frame");

		expect(document.head.querySelector('link[rel="prefetch"]')).toBeNull();
		expect(PREFETCH).not.toHaveBeenCalled();
	});
});
