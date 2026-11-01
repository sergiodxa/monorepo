/**
 * Draws status dots in a real browser: each tone resolves to its role's colour, a labelled dot
 * hides itself from assistive technology while a bare one is named, only an in-progress dot
 * pulses and it holds still under reduced motion, and the summary reads its label.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { cdp } from "vitest/browser";

import { StatusDot } from "./status-dot.js";

/** Mounts `node` in a fresh host appended to the page and returns the host. */
function mount(node: JSX.Element): HTMLElement {
	let host = document.createElement("div");
	host.style.setProperty("--ui-success-bg-solid", "rgb(0, 128, 0)");
	host.style.setProperty("--ui-warning-bg-solid", "rgb(200, 150, 0)");
	host.style.setProperty("--ui-danger-bg-solid", "rgb(200, 0, 0)");
	host.style.setProperty("--ui-brand-bg-solid", "rgb(0, 0, 200)");
	host.style.setProperty("--ui-neutral-border-strong", "rgb(120, 120, 120)");
	document.body.appendChild(host);
	render(node, { container: host });
	return host;
}

/** The circle inside the first status dot in `host`. */
function dotOf(host: HTMLElement): HTMLElement {
	return host.querySelector<HTMLElement>('[data-slot="status-dot-dot"]')!;
}

afterEach(async () => {
	document.body.replaceChildren();
	await cdp().send("Emulation.setEmulatedMedia", { features: [] });
});

describe("StatusDot", () => {
	for (let [color, rgb] of [
		["success", "rgb(0, 128, 0)"],
		["warning", "rgb(200, 150, 0)"],
		["danger", "rgb(200, 0, 0)"],
		["brand", "rgb(0, 0, 200)"],
		["neutral", "rgb(120, 120, 120)"],
	] as const) {
		test(`paints a ${color} dot in its role's solid colour`, () => {
			let host = mount(<StatusDot color={color}>State</StatusDot>);
			expect(getComputedStyle(dotOf(host)).backgroundColor).toBe(rgb);
		});
	}

	test("draws an 8px circle", () => {
		let box = dotOf(mount(<StatusDot color="success">Up</StatusDot>)).getBoundingClientRect();
		expect(box.width).toBe(8);
		expect(box.height).toBe(8);
	});

	test("hides the dot when the label names the state", () => {
		let host = mount(<StatusDot color="success">Up</StatusDot>);
		let root = host.querySelector('[data-slot="status-dot"]')!;

		expect(dotOf(host).getAttribute("aria-hidden")).toBe("true");
		expect(root.getAttribute("role")).toBeNull();
		expect(root.textContent).toBe("Up");
	});

	test("names a label-less dot through aria-label as an image", () => {
		let host = mount(<StatusDot color="danger" aria-label="Down" />);
		let root = host.querySelector('[data-slot="status-dot"]')!;

		expect(root.getAttribute("role")).toBe("img");
		expect(root.getAttribute("aria-label")).toBe("Down");
	});

	test("pulses only while in progress", () => {
		let still = mount(<StatusDot color="success">Up</StatusDot>);
		let busy = mount(
			<StatusDot color="brand" pulse>
				Deploying
			</StatusDot>,
		);

		expect(getComputedStyle(dotOf(still), "::after").animationName).toBe("none");
		expect(getComputedStyle(dotOf(busy), "::after").animationName).toBe("ui-status-dot-pulse");
	});

	test("holds the in-progress dot still under reduced motion", async () => {
		await cdp().send("Emulation.setEmulatedMedia", {
			features: [{ name: "prefers-reduced-motion", value: "reduce" }],
		});
		let host = mount(
			<StatusDot color="brand" pulse>
				Deploying
			</StatusDot>,
		);

		expect(getComputedStyle(dotOf(host), "::after").animationName).toBe("none");
	});
});

describe("StatusDot.Summary", () => {
	test("shows one dot per state and n/N, and reads its label", () => {
		let host = mount(
			<StatusDot.Summary colors={["success", "danger"]} count={2} total={5} label="2 of 5" />,
		);
		let root = host.querySelector('[data-slot="status-dot-summary"]')!;
		let dots = root.querySelectorAll<HTMLElement>('[data-slot="status-dot-dot"]');

		expect(dots).toHaveLength(2);
		expect(getComputedStyle(dots[1]!).backgroundColor).toBe("rgb(200, 0, 0)");
		expect(root.textContent).toContain("2/5");
		expect(root.querySelector(':not([aria-hidden="true"]) > span:last-child')?.textContent).toBe(
			"2 of 5",
		);
	});
});
