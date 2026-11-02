/**
 * Lays the docs pager out in a real browser: the whole card is the link, an absent side
 * draws nothing and a lone card fills the row, the section shows only on a
 * crossing, the arrow nudges on hover except under reduced motion, and 320px never overflows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";

import { DocsPager } from "./docs-pager.js";

const LABELS: DocsPager.Labels = { nav: "Pagination", previous: "Previous", next: "Next" };

const PREVIOUS: DocsPager.Entry = { title: "Install", href: "/docs/install", section: "Start" };

const NEXT: DocsPager.Entry = {
	title: "Route alerts to the person on call this week",
	href: "/docs/alerts",
	section: "Guides",
};

/** Mounts `node` in a host `width` pixels wide and returns the host. */
function mount(node: JSX.Element, width = 720): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	render(node, { container: host });
	return host;
}

/** The pager's cards, in source order. */
function cards(host: HTMLElement): HTMLAnchorElement[] {
	return [...host.querySelectorAll<HTMLAnchorElement>('[data-slot="docs-pager-card"]')];
}

beforeEach(async () => {
	await page.viewport(1024, 768);
});

afterEach(async () => {
	document.body.replaceChildren();
	await cdp().send("Emulation.setEmulatedMedia", { features: [] });
});

describe("DocsPager", () => {
	test("prefetches both neighbours only when asked", () => {
		let plain = mount(<DocsPager previous={PREVIOUS} next={NEXT} labels={LABELS} />);
		expect(cards(plain).every((card) => !card.hasAttribute("data-rmx-prefetch"))).toBe(true);
		plain.remove();

		let eager = mount(
			<DocsPager previous={PREVIOUS} next={NEXT} prefetch="viewport" labels={LABELS} />,
		);
		expect(cards(eager).map((card) => card.dataset.rmxPrefetch)).toEqual(["viewport", "viewport"]);
	});

	test("makes the whole card the link, corners included", () => {
		let host = mount(<DocsPager previous={PREVIOUS} next={NEXT} section="Start" labels={LABELS} />);

		for (let card of cards(host)) {
			let box = card.getBoundingClientRect();
			let corner = document.elementFromPoint(box.left + 3, box.bottom - 3);
			expect(corner?.closest("a")).toBe(card);
			let opposite = document.elementFromPoint(box.right - 3, box.top + 3);
			expect(opposite?.closest("a")).toBe(card);
		}
	});

	test("marks each card with its direction for link relations", () => {
		let host = mount(<DocsPager previous={PREVIOUS} next={NEXT} labels={LABELS} />);
		let [previous, next] = cards(host);

		expect(previous?.getAttribute("rel")).toBe("prev");
		expect(previous?.getAttribute("href")).toBe("/docs/install");
		expect(next?.getAttribute("rel")).toBe("next");
		expect(host.querySelector("nav")?.getAttribute("aria-label")).toBe("Pagination");
	});

	for (let [side, props] of [
		["previous", { previous: PREVIOUS, next: null }],
		["next", { previous: null, next: NEXT }],
	] as const) {
		test(`renders a lone ${side} card alone, filling the row with no empty column`, () => {
			let host = mount(<DocsPager {...props} labels={LABELS} />);
			let nav = host.querySelector("nav")!.getBoundingClientRect();
			let grid = host.querySelector("nav > div")!;

			expect(cards(host)).toHaveLength(1);
			expect(grid.children).toHaveLength(1);
			expect(getComputedStyle(grid).gridTemplateColumns.split(" ")).toHaveLength(1);
			expect(cards(host)[0]!.getBoundingClientRect().width).toBeCloseTo(nav.width, 0);
		});
	}

	test("renders nothing with neither neighbour", () => {
		let host = mount(<DocsPager labels={LABELS} />);
		expect(host.querySelector("nav")).toBeNull();
	});

	test("names the destination's section only when it differs from the current one", () => {
		let host = mount(<DocsPager previous={PREVIOUS} next={NEXT} section="Start" labels={LABELS} />);
		let [previous, next] = cards(host);

		expect(previous?.querySelector('[data-slot="docs-pager-section"]')).toBeNull();
		expect(next?.querySelector('[data-slot="docs-pager-section"]')?.textContent).toBe("Guides");
	});

	test("nudges the arrow toward the destination on hover", async () => {
		let host = mount(<DocsPager previous={PREVIOUS} next={NEXT} labels={LABELS} />);
		let [, next] = cards(host);
		let arrow = next!.querySelector<SVGElement>('[data-slot="docs-pager-arrow"]')!;

		expect(getComputedStyle(arrow).translate).toBe("none");
		await userEvent.hover(next!);
		await expect.poll(() => getComputedStyle(arrow).translate).toBe("2px");
	});

	test("keeps the arrow still on hover under reduced motion", async () => {
		await cdp().send("Emulation.setEmulatedMedia", {
			features: [{ name: "prefers-reduced-motion", value: "reduce" }],
		});
		let host = mount(<DocsPager previous={PREVIOUS} next={NEXT} labels={LABELS} />);
		let [, next] = cards(host);
		let arrow = next!.querySelector<SVGElement>('[data-slot="docs-pager-arrow"]')!;

		await userEvent.hover(next!);
		expect(getComputedStyle(arrow).translate).toBe("none");
	});

	test("stacks the cards at 320px without overflowing the page", async () => {
		await page.viewport(320, 640);
		let host = mount(<DocsPager previous={PREVIOUS} next={NEXT} labels={LABELS} />, 288);
		let [previous, next] = cards(host);

		expect(next!.getBoundingClientRect().top).toBeGreaterThanOrEqual(
			previous!.getBoundingClientRect().bottom,
		);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
	});
});
