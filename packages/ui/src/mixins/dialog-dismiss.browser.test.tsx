/**
 * Tests for {@link dialogDismiss} in a real browser: an open modal closes on a backdrop
 * press and on a plain link click, and stays open for a press inside its panel, a
 * modified click, or a link that opens a new tab.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { dialogDismiss } from "./dialog-dismiss.js";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.innerHTML = "";
});

/** Mounts a modal holding the mixin, a same-page link and a new-tab link, and opens it. */
function openSheet(): HTMLDialogElement {
	mounted = render(
		<dialog id="sheet" style="inline-size: 200px; block-size: 120px; margin: 100px">
			<nav>
				<span hidden mix={[dialogDismiss()]} />
				<a href="#pricing">Pricing</a>
				<a href="#docs" target="_blank">
					Docs
				</a>
				<p>Panel text</p>
			</nav>
		</dialog>,
	);
	let sheet = document.querySelector<HTMLDialogElement>("#sheet")!;
	sheet.showModal();
	return sheet;
}

/** Clicks `target` at the given viewport point with `init` merged in. */
function click(target: Element, init: MouseEventInit = {}) {
	target.dispatchEvent(
		new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init }),
	);
}

describe("dialogDismiss", () => {
	test("closes the dialog when a link in it is followed", () => {
		let sheet = openSheet();
		let link = sheet.querySelector<HTMLAnchorElement>('a[href="#pricing"]')!;
		link.addEventListener("click", (event) => event.preventDefault(), { once: true });
		click(link);
		expect(sheet.open).toBe(true);

		click(link);
		expect(sheet.open).toBe(false);
	});

	test("keeps the dialog open for a modified click or a new-tab link", () => {
		let sheet = openSheet();
		click(sheet.querySelector('a[href="#pricing"]')!, { metaKey: true });
		click(sheet.querySelector('a[target="_blank"]')!);
		expect(sheet.open).toBe(true);
	});

	test("closes on a backdrop press and stays open for a press inside the panel", () => {
		let sheet = openSheet();
		let box = sheet.getBoundingClientRect();
		click(sheet, { clientX: box.left + 10, clientY: box.top + 10 });
		expect(sheet.open).toBe(true);

		click(sheet, { clientX: box.left - 20, clientY: box.top - 20 });
		expect(sheet.open).toBe(false);
	});
});
