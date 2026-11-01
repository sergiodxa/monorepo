/**
 * Lays numbered steps out in a real browser and measures the counter discs and the rail
 * between them: the rail starts under one disc and stops short of the next, titles are
 * headings at the right depth with their anchors, and nothing overflows a phone column.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { render } from "remix/component/test";
import { describe, expect, test } from "vitest";

import { HeadingScope } from "../components/heading-scope.js";

import { Steps } from "./steps.js";

import "../reset.css";
import "../theme.css";

/** Mounts a node in a column of the given width. */
function mount(node: RemixNode, width = 640): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	return render(node, { container: host }).container;
}

/** Three steps with a paragraph of body copy each, the last one with a long code line. */
function procedure(): RemixNode {
	return (
		<Steps>
			<Steps.Item id="add-a-monitor" title="Add a monitor">
				<p>Paste the URL you want watched and pick how often it is checked.</p>
			</Steps.Item>
			<Steps.Item id="pick-who-gets-paged" title="Pick who gets paged">
				<p>Route alerts to a person or a rotation.</p>
			</Steps.Item>
			<Steps.Item title="Verify the webhook">
				<pre style={{ overflowX: "auto", maxWidth: "100%" }}>
					{`curl -X POST https://uptime.example.com/hooks/test --data '{"monitor":"checkout"}'`}
				</pre>
			</Steps.Item>
		</Steps>
	);
}

/** The box of an item's `::before` or `::after`, in viewport coordinates. */
function pseudoBox(item: Element, which: "::before" | "::after") {
	let style = getComputedStyle(item, which);
	let box = item.getBoundingClientRect();
	let top = box.top + parseFloat(style.top);
	let left = box.left + parseFloat(style.left);
	return { top, left, height: parseFloat(style.height), width: parseFloat(style.width), style };
}

describe("Steps", () => {
	test("numbers each step in a 28px ringed disc", () => {
		let items = mount(procedure()).querySelectorAll('[data-slot="steps-item"]');

		expect(items).toHaveLength(3);
		expect(getComputedStyle(items[1]!, "::before").content).toBe("counter(ui-docs-step)");
		for (let item of items) {
			let disc = pseudoBox(item, "::before");
			expect(disc.width).toBe(28);
			expect(disc.height).toBe(28);
			expect(disc.style.boxShadow).toContain("inset");
			expect(disc.style.boxShadow).toContain("1px");
		}
	});

	test("runs a 1px rail from under each disc and stops it short of the next disc", () => {
		let items = [...mount(procedure()).querySelectorAll('[data-slot="steps-item"]')];

		for (let index = 0; index < items.length - 1; index++) {
			let disc = pseudoBox(items[index]!, "::before");
			let rail = pseudoBox(items[index]!, "::after");
			let next = pseudoBox(items[index + 1]!, "::before");

			expect(rail.width).toBe(1);
			expect(rail.top).toBeGreaterThan(disc.top + disc.height);
			expect(rail.top + rail.height).toBeLessThan(next.top);
			expect(next.top - (rail.top + rail.height)).toBeLessThanOrEqual(8);
			expect(Math.abs(rail.left + 0.5 - (disc.left + disc.width / 2))).toBeLessThan(1);
		}
		expect(getComputedStyle(items.at(-1)!, "::after").content).toBe("none");
	});

	test("centres each title's first line on its disc", () => {
		let item = mount(procedure()).querySelector('[data-slot="steps-item"]')!;
		let disc = pseudoBox(item, "::before");
		let title = item.querySelector('[data-slot="steps-title"]')!.getBoundingClientRect();

		expect(Math.abs(title.top + 14 - (disc.top + disc.height / 2))).toBeLessThan(2);
		expect(title.left).toBeGreaterThan(disc.left + disc.width);
	});

	test("renders titles as h2 headings with their ids when no scope wraps the list", () => {
		let root = mount(procedure());
		let headings = [...root.querySelectorAll('[data-slot="steps-title"]')];

		expect(headings.map((heading) => heading.tagName)).toEqual(["H2", "H2", "H2"]);
		expect(headings[0]!.id).toBe("add-a-monitor");
		expect(root.querySelector("#pick-who-gets-paged")!.textContent).toBe("Pick who gets paged");
		expect(root.querySelector("ol")).not.toBeNull();
	});

	test("nests one level under the surrounding heading scope, and honours an explicit level", () => {
		let scoped = mount(<HeadingScope level={2}>{procedure()}</HeadingScope>);
		let fixed = mount(
			<Steps level={4}>
				<Steps.Item title="One">Body</Steps.Item>
			</Steps>,
		);

		expect(scoped.querySelector('[data-slot="steps-title"]')!.tagName).toBe("H3");
		expect(fixed.querySelector('[data-slot="steps-title"]')!.tagName).toBe("H4");
	});

	test("keeps a long code line inside a 320px column", () => {
		let root = mount(procedure(), 320);
		let list = root.querySelector("ol")!;

		expect(list.getBoundingClientRect().width).toBeLessThanOrEqual(320);
		expect(root.scrollWidth).toBeLessThanOrEqual(320);
		for (let item of root.querySelectorAll('[data-slot="steps-item"]')) {
			expect(item.getBoundingClientRect().right).toBeLessThanOrEqual(
				list.getBoundingClientRect().right,
			);
		}
	});
});
