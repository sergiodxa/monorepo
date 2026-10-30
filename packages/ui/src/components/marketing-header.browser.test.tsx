/**
 * Lays the {@link MarketingHeader} chapter variants out in a real browser: a split header
 * puts its lead beside the title on the title's last line and stacks on a phone, a
 * statement mutes the title around its claim, and an action sits at the row's end.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { MarketingHeader } from "./marketing-header.js";

/** Mounts `node` in a host `width` pixels wide, with the heading ink set, and returns the host. */
function mount(node: JSX.Element, width: number): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	host.style.setProperty("--ui-neutral-fg-emphasis", "rgb(17, 17, 17)");
	document.body.appendChild(host);
	render(node, { container: host });
	return host;
}

/** The element matching `selector` inside `root`, failing the test when it is missing. */
function find(root: Element, selector: string): HTMLElement {
	let element = root.querySelector<HTMLElement>(selector);
	if (!element) throw new Error(`missing ${selector}`);
	return element;
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("MarketingHeader split", () => {
	/** A split header with an eyebrow, a two-line title and a short lead. */
	function split(width: number): HTMLElement {
		return mount(
			<MarketingHeader layout="split" eyebrow="Observability" description="Every request, traced.">
				Know what your functions did, and why
			</MarketingHeader>,
			width,
		);
	}

	test("puts the lead beside the title, on the title's last line, at 1024px", () => {
		let host = split(1024);
		let title = find(host, "h2, h1, h3");
		let lead = find(host, "p");

		expect(lead.getBoundingClientRect().left).toBeGreaterThan(title.getBoundingClientRect().right);
		expect(
			Math.abs(lead.getBoundingClientRect().bottom - title.getBoundingClientRect().bottom),
		).toBeLessThan(16);
		expect(
			find(host, '[data-slot="eyebrow"], span').getBoundingClientRect().bottom,
		).toBeLessThanOrEqual(title.getBoundingClientRect().top);
	});

	test("stacks the lead under the title on a phone", () => {
		let host = split(375);
		let title = find(host, "h2, h1, h3");
		let lead = find(host, "p");

		expect(lead.getBoundingClientRect().top).toBeGreaterThanOrEqual(
			title.getBoundingClientRect().bottom,
		);
		expect(host.scrollWidth).toBeLessThanOrEqual(375);
	});
});

describe("MarketingHeader statement and subtitle", () => {
	test("mutes the title around its strong claim and sets the subtitle at title size", () => {
		let host = mount(
			<MarketingHeader tone="statement" subtitle="The rest, in grey.">
				<strong>Linear is built for speed.</strong> Every interaction under 50ms.
			</MarketingHeader>,
			1024,
		);
		let statement = find(host, '[data-slot="marketing-header-statement"]');
		let subtitle = find(host, '[data-slot="marketing-header-subtitle"]');
		let heading = statement.parentElement!;

		expect(getComputedStyle(find(statement, "strong")).color).toBe("rgb(17, 17, 17)");
		expect(getComputedStyle(statement).color).not.toBe("rgb(17, 17, 17)");
		expect(getComputedStyle(subtitle).fontSize).toBe(getComputedStyle(heading).fontSize);
		expect(getComputedStyle(subtitle).display).toBe("block");
	});
});

describe("MarketingHeader action", () => {
	test("sets the action at the row's end on the title's last line, and wraps it under on a phone", () => {
		let wide = mount(
			<MarketingHeader action={<a href="/courses">See all</a>}>Flagship training</MarketingHeader>,
			1024,
		);
		let action = find(wide, '[data-slot="marketing-header-action"]');
		let title = find(wide, "h2, h1, h3");

		expect(Math.round(action.getBoundingClientRect().right)).toBe(
			Math.round(wide.getBoundingClientRect().right),
		);
		expect(
			Math.abs(action.getBoundingClientRect().bottom - title.getBoundingClientRect().bottom),
		).toBeLessThan(2);

		document.body.replaceChildren();
		let narrow = mount(
			<MarketingHeader action={<a href="/courses">See all of the courses</a>}>
				Flagship training for every team
			</MarketingHeader>,
			320,
		);
		expect(
			find(narrow, '[data-slot="marketing-header-action"]').getBoundingClientRect().top,
		).toBeGreaterThanOrEqual(find(narrow, "h2, h1, h3").getBoundingClientRect().bottom);
	});
});
