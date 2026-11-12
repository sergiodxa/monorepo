/**
 * Drives the live demos on the `sortable()` and `invokerFields()` pages in a real browser, so a
 * demo whose markup drifts from the mixin's contract fails here rather than on the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import invokerFields from "~/resources/components/previews/mixins-invoker-fields";
import sortable from "~/resources/components/previews/mixins-sortable";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

/** Mounts a demo and waits for its island's listeners to attach. */
async function mount(node: ReturnType<typeof sortable.render>): Promise<HTMLElement> {
	let mounted = render(node);
	cleanup = () => mounted.cleanup();
	await new Promise((resolve) => setTimeout(resolve, 50));
	return mounted.container;
}

describe("mixin demos", () => {
	test("the sortable() demo reorders a task from the keyboard and moves it across lists", async () => {
		let root = await mount(sortable.render());
		let order = (list: string) =>
			[...root.querySelectorAll(`[data-sortable-list="${list}"] [data-sortable-item]`)].map(
				(item) => item.getAttribute("data-sortable-item"),
			);
		let task = root.querySelector<HTMLElement>('[data-sortable-item="Record the demo"] a')!;
		let press = (key: string) =>
			task.dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey: true, bubbles: true }));
		task.focus();

		press("ArrowUp");
		expect(order("next")[0]).toBe("Record the demo");
		press("ArrowRight");
		expect(order("done")[0]).toBe("Record the demo");
		expect(root.querySelector("[data-sortable-status]")!.textContent).toBe("Moved to Done");
	});

	test("the invokerFields() demo opens its dialog with the button's type chosen", async () => {
		let root = await mount(invokerFields.render());
		let dialog = root.querySelector<HTMLDialogElement>("dialog")!;
		let type = dialog.querySelector<HTMLSelectElement>('select[name="type"]')!;

		root.querySelector<HTMLButtonElement>('button[value="bug"]')!.click();
		expect(dialog.open).toBe(true);
		expect(type.value).toBe("bug");
		dialog.close();
	});
});
