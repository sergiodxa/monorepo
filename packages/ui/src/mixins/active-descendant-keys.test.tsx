// @vitest-environment happy-dom

/**
 * Tests for {@link "./active-descendant-keys"}: arrows choose among the options the host
 * controls while focus stays put, and Enter follows the chosen one, or the only fresh one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { activeDescendantKeys, chooseOption, chosenOption } from "./active-descendant-keys.js";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** Mounts a combobox over one option per href, inside a region that may be busy. */
function mount(hrefs: Array<string>, busy = false): HTMLInputElement {
	mounted = render(
		<div>
			<input
				role="combobox"
				aria-expanded="true"
				aria-controls="options"
				mix={[activeDescendantKeys()]}
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
		let fresh = mount(["/a"]);
		expect(press(fresh, "Enter")).toBe(true);
		mounted?.cleanup();

		let stale = mount(["/a"], true);
		expect(press(stale, "Enter")).toBe(false);
	});
});
