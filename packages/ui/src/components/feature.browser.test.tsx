/**
 * Lays the {@link Feature.Grid} variants out in a real browser: a `list` grid drops the
 * card chrome and sets each icon beside its copy, and a cell's `span` widens it across
 * tracks on a wide grid while a phone keeps one column.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { Feature } from "./feature.js";

/** Mounts `node` in a host `width` pixels wide and returns the host. */
function mount(node: JSX.Element, width: number): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	render(node, { container: host });
	return host;
}

/** A claim cell with an icon, a title and a description. */
function claim(title: string, span?: 2 | 3): JSX.Element {
	return (
		<Feature key={title} span={span}>
			<Feature.Icon>
				<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
					<circle cx="12" cy="12" r="8" />
				</svg>
			</Feature.Icon>
			<Feature.Title>{title}</Feature.Title>
			<Feature.Description>Short supporting copy for the claim.</Feature.Description>
		</Feature>
	);
}

/** The cells of the grid inside `host`. */
function cells(host: HTMLElement): HTMLElement[] {
	return [...host.querySelectorAll<HTMLElement>('[data-slot="feature"]')];
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("Feature.Grid list", () => {
	test("sets each icon beside its title and copy, with no card chrome", () => {
		let host = mount(
			<Feature.Grid variant="list" columns={3}>
				{["Probes", "Paging", "Status"].map((title) => claim(title))}
			</Feature.Grid>,
			1024,
		);
		let [cell] = cells(host);
		let icon = cell!.querySelector<HTMLElement>('[data-slot="feature-icon"]')!;
		let title = cell!.querySelector<HTMLElement>('[data-slot="feature-title"]')!;
		let description = cell!.querySelector<HTMLElement>('[data-slot="feature-description"]')!;

		expect(getComputedStyle(cell!).paddingTop).toBe("0px");
		expect(getComputedStyle(cell!).boxShadow).toBe("none");
		expect(title.getBoundingClientRect().left).toBeGreaterThan(icon.getBoundingClientRect().right);
		expect(description.getBoundingClientRect().left).toBe(title.getBoundingClientRect().left);
		expect(
			Math.abs(title.getBoundingClientRect().top - icon.getBoundingClientRect().top),
		).toBeLessThan(1);
		expect(cells(host).map((each) => Math.round(each.getBoundingClientRect().top))).toEqual(
			Array(3).fill(Math.round(cell!.getBoundingClientRect().top)),
		);
	});

	test("starts an icon-less cell's copy on the cell's edge", () => {
		let host = mount(
			<Feature.Grid variant="list">
				<Feature>
					<Feature.Title>No icon</Feature.Title>
					<Feature.Description>Copy.</Feature.Description>
				</Feature>
			</Feature.Grid>,
			1024,
		);
		let [cell] = cells(host);

		expect(
			cell!.querySelector<HTMLElement>('[data-slot="feature-title"]')!.getBoundingClientRect().left,
		).toBe(cell!.getBoundingClientRect().left);
	});
});

describe("Feature span", () => {
	test("widens a cell across tracks on a wide grid and keeps one column on a phone", () => {
		let wide = mount(
			<Feature.Grid columns={3}>
				{[claim("Wide", 2), claim("One"), claim("Two"), claim("Three", 2)]}
			</Feature.Grid>,
			1024,
		);
		let [first, second, third, fourth] = cells(wide);

		expect(first!.getBoundingClientRect().width).toBeCloseTo(
			2 * second!.getBoundingClientRect().width + 16,
			0,
		);
		expect(Math.round(third!.getBoundingClientRect().top)).toBe(
			Math.round(fourth!.getBoundingClientRect().top),
		);
		expect(Math.round(fourth!.getBoundingClientRect().right)).toBe(
			Math.round(wide.getBoundingClientRect().right),
		);

		document.body.replaceChildren();
		let narrow = mount(
			<Feature.Grid columns={3}>{[claim("Wide", 2), claim("One")]}</Feature.Grid>,
			375,
		);
		let [a, b] = cells(narrow);
		expect(a!.getBoundingClientRect().width).toBe(b!.getBoundingClientRect().width);
	});
});
