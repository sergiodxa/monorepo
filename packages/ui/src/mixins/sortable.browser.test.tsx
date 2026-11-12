/**
 * Tests for {@link sortable} on a plain list with no move forms: a drag places the item under
 * the pointer and reports where it landed, a listener can keep it in place, and Shift+Arrow
 * reorders from the keyboard and announces it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { sortable } from "./sortable.js";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.innerHTML = "";
});

/** Mounts one titled list of three focusable rows, with the marker and a live region. */
function mount(): HTMLElement {
	mounted = render(
		<section data-sortable style="inline-size: 320px">
			<span hidden mix={[sortable({ moved: "Moved within {list}" })]} />
			<span data-sortable-status role="status" />
			<div data-sortable-list="queue">
				<h2 data-sortable-title>Queue</h2>
				<ul data-sortable-items style="margin: 0; padding: 0; list-style: none">
					{["one", "two", "three"].map((id) => (
						<li data-sortable-item={id} style="block-size: 40px">
							<a href={`#${id}`}>{id}</a>
						</li>
					))}
				</ul>
			</div>
		</section>,
	);
	return document.querySelector<HTMLElement>("[data-sortable]")!;
}

/** The rows' values, in order. */
function order(root: HTMLElement): string[] {
	return [...root.querySelectorAll("[data-sortable-item]")].map((item) =>
		item.getAttribute("data-sortable-item")!,
	);
}

/** Fires a mouse pointer event of `type` at a point on `target`. */
function pointer(target: EventTarget, type: string, x: number, y: number) {
	target.dispatchEvent(
		new PointerEvent(type, {
			bubbles: true,
			cancelable: true,
			pointerId: 1,
			pointerType: "mouse",
			button: 0,
			clientX: x,
			clientY: y,
		}),
	);
}

/** Drags `item` to the top of `onto`, stepping past the drag threshold first. */
function dragAbove(item: Element, onto: Element) {
	let from = item.getBoundingClientRect();
	let to = onto.getBoundingClientRect();
	pointer(item, "pointerdown", from.left + 10, from.top + 10);
	pointer(document, "pointermove", from.left + 20, from.top + 20);
	pointer(document, "pointermove", to.left + 10, to.top + 4);
	pointer(document, "pointerup", to.left + 10, to.top + 4);
}

/** Waits for the island's listeners to attach. */
async function settle(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 50));
}

describe("sortable", () => {
	test("a drag places the item under the pointer and reports the item it landed before", async () => {
		let root = mount();
		await settle();
		let moves: string[] = [];
		root.addEventListener("ui:sortable-move", (event) =>
			moves.push(`${event.item}:${event.from}>${event.to}:${event.before}`),
		);

		dragAbove(
			root.querySelector('[data-sortable-item="three"]')!,
			root.querySelector('[data-sortable-item="one"]')!,
		);

		expect(order(root)).toEqual(["three", "one", "two"]);
		expect(moves).toEqual(["three:queue>queue:one"]);
	});

	test("a listener that prevents the move keeps the item where it started", async () => {
		let root = mount();
		await settle();
		root.addEventListener("ui:sortable-move", (event) => event.preventDefault());

		dragAbove(
			root.querySelector('[data-sortable-item="three"]')!,
			root.querySelector('[data-sortable-item="one"]')!,
		);

		expect(order(root)).toEqual(["one", "two", "three"]);
	});

	test("Shift+ArrowUp and Down reorder the focused item, keep its focus and announce it", async () => {
		let root = mount();
		await settle();
		let link = root.querySelector<HTMLElement>('[data-sortable-item="two"] a')!;
		let press = (key: string) =>
			link.dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey: true, bubbles: true }));
		link.focus();

		press("ArrowUp");
		expect(order(root)).toEqual(["two", "one", "three"]);
		press("ArrowDown");
		press("ArrowDown");
		expect(order(root)).toEqual(["one", "three", "two"]);
		expect(document.activeElement).toBe(link);
		expect(root.querySelector("[data-sortable-status]")!.textContent).toBe("Moved within Queue");
	});
});
