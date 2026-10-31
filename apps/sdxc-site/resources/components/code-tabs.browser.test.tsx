/**
 * Tests the code-tab strip against the real layout engine: switching between a tall and a
 * one-line snippet leaves the strip's height where it was, and only the checked panel is
 * shown, with the other kept out of sight and out of the tab order.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import CodeTabs, { CodeTab } from "~/resources/components/code-tabs";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";

/** Forty lines, far taller than the one-line snippet beside it. */
const TALL_SNIPPET = Array.from({ length: 40 }, (_, line) => `line ${line + 1}`).join("\n");

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** Mounts a two-tab strip whose first panel is tall and whose second is one line. */
function mountStrip(): HTMLFormElement {
	mounted = render(
		<div id="column" style={{ inlineSize: "320px" }}>
			<CodeTabs>
				<CodeTab label="Tall" selected>
					<pre id="tall">{TALL_SNIPPET}</pre>
				</CodeTab>
				<CodeTab label="Short">
					<pre id="short">one line</pre>
				</CodeTab>
			</CodeTabs>
		</div>,
	);
	return mounted.$("form") as HTMLFormElement;
}

/** Checks the tab whose label reads `label`, as a reader's click would. */
function choose(form: HTMLFormElement, label: string): void {
	let tab = Array.from(form.querySelectorAll("label")).find((node) => node.textContent === label);
	tab?.click();
}

describe("CodeTabs", () => {
	test("keeps the strip's height whichever tab is checked", () => {
		let form = mountStrip();
		let tall = form.getBoundingClientRect().height;

		choose(form, "Short");
		let short = form.getBoundingClientRect().height;

		expect(short).toBe(tall);
	});

	test("shows only the checked panel", () => {
		let form = mountStrip();
		let tall = form.querySelector("#tall") as HTMLElement;
		let short = form.querySelector("#short") as HTMLElement;

		expect(tall.checkVisibility({ visibilityProperty: true })).toBe(true);
		expect(short.checkVisibility({ visibilityProperty: true })).toBe(false);

		choose(form, "Short");

		expect(tall.checkVisibility({ visibilityProperty: true })).toBe(false);
		expect(short.checkVisibility({ visibilityProperty: true })).toBe(true);
	});

	test("stretches the shorter panel's last block to the tallest panel's height", () => {
		let form = mountStrip();
		let tall = form.querySelector("#tall") as HTMLElement;
		let short = form.querySelector("#short") as HTMLElement;

		expect(short.getBoundingClientRect().height).toBe(tall.getBoundingClientRect().height);
	});
});
