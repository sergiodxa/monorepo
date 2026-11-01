/**
 * Drives the view options popover in a real browser: each field's name and value as the URL
 * sets them, defaults when it names none, the parameters it carries for the rest of the page,
 * keyboard choice in the segmented controls, and "Set as default" posting the same fields.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import { ViewOptions } from "./view-options.js";

const LABELS: ViewOptions.Labels = {
	trigger: "Display",
	layout: "Layout",
	grouping: "Grouping",
	ordering: "Ordering",
	density: "Density",
	properties: "Properties",
	apply: "Apply",
	setDefault: "Set as default",
};

let mounted: RenderResult | undefined;

/** Mounts the popover for `url`, open, and returns its form. */
function mount(url: string): HTMLFormElement {
	mounted = render(
		<ViewOptions
			id="monitors-view"
			url={url}
			layout={{
				defaultValue: "table",
				options: [
					{ value: "list", label: "List" },
					{ value: "table", label: "Table" },
					{ value: "grid", label: "Grid" },
				],
			}}
			grouping={{
				defaultValue: "none",
				options: [
					{ value: "none", label: "No grouping" },
					{ value: "status", label: "Status" },
					{ value: "region", label: "Region" },
				],
			}}
			ordering={{
				defaultValue: "name",
				options: [
					{ value: "name", label: "Name" },
					{ value: "-checked", label: "Last checked" },
				],
			}}
			density={{
				defaultValue: "compact",
				options: [
					{ value: "compact", label: "Compact" },
					{ value: "comfortable", label: "Comfortable" },
				],
			}}
			properties={{
				defaultValue: ["status", "uptime"],
				options: [
					{ value: "status", label: "Status" },
					{ value: "uptime", label: "Uptime" },
					{ value: "region", label: "Region" },
				],
			}}
			setDefault={{ action: "/settings/views/monitors" }}
			labels={LABELS}
		/>,
	);
	document.getElementById("monitors-view-popover")!.showPopover();
	return document.querySelector<HTMLFormElement>("#monitors-view-popover form")!;
}

/** What `form` sends, as a submit through `submitter` would. */
function sent(form: HTMLFormElement, submitter?: HTMLElement): [string, string][] {
	return [...new FormData(form, submitter)].map(([name, value]) => [
		name,
		typeof value === "string" ? value : value.name,
	]);
}

beforeEach(async () => {
	await page.viewport(1024, 768);
});

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
});

describe("ViewOptions", () => {
	test("opens from a Display trigger as a labelled dialog", () => {
		mount("/monitors");
		let trigger = document.querySelector('[data-slot="view-options-trigger"]')!;
		let popover = document.getElementById("monitors-view-popover")!;

		expect(trigger.getAttribute("commandfor")).toBe("monitors-view-popover");
		expect(trigger.textContent).toBe("Display");
		expect(popover.getAttribute("role")).toBe("dialog");
		expect(popover.getAttribute("aria-label")).toBe("Display");
	});

	test("submits each field's default while the URL names none, carrying the page's other parameters", () => {
		let form = mount("/monitors?state=active&status=down&page=3");

		expect(form.method).toBe("get");
		expect(sent(form)).toEqual([
			["state", "active"],
			["status", "down"],
			["layout", "table"],
			["group", "none"],
			["order", "name"],
			["density", "compact"],
			["props", ""],
			["props", "status"],
			["props", "uptime"],
		]);
	});

	test("shows the values the URL holds, ignoring one that names no option", () => {
		let form = mount(
			"/monitors?layout=grid&group=region&order=bogus&density=comfortable&props=&props=region",
		);
		let values = new URLSearchParams(sent(form));

		expect(values.get("layout")).toBe("grid");
		expect(values.get("group")).toBe("region");
		expect(values.get("order")).toBe("name");
		expect(values.get("density")).toBe("comfortable");
		expect(values.getAll("props")).toEqual(["", "region"]);
	});

	test("keeps every property off once the URL says so", () => {
		let form = mount("/monitors?props=");

		expect(new URLSearchParams(sent(form)).getAll("props")).toEqual([""]);
	});

	test("moves between layouts with the arrow keys and toggles a property with Space", async () => {
		let form = mount("/monitors");
		form.querySelector<HTMLInputElement>('input[name="layout"][value="table"]')!.focus();

		await userEvent.keyboard("{ArrowRight}");
		let region = form.querySelector<HTMLInputElement>('input[name="props"][value="region"]')!;
		region.focus();
		await userEvent.keyboard("[Space]");

		let values = new URLSearchParams(sent(form));
		expect(values.get("layout")).toBe("grid");
		expect(values.getAll("props")).toEqual(["", "status", "uptime", "region"]);
		expect(region.closest("label")!.matches(":has(input:checked)")).toBe(true);
	});

	test("posts the same fields to the default endpoint from Set as default", () => {
		let form = mount("/monitors?layout=grid");
		let button = form.querySelector<HTMLButtonElement>('[data-slot="view-options-default"]')!;

		expect(button.type).toBe("submit");
		expect(button.formMethod).toBe("post");
		expect(button.getAttribute("formaction")).toBe("/settings/views/monitors");
		expect(new URLSearchParams(sent(form, button)).get("layout")).toBe("grid");
	});

	test("fits a 320px viewport", async () => {
		await page.viewport(320, 700);
		mount("/monitors");
		let box = document.getElementById("monitors-view-popover")!.getBoundingClientRect();

		expect(box.left).toBeGreaterThanOrEqual(0);
		expect(box.right).toBeLessThanOrEqual(320);
	});
});
