/**
 * Holds the tab bar to its contract in a real browser: it sits fixed at the viewport's foot
 * while keeping its own height in the flow, disappears from its `hideFrom` width unless told
 * never to, marks the current item, caps a count at 99+, and keeps names for assistive tech
 * when the labels are hidden.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterAll, afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import type { TabBar as TabBarTypes } from "./tab-bar.js";

import { TabBar } from "./tab-bar.js";

import "../reset.css";
import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

afterAll(async () => {
	await page.viewport(414, 896);
});

/** Mounts a four-item bar after a block of content, and returns the bar's outer box. */
function mount(props: Partial<TabBarTypes.Props> = {}, count = 3): HTMLElement {
	mounted = render(
		<div style="--ui-brand-fg: rgb(200, 60, 30); --ui-neutral-fg-muted: rgb(110, 110, 110)">
			<div data-testid="content" style="block-size:200px" />
			<TabBar label="Primary" {...props}>
				<TabBar.Item href="#home" icon={<svg viewBox="0 0 24 24" />} label="Home" current />
				<TabBar.Item href="#search" icon={<svg viewBox="0 0 24 24" />} label="Search" />
				<TabBar.Item
					href="#alerts"
					icon={<svg viewBox="0 0 24 24" />}
					label="Alerts"
					count={count}
					countLabel={`${count} new`}
				/>
				<TabBar.Item href="#inbox" icon={<svg viewBox="0 0 24 24" />} label="Inbox" />
			</TabBar>
		</div>,
	);
	return mounted.container.querySelector<HTMLElement>('[data-slot="tab-bar"]')!;
}

describe("TabBar on a phone", () => {
	test("is fixed to the viewport's foot and reserves its own height in the flow", async () => {
		await page.viewport(375, 812);
		let outer = mount();
		let nav = outer.querySelector("nav")!;
		let bar = nav.getBoundingClientRect();

		expect(getComputedStyle(nav).position).toBe("fixed");
		expect(Math.round(bar.bottom)).toBe(812);
		expect(Math.round(bar.width)).toBe(375);
		expect(Math.round(outer.getBoundingClientRect().height)).toBe(Math.round(bar.height));
	});

	test("gives every item a target at least 44px square", async () => {
		await page.viewport(375, 812);
		let outer = mount();
		for (let item of outer.querySelectorAll<HTMLElement>('[data-slot="tab-bar-item"]')) {
			let box = item.getBoundingClientRect();
			expect(box.width).toBeGreaterThanOrEqual(44);
			expect(box.height).toBeGreaterThanOrEqual(44);
		}
	});

	test("marks the current item for assistive tech and in the brand colour", async () => {
		await page.viewport(375, 812);
		let outer = mount();
		let [home, search] = outer.querySelectorAll<HTMLElement>('[data-slot="tab-bar-item"]');

		expect(home?.getAttribute("aria-current")).toBe("page");
		expect(search?.hasAttribute("aria-current")).toBe(false);
		expect(getComputedStyle(home!).color).toBe("rgb(200, 60, 30)");
		expect(getComputedStyle(search!).color).toBe("rgb(110, 110, 110)");
	});

	test("caps a count at 99+ and reads what it means", async () => {
		await page.viewport(375, 812);
		let outer = mount({}, 140);
		let count = outer.querySelector('[data-slot="tab-bar-count"]')!;
		let alerts = outer.querySelectorAll('[data-slot="tab-bar-item"]')[2]!;

		expect(count.textContent).toBe("99+");
		expect(alerts.textContent).toContain("140 new");
	});

	test("hides the names from sight but not from assistive tech", async () => {
		await page.viewport(375, 812);
		let outer = mount({ showLabels: false });
		let label = outer.querySelector<HTMLElement>('[data-slot="tab-bar-label"]')!;

		expect(label.getBoundingClientRect().width).toBeLessThanOrEqual(1);
		expect(label.textContent).toBe("Home");
	});
});

describe("TabBar on a wider screen", () => {
	test("is gone from its hideFrom width, its height with it", async () => {
		await page.viewport(800, 800);
		let outer = mount({ hideFrom: "40rem" });

		expect(getComputedStyle(outer).display).toBe("none");
		expect(outer.getBoundingClientRect().height).toBe(0);
	});

	test("stays at every width with hideFrom never", async () => {
		await page.viewport(1280, 800);
		let outer = mount({ hideFrom: "never" });

		expect(getComputedStyle(outer).display).not.toBe("none");
		expect(outer.querySelector("nav")!.getBoundingClientRect().height).toBeGreaterThan(0);
	});
});
