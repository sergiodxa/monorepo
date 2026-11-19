/**
 * Holds the variant picker to its contract in a real browser: every option is a link that
 * carries the picker's frame target, the chosen one is `aria-current`, and an unavailable
 * option still links while reading as struck through.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { VariantPicker } from "./variant-picker.js";

import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** Mounts a picker with a colour axis, a size axis and a format axis. */
function mount(target?: string): HTMLElement {
	mounted = render(
		<VariantPicker target={target}>
			<VariantPicker.Axis label="Frame" value="Oak" aside={<a href="/frames">About frames</a>}>
				<VariantPicker.Swatch href="?frame=oak" name="Oak" color="#b58a5a" selected />
				<VariantPicker.Swatch
					href="?frame=black"
					name="Black"
					color="#111"
					unavailable
					unavailableLabel="sold out"
				/>
			</VariantPicker.Axis>
			<VariantPicker.Axis label="Size">
				<VariantPicker.Choice href="?size=a3" label="A3" />
				<VariantPicker.Choice href="?size=a2" label="A2" selected />
			</VariantPicker.Axis>
			<VariantPicker.Axis label="Format">
				<VariantPicker.Choice
					variant="card"
					href="?format=print"
					label="Print"
					detail="$45"
					unavailable
					unavailableLabel="sold out"
				/>
			</VariantPicker.Axis>
		</VariantPicker>,
	);
	return mounted.container.querySelector<HTMLElement>('[data-slot="variant-picker"]')!;
}

describe("VariantPicker", () => {
	test("names each group by its label and marks the chosen option current", () => {
		let picker = mount();
		let groups = picker.querySelectorAll('[role="group"]');
		expect(groups).toHaveLength(3);
		let labelId = groups[0]!.getAttribute("aria-labelledby")!;
		expect(document.getElementById(labelId)!.textContent).toBe("Frame: Oak");
		let current = [...picker.querySelectorAll('[aria-current="true"]')].map((link) =>
			link.getAttribute("href"),
		);
		expect(current).toEqual(["?frame=oak", "?size=a2"]);
	});

	test("puts the picker's target on every option link, keeping scroll and history", () => {
		let picker = mount("product");
		let options = picker.querySelectorAll(
			'[data-slot="variant-picker-swatch"], [data-slot="variant-picker-choice"]',
		);
		expect(options).toHaveLength(5);
		for (let option of options) {
			expect(option.tagName).toBe("A");
			expect(option.getAttribute("data-rmx-target")).toBe("product");
			expect(option.getAttribute("data-rmx-reset-scroll")).toBe("false");
			expect(option.getAttribute("data-rmx-history")).toBe("replace");
		}
	});

	test("leaves the target off without one", () => {
		let picker = mount();
		expect(
			picker.querySelector("[data-rmx-target], [data-rmx-reset-scroll], [data-rmx-history]"),
		).toBeNull();
	});

	test("keeps an unavailable option a link, named as such and struck through", () => {
		let picker = mount();
		let black = picker.querySelector<HTMLAnchorElement>('a[href="?frame=black"]')!;
		expect(black.getAttribute("aria-label")).toBe("Black, sold out");
		expect(black.getBoundingClientRect().width).toBeCloseTo(36, 0);
		let print = picker.querySelector<HTMLAnchorElement>('a[href="?format=print"]')!;
		expect(print.textContent).toBe("Print, sold out$45");
		let label = print.querySelector('[data-slot="variant-picker-choice-label"]')!;
		expect(getComputedStyle(label).textDecorationLine).toBe("line-through");
		expect(print.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
	});

	test("rings a chosen pill after a chosen card, whatever order their rules were first used in", () => {
		mounted = render(
			<VariantPicker>
				<VariantPicker.Axis label="Format">
					<VariantPicker.Choice variant="card" href="?format=framed" label="Framed" selected />
				</VariantPicker.Axis>
				<VariantPicker.Axis label="Size">
					<VariantPicker.Choice href="?size=a4" label="A4" />
					<VariantPicker.Choice href="?size=a3" label="A3" selected />
				</VariantPicker.Axis>
			</VariantPicker>,
		);
		let [plain, chosen] = [
			...mounted.container.querySelectorAll<HTMLElement>(
				'[data-slot="variant-picker-choice"]:not([data-variant="card"])',
			),
		];
		mounted.container.setAttribute(
			"style",
			"--ui-neutral-border: rgb(200, 200, 200); --ui-neutral-border-strong: rgb(120, 120, 120); --ui-neutral-fg-emphasis: rgb(0, 0, 255)",
		);
		expect(getComputedStyle(chosen!).boxShadow).toContain("rgb(0, 0, 255)");
		expect(getComputedStyle(plain!).boxShadow).toContain("rgb(200, 200, 200)");
	});
});
