/**
 * Lays {@link PropsTable} out in a real browser: five labelled columns in a wide column,
 * child rows behind a disclosure that expands in place, long types wrapping inside their
 * cell, and rows stacking into cards at 320px without widening the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { Typeset } from "../components/typeset.js";

import { PropsTable } from "./props-table.js";

import "../theme.css";

/** Every string the tables in these tests print. */
const LABELS: PropsTable.Labels = {
	name: "Name",
	type: "Type",
	default: "Default",
	required: "Required",
	description: "Description",
	yes: "Yes",
	no: "No",
	showChildren: "Show child parameters",
	hideChildren: "Hide child parameters",
};

/** A monitor's fields, one of them an object with children and one a long union type. */
const ROWS: PropsTable.Row[] = [
	{ name: "url", type: "string", required: true, description: "The address each probe requests." },
	{
		name: "method",
		type: '"GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS"',
		default: '"GET"',
		description: "The HTTP method each probe sends.",
	},
	{
		name: "assertions",
		type: "object",
		description: "What a response must satisfy to pass.",
		children: [
			{ name: "status", type: "number", default: "200", description: "The status code to expect." },
			{ name: "maxLatencyMs", type: "number", description: "Slowest acceptable response." },
		],
	},
];

/** Hosts mounted by a test, removed after it so layout never leaks between cases. */
let hosts: HTMLElement[] = [];

afterEach(() => {
	for (let host of hosts) host.remove();
	hosts = [];
});

/** Mounts `node` in a column `width` pixels wide and returns the table's box. */
function mount(node: RemixNode, width = 760): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	hosts.push(host);
	render(node, { container: host });
	return host.querySelector<HTMLElement>('[data-slot="props-table"]')!;
}

describe("PropsTable", () => {
	test("prints five labelled columns and one row per field", () => {
		let box = mount(<PropsTable aria-label="Monitor fields" rows={ROWS} labels={LABELS} />);
		let table = box.querySelector("table")!;
		let headers = [...table.querySelectorAll(":scope > thead th")].map((th) => th.textContent);
		expect(headers).toEqual(["Name", "Type", "Default", "Required", "Description"]);
		expect(table.getAttribute("aria-label")).toBe("Monitor fields");

		let first = table.querySelector<HTMLElement>(":scope > tbody > tr[data-row]")!;
		expect(first.querySelector("th")!.getAttribute("scope")).toBe("row");
		expect(first.querySelector('[data-cell="required"]')!.textContent).toBe("Yes");
		let cells = first.querySelectorAll(":scope > *");
		let tops = [...cells].map((cell) => Math.round(cell.getBoundingClientRect().top));
		expect(new Set(tops).size).toBe(1);
	});

	test("leaves out the Default column when no row has a default", () => {
		let rows = ROWS.map(({ name, type, description }) => ({ name, type, description }));
		let box = mount(<PropsTable rows={rows} labels={LABELS} />);
		let table = box.querySelector("table")!;
		let headers = [...table.querySelectorAll(":scope > thead th")].map((th) => th.textContent);

		expect(headers).toEqual(["Name", "Type", "Required", "Description"]);
		expect(table.querySelector('[data-cell="default"]')).toBeNull();
	});

	test("expands child rows in place under their parent", () => {
		let box = mount(<PropsTable rows={ROWS} labels={LABELS} />);
		let details = box.querySelector("details")!;
		let summary = details.querySelector("summary")!;
		let nested = details.querySelector("table")!;

		expect(details.open).toBe(false);
		expect(nested.checkVisibility()).toBe(false);
		expect(summary.innerText).toBe("Show child parameters");

		summary.click();
		expect(details.open).toBe(true);
		expect(summary.innerText).toBe("Hide child parameters");
		expect(nested.checkVisibility()).toBe(true);
		expect(nested.querySelectorAll(":scope > tbody > tr[data-row]")).toHaveLength(2);

		let parent = box.querySelectorAll<HTMLElement>("table > tbody > tr[data-row]")[2]!;
		expect(nested.getBoundingClientRect().top).toBeGreaterThan(
			parent.getBoundingClientRect().bottom - 1,
		);
	});

	test("wraps a long type inside its cell", () => {
		let box = mount(<PropsTable rows={ROWS} labels={LABELS} />);
		let type = box.querySelectorAll<HTMLElement>('[data-cell="type"]')[1]!;
		let line = parseFloat(getComputedStyle(type).lineHeight) || 20;
		expect(type.getBoundingClientRect().height).toBeGreaterThan(line * 1.5);
		expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth);
	});

	test("stacks each row into a card at 320px without widening the page", () => {
		let box = mount(<PropsTable rows={ROWS} labels={LABELS} />, 320);
		let table = box.querySelector("table")!;
		expect(getComputedStyle(table.querySelector("thead")!).display).toBe("none");

		let row = table.querySelector<HTMLElement>(":scope > tbody > tr[data-row]")!;
		let name = row.querySelector("th")!.getBoundingClientRect();
		let type = row.querySelector('[data-cell="type"]')!;
		expect(type.getBoundingClientRect().top).toBeGreaterThanOrEqual(name.bottom - 1);
		expect(getComputedStyle(type, "::before").content).toBe('"Type"');

		expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth);
		expect(box.getBoundingClientRect().width).toBeLessThanOrEqual(320);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
	});

	test("lines labels up across a stacked card, the type as wide as every other value", () => {
		let box = mount(<PropsTable rows={ROWS} labels={LABELS} />, 480);
		let row = box.querySelector<HTMLElement>("table > tbody > tr[data-row]")!;
		let type = row.querySelector<HTMLElement>('[data-cell="type"]')!.getBoundingClientRect();
		let required = row
			.querySelector<HTMLElement>('[data-cell="required"]')!
			.getBoundingClientRect();
		expect(Math.abs(type.width - required.width)).toBeLessThan(1);
	});

	test("keeps Typeset's prose table rules off its own table", () => {
		let box = mount(
			<Typeset preset="docs">
				<PropsTable rows={ROWS} labels={LABELS} />
			</Typeset>,
		);
		let plain = mount(<PropsTable rows={ROWS} labels={LABELS} />);
		let cell = (root: HTMLElement) =>
			getComputedStyle(root.querySelector<HTMLElement>('[data-cell="type"]')!);
		expect(cell(box).paddingInlineStart).toBe(cell(plain).paddingInlineStart);
		expect(cell(box).borderInlineStartWidth).toBe(cell(plain).borderInlineStartWidth);
	});
});
