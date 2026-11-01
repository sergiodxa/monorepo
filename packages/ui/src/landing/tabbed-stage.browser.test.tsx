/**
 * Lays {@link TabbedStage} out in a real browser: a vertical rail sits beside its stage at
 * 900px, choosing an item swaps panels through the radio group alone, and both layouts keep
 * the stage at its tallest panel's height on every tab, so the page below never jumps.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { render } from "remix/component/test";
import { describe, expect, test } from "vitest";

import { TabbedStage } from "./tabbed-stage.js";

/**
 * Mounts `node` in a column of `width` pixels attached to the document.
 *
 * @param node The stage to render.
 * @param width The column width in pixels.
 * @returns The rendered stage's container.
 */
function mount(node: RemixNode, width: number): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	return render(node, { container: host }).container;
}

/**
 * Three items whose panels are 60px, 240px and 120px tall. Each test passes its own `name`,
 * so every label's `for` reaches the radio of the stage it belongs to.
 *
 * @param orientation The stage layout under test.
 * @param name The stage's radio name.
 * @returns The stage element tree.
 */
function stage(orientation: TabbedStage.Orientation, name: string): RemixNode {
	return (
		<TabbedStage name={name} orientation={orientation} aria-label="Incident">
			<TabbedStage.Item value="detect" label="Detect" description="Probes agree." defaultChecked>
				<p style={{ height: "60px", margin: "0" }}>Detect panel</p>
			</TabbedStage.Item>
			<TabbedStage.Item value="page" label="Page" description="On-call is paged.">
				<p style={{ height: "240px", margin: "0" }}>Page panel</p>
			</TabbedStage.Item>
			<TabbedStage.Item value="resolve" label="Resolve" description="Status updates.">
				<p style={{ height: "120px", margin: "0" }}>Resolve panel</p>
			</TabbedStage.Item>
		</TabbedStage>
	);
}

/**
 * The panel element belonging to the item with `value`.
 *
 * @param root The rendered container.
 * @param value The item's radio value.
 * @returns The item's panel.
 */
function panel(root: HTMLElement, value: string): HTMLElement {
	return root.querySelector<HTMLElement>(
		`[data-value="${value}"] [data-slot="tabbed-stage-panel"]`,
	)!;
}

/**
 * Selects each tab in turn through its label and records the stage's height.
 *
 * @param root The rendered container.
 * @returns The stage height after each selection, in item order.
 */
async function heightsPerTab(root: HTMLElement): Promise<number[]> {
	let host = root.querySelector<HTMLElement>('[data-slot="tabbed-stage"]')!;
	let heights: number[] = [];
	for (let label of root.querySelectorAll<HTMLElement>('[data-slot="tabbed-stage-tab"]')) {
		label.click();
		await new Promise((resolve) => requestAnimationFrame(resolve));
		heights.push(Math.round(host.getBoundingClientRect().height));
	}
	return heights;
}

describe("TabbedStage vertical", () => {
	test("shows the selected panel beside the rail and switches on a label click", async () => {
		let root = mount(stage("vertical", "rail-switch"), 900);
		let detect = panel(root, "detect");
		let page = panel(root, "page");

		expect(getComputedStyle(detect).visibility).toBe("visible");
		expect(getComputedStyle(page).visibility).toBe("hidden");
		expect(getComputedStyle(detect).position).toBe("sticky");

		let rail = root.querySelector<HTMLElement>('[data-value="detect"] label')!;
		expect(detect.getBoundingClientRect().left).toBeGreaterThanOrEqual(
			rail.getBoundingClientRect().right,
		);

		root.querySelector<HTMLElement>('[data-value="page"] label')!.click();
		await new Promise((resolve) => requestAnimationFrame(resolve));

		expect(getComputedStyle(detect).visibility).toBe("hidden");
		expect(getComputedStyle(page).visibility).toBe("visible");
		expect(page.getBoundingClientRect().left).toBe(detect.getBoundingClientRect().left);
		let description = root.querySelector<HTMLElement>(
			'[data-value="page"] [data-slot="tabbed-stage-description"]',
		)!;
		expect(getComputedStyle(description).display).toBe("block");
	});

	test("keeps the stage beside the rail at one height on every tab", async () => {
		let heights = await heightsPerTab(mount(stage("vertical", "rail-height"), 900));

		expect(new Set(heights).size).toBe(1);
		expect(heights[0]).toBeGreaterThanOrEqual(240);
	});

	test("stacks every panel under the rail on a phone, at the tallest panel's height", async () => {
		let root = mount(stage("vertical", "rail-phone"), 343);
		let rail = root.querySelector<HTMLElement>('[data-value="resolve"] label')!;
		let detect = panel(root, "detect");
		let page = panel(root, "page");

		expect(detect.getBoundingClientRect().top).toBeGreaterThanOrEqual(
			rail.getBoundingClientRect().bottom,
		);
		expect(page.getBoundingClientRect().top).toBe(detect.getBoundingClientRect().top);
		expect(Math.round(detect.getBoundingClientRect().height)).toBe(
			Math.round(page.getBoundingClientRect().height),
		);
	});
});

describe("TabbedStage horizontal", () => {
	test("lays every panel on one line under the pills, so tabs never change its height", async () => {
		let root = mount(stage("horizontal", "pills-line"), 600);
		let pill = root.querySelector<HTMLElement>('[data-slot="tabbed-stage-tab"]')!;
		let panels = ["detect", "page", "resolve"].map((value) => panel(root, value));
		let first = panels[0]!.getBoundingClientRect();

		expect(first.top).toBeGreaterThan(pill.getBoundingClientRect().bottom);
		for (let each of panels) {
			let box = each.getBoundingClientRect();
			expect(box.left).toBe(first.left);
			expect(box.top).toBe(first.top);
			expect(box.width).toBe(600);
		}

		let heights = await heightsPerTab(root);
		expect(new Set(heights).size).toBe(1);
		expect(getComputedStyle(panels[2]!).visibility).toBe("visible");
		expect(getComputedStyle(panels[0]!).visibility).toBe("hidden");
	});

	test("keeps the panels on one line when the pills wrap onto two rows", async () => {
		let heights = await heightsPerTab(mount(stage("horizontal", "pills-wrap"), 160));

		expect(new Set(heights).size).toBe(1);
		expect(heights[0]).toBeLessThan(240 + 3 * 60);
	});
});
