/**
 * Lays a text field with a prefix or suffix out in a real browser: the addon and the
 * input share one border with rounding on the outer corners only, the addon describes
 * the input and focuses it when clicked, and the field's rings wrap the whole group.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import { Group } from "./group.js";
import { Input } from "./input.js";
import { TextField } from "./text-field.js";

import "../reset.css";
import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
	await page.viewport(1280, 800);
});

/** Mounts `node` in a host `width` pixels wide and returns the host. */
function mount(node: JSX.Element, width = 480): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	host.style.padding = "8px";
	document.body.appendChild(host);
	mounted = render(node, { container: host });
	return host;
}

/** The parts of the one field rendered in `host`. */
function parts(host: HTMLElement) {
	let input = host.querySelector<HTMLInputElement>("input")!;
	let addons = [...host.querySelectorAll<HTMLElement>('[data-slot="group-text"]')];
	let group = input.parentElement!;
	return { input, addons, group };
}

/** Whether an element's computed outline is drawn. */
function hasOutline(element: Element): boolean {
	let style = getComputedStyle(element);
	return style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0;
}

describe("TextField with a prefix or suffix", () => {
	test("joins the prefix to the input as one bordered field, rounded on the outer corners only", () => {
		let host = mount(<TextField label="Workspace URL" name="slug" prefix="pulse.dev/" />);
		let { input, addons } = parts(host);
		let [prefix] = addons;
		let prefixStyle = getComputedStyle(prefix!);
		let inputStyle = getComputedStyle(input);

		expect(addons).toHaveLength(1);
		expect(prefix!.textContent).toBe("pulse.dev/");
		expect(prefixStyle.borderTopWidth).toBe("1px");
		expect(
			Math.abs(prefix!.getBoundingClientRect().right - input.getBoundingClientRect().left),
		).toBeLessThanOrEqual(1);
		expect(prefix!.getBoundingClientRect().height).toBeCloseTo(
			input.getBoundingClientRect().height,
			0,
		);

		expect(Number.parseFloat(prefixStyle.borderStartStartRadius)).toBeGreaterThan(0);
		expect(Number.parseFloat(prefixStyle.borderEndStartRadius)).toBeGreaterThan(0);
		expect(prefixStyle.borderStartEndRadius).toBe("0px");
		expect(prefixStyle.borderEndEndRadius).toBe("0px");
		expect(inputStyle.borderStartStartRadius).toBe("0px");
		expect(inputStyle.borderEndStartRadius).toBe("0px");
		expect(Number.parseFloat(inputStyle.borderStartEndRadius)).toBeGreaterThan(0);
		expect(Number.parseFloat(inputStyle.borderEndEndRadius)).toBeGreaterThan(0);
	});

	test("rounds a suffix on its trailing corners and the input on its leading ones", () => {
		let host = mount(<TextField label="Timeout" name="timeout" type="number" suffix="ms" />);
		let { input, addons } = parts(host);
		let [suffix] = addons;
		let suffixStyle = getComputedStyle(suffix!);
		let inputStyle = getComputedStyle(input);

		expect(
			Math.abs(input.getBoundingClientRect().right - suffix!.getBoundingClientRect().left),
		).toBeLessThanOrEqual(1);
		expect(suffixStyle.borderStartStartRadius).toBe("0px");
		expect(Number.parseFloat(suffixStyle.borderStartEndRadius)).toBeGreaterThan(0);
		expect(Number.parseFloat(inputStyle.borderStartStartRadius)).toBeGreaterThan(0);
		expect(inputStyle.borderStartEndRadius).toBe("0px");
	});

	test("describes the input with its addons and keeps its name to the label", () => {
		let host = mount(
			<TextField
				label="Price"
				name="price"
				prefix="$"
				suffix="USD"
				description="Charged monthly."
			/>,
		);
		let { input, addons } = parts(host);
		let describedBy = input.getAttribute("aria-describedby")!.split(" ");

		for (let addon of addons) expect(describedBy).toContain(addon.id);
		expect(describedBy).toHaveLength(3);
		let labelledBy = input.getAttribute("aria-labelledby")!;
		expect(document.getElementById(labelledBy)!.textContent).toBe("Price");
		for (let addon of addons) expect(addon.tabIndex).toBeLessThan(0);
	});

	test("focuses the input when the addon is clicked", async () => {
		let host = mount(<TextField label="Workspace URL" name="slug" prefix="pulse.dev/" />);
		let { input, addons } = parts(host);

		await userEvent.click(addons[0]!);

		expect(document.activeElement).toBe(input);
	});

	test("draws the focus ring around the whole group, not the input", async () => {
		let host = mount(<TextField label="Workspace URL" name="slug" prefix="pulse.dev/" />);
		let { input, group } = parts(host);

		await userEvent.click(input);

		expect(hasOutline(group)).toBe(true);
		expect(hasOutline(input)).toBe(false);
	});

	test("draws the invalid ring around the whole group, not the input", () => {
		let host = mount(
			<TextField label="Workspace URL" name="slug" prefix="pulse.dev/" errorMessage="Taken." />,
		);
		let { input, group, addons } = parts(host);

		expect(input.getAttribute("aria-invalid")).toBe("true");
		expect(hasOutline(group)).toBe(true);
		expect(hasOutline(input)).toBe(false);
		expect(getComputedStyle(addons[0]!).borderTopColor).toBe(
			getComputedStyle(input).borderTopColor,
		);
	});

	test("dims the addon with a disabled field", () => {
		let host = mount(<TextField label="Amount" name="amount" prefix="$" disabled />);
		let { addons } = parts(host);

		expect(Number(getComputedStyle(addons[0]!).opacity)).toBeLessThan(1);
	});

	test("shrinks the input and keeps a long addon on one line at 320px", async () => {
		await page.viewport(320, 640);
		let host = mount(
			<TextField label="Subdomain" name="subdomain" suffix=".northwind.example.com" />,
			304,
		);
		let { input, addons, group } = parts(host);
		let [suffix] = addons;

		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320);
		expect(group.getBoundingClientRect().right).toBeLessThanOrEqual(
			host.getBoundingClientRect().right,
		);
		expect(suffix!.getBoundingClientRect().height).toBeCloseTo(
			input.getBoundingClientRect().height,
			0,
		);
		expect(suffix!.scrollWidth).toBeLessThanOrEqual(suffix!.clientWidth);
	});
});

describe("Group.Text", () => {
	test("composes an addon onto an Input by hand", async () => {
		let host = mount(
			<Group>
				<Group.Text id="slug-prefix" htmlFor="slug">
					pulse.dev/
				</Group.Text>
				<Input id="slug" aria-label="Workspace URL" aria-describedby="slug-prefix" />
			</Group>,
		);
		let { input, addons, group } = parts(host);

		await userEvent.click(addons[0]!);

		expect(document.activeElement).toBe(input);
		expect(hasOutline(group)).toBe(true);
		expect(hasOutline(input)).toBe(false);
	});
});
