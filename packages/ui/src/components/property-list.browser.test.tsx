/**
 * Lays PropertyList out in a real browser: the label column holds one width down every
 * row and stacks in a narrow container, an empty value reads its name, the edit popover
 * opens under its own row, and the tiles variant goes two-up only where it fits.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import { PropertyList } from "./property-list.js";

/** Mounts `node` in a host `width` pixels wide and returns the host. */
function mount(node: JSX.Element, width = 480): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	render(node, { container: host });
	return host;
}

/** A monitor's properties, one of them editable and one of them empty. */
function Monitor() {
	return () => (
		<PropertyList>
			<PropertyList.Item label="Status">Up</PropertyList.Item>
			<PropertyList.Item label="Region">Frankfurt, São Paulo and Singapore</PropertyList.Item>
			<PropertyList.Item label="Reviewers" empty="No reviews" />
			<PropertyList.Item
				label="Owner"
				edit={{
					id: "edit-owner",
					label: "Edit owner",
					content: (
						<form>
							<label>
								<input type="radio" name="owner" value="ana" /> Ana
							</label>
						</form>
					),
				}}
			>
				Ana Souza
			</PropertyList.Item>
		</PropertyList>
	);
}

/** The value cells, in source order. */
function values(host: HTMLElement): HTMLElement[] {
	return [...host.querySelectorAll<HTMLElement>("dd")];
}

beforeEach(async () => {
	await page.viewport(1280, 800);
});

afterEach(() => {
	document.body.replaceChildren();
});

describe("PropertyList", () => {
	test("fills a flex row it sits in, though it measures its own width", () => {
		let host = mount(<Monitor />);
		host.style.display = "flex";

		expect(host.querySelector("dl")!.getBoundingClientRect().width).toBeCloseTo(480, 0);
	});

	test("pairs each label and value in a description list", () => {
		let host = mount(<Monitor />);
		let list = host.querySelector("dl")!;

		expect(list.querySelectorAll(":scope > div > dt")).toHaveLength(4);
		expect(list.querySelectorAll(":scope > div > dd")).toHaveLength(4);
	});

	test("starts every value at the same inline offset beside a fixed label column", () => {
		let host = mount(<Monitor />);
		let lefts = values(host).map((dd) => Math.round(dd.getBoundingClientRect().left));
		let label = host.querySelector("dt")!.getBoundingClientRect();
		let row = host.querySelector("dt")!.parentElement!.getBoundingClientRect();

		expect(new Set(lefts).size).toBe(1);
		expect(label.width).toBeCloseTo(144, 0);
		expect(lefts[0]! - row.left).toBeCloseTo(144 + 16, 0);
	});

	test("stacks each label above its value in a narrow container", () => {
		let host = mount(<Monitor />, 300);
		let label = host.querySelector("dt")!.getBoundingClientRect();
		let value = host.querySelector("dd")!.getBoundingClientRect();

		expect(value.top).toBeGreaterThanOrEqual(label.bottom - 1);
		expect(value.left).toBeCloseTo(label.left, 0);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
	});

	test("names an empty value in muted words", () => {
		let host = mount(<Monitor />);
		let empty = host.querySelector('[data-slot="property-empty"]')!;

		expect(empty.textContent).toBe("No reviews");
		expect(empty.closest("dd")?.previousElementSibling?.textContent).toBe("Reviewers");
	});

	test("falls back to an em dash for an empty value with no name", () => {
		let host = mount(
			<PropertyList>
				<PropertyList.Item label="Last check">{null}</PropertyList.Item>
			</PropertyList>,
		);

		expect(host.querySelector("dd")?.textContent).toBe("—");
	});

	test("opens the edit popover anchored under its own row", async () => {
		let host = mount(<Monitor />);
		let button = host.querySelector<HTMLButtonElement>('[data-slot="property-edit"]')!;
		let popover = host.querySelector<HTMLElement>("#edit-owner")!;

		expect(button.getAttribute("popovertarget")).toBe("edit-owner");
		expect(button.textContent).toContain("Edit owner: Ana Souza");

		await userEvent.click(button);
		expect(popover.matches(":popover-open")).toBe(true);

		let anchor = button.getBoundingClientRect();
		let box = popover.getBoundingClientRect();
		expect(box.top).toBeGreaterThanOrEqual(anchor.bottom);
		expect(box.top - anchor.bottom).toBeLessThan(12);
		expect(box.left).toBeCloseTo(anchor.left, 0);
		expect(popover.getAttribute("aria-label")).toBe("Edit owner");
	});

	test("sets tiles two to a row only where two fit", () => {
		let tiles = (
			<PropertyList variant="tiles">
				<PropertyList.Item label="Uptime">99.98%</PropertyList.Item>
				<PropertyList.Item label="Response">212 ms</PropertyList.Item>
			</PropertyList>
		);
		let wide = mount(tiles, 480);
		let [first, second] = [...wide.querySelectorAll("dl > div")].map((tile) =>
			tile.getBoundingClientRect(),
		);
		expect(second!.top).toBeCloseTo(first!.top, 0);
		expect(second!.left).toBeGreaterThan(first!.right);

		document.body.replaceChildren();
		let narrow = mount(tiles, 280);
		let [top, bottom] = [...narrow.querySelectorAll("dl > div")].map((tile) =>
			tile.getBoundingClientRect(),
		);
		expect(bottom!.top).toBeGreaterThan(top!.bottom - 1);
	});
});
