/**
 * Holds the section bar to its contract in a real browser: it links each chip to its section,
 * sticks at its `top`, marks the first chip before any scroll, and once its island runs marks
 * the section under the bar as the page scrolls, down to the last one at the page's end.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { SectionBar } from "./section-bar.js";

import "../reset.css";
import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	window.scrollTo(0, 0);
});

/** The sections the bar links to. */
const ITEMS: SectionBar.Item[] = [
	{ id: "starters", label: "Starters", count: 3 },
	{ id: "mains", label: "Mains", count: 5 },
	{ id: "sides", label: "Sides" },
	{ id: "drinks", label: "Drinks", count: 2 },
];

/** Mounts the bar over four tall sections and returns its chips. */
function mount(): HTMLAnchorElement[] {
	mounted = render(
		<div>
			<SectionBar id="menu-bar" label="Menu categories" items={ITEMS} top="0px" />
			{ITEMS.map((item, index) => (
				<section id={item.id} style={`block-size:${index === 3 ? 120 : 700}px`}>
					<h2>{item.label}</h2>
				</section>
			))}
		</div>,
	);
	return [...mounted.container.querySelectorAll<HTMLAnchorElement>("a[data-section]")];
}

/** Waits until a check passes, for an island that answers a scroll on the next frame. */
async function until(check: () => boolean, timeout = 2000): Promise<void> {
	let start = performance.now();
	while (!check()) {
		if (performance.now() - start > timeout) throw new Error("timed out");
		await new Promise((resolve) => requestAnimationFrame(resolve));
	}
}

/** Which chip is marked current. */
function currentChip(links: HTMLAnchorElement[]): string | undefined {
	return links.find((link) => link.getAttribute("aria-current") === "true")?.dataset.section;
}

describe("SectionBar", () => {
	test("links every chip to its section and names its landmark", () => {
		let links = mount();
		expect(links.map((link) => link.getAttribute("href"))).toEqual([
			"#starters",
			"#mains",
			"#sides",
			"#drinks",
		]);
		let nav = mounted!.container.querySelector("nav")!;
		expect(nav.getAttribute("aria-label")).toBe("Menu categories");
		expect(links[1]!.textContent).toBe("Mains5");
	});

	test("marks the first chip before the page scrolls", () => {
		let links = mount();
		expect(currentChip(links)).toBe("starters");
	});

	test("sticks to the top while its sections scroll under it", async () => {
		mount();
		let nav = mounted!.container.querySelector("nav")!;
		window.scrollTo(0, 900);
		await until(() => Math.abs(nav.getBoundingClientRect().top) < 1);
		expect(getComputedStyle(nav).position).toBe("sticky");
	});

	test("follows the section under the bar, and the last one at the page's end", async () => {
		let links = mount();
		let mains = document.getElementById("mains")!;
		window.scrollTo(0, mains.offsetTop - 20);
		await until(() => currentChip(links) === "mains");
		window.scrollTo(0, document.documentElement.scrollHeight);
		await until(() => currentChip(links) === "drinks");
		expect(links.filter((link) => link.hasAttribute("aria-current"))).toHaveLength(1);
	});
});
