/**
 * Drives the range picker in a real browser: presets as pressed submit buttons with key
 * hints in a wide container, a select in a narrow one, letter keys and select changes that
 * submit the range with the kept parameters, and a Custom entry that opens the date range.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import { rangePickerKeys } from "./mixins/range-picker-keys.js";
import { RangePicker } from "./range-picker.js";

import "../reset.css";
import "../theme.css";

const PRESETS: RangePicker.Preset[] = [
	{ value: "24h", label: "24h", description: "Last 24 hours", key: "d" },
	{ value: "7d", label: "7d", description: "Last 7 days", key: "w" },
	{ value: "30d", label: "30d", description: "Last 30 days", key: "t" },
	{ value: "90d", label: "90d", description: "Last 90 days", key: "3" },
];

const LABELS: RangePicker.Labels = {
	group: "Time range",
	apply: "Apply",
	custom: "Custom",
	start: "From",
	end: "To",
};

/** Query strings of every submission the picker made, in order. */
let submitted: string[] = [];

/** Records a submission and keeps the test page in place. */
function record(event: SubmitEvent) {
	event.preventDefault();
	let form = event.target as HTMLFormElement;
	let data = new FormData(form, event.submitter);
	submitted.push(
		new URLSearchParams([...data].map(([key, value]) => [key, String(value)])).toString(),
	);
}

/** Mounts a picker with the 7-day range in effect in a host `width` pixels wide. */
function mount(width: number, enhanced = false): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	render(
		<RangePicker
			value="7d"
			presets={PRESETS}
			params={{ monitor: "api" }}
			custom={{ startName: "from", endName: "to", key: "c" }}
			labels={LABELS}
			mix={enhanced ? rangePickerKeys() : undefined}
		/>,
		{ container: host },
	);
	return host;
}

/** Whether `element` takes up space on the page. */
function shown(element: Element | null): boolean {
	return element instanceof HTMLElement && element.checkVisibility();
}

beforeEach(async () => {
	await page.viewport(1280, 800);
	submitted = [];
	document.addEventListener("submit", record);
});

afterEach(() => {
	document.removeEventListener("submit", record);
	document.body.replaceChildren();
});

describe("RangePicker", () => {
	test("shows the presets as a segmented control with the current one pressed", async () => {
		let host = mount(640);
		let group = page.getByRole("group", { name: "Time range" });

		await expect.element(group).toBeVisible();
		expect(shown(host.querySelector("select"))).toBe(false);
		await expect
			.element(page.getByRole("button", { name: "Last 7 days" }))
			.toHaveAttribute("aria-pressed", "true");
		await expect
			.element(page.getByRole("button", { name: "Last 24 hours" }))
			.toHaveAttribute("aria-pressed", "false");
	});

	test("shows each preset's letter key as a hint and announces it", () => {
		let host = mount(640);
		let week = host.querySelector<HTMLButtonElement>('button[value="7d"]')!;

		expect(week.getAttribute("aria-keyshortcuts")).toBe("W");
		expect(week.querySelector("kbd")?.textContent).toBe("W");
		expect(week.querySelector("kbd")?.getAttribute("aria-hidden")).toBe("true");
	});

	test("becomes a native select in a narrow container, with nothing overflowing", async () => {
		let host = mount(300);
		let select = host.querySelector("select")!;

		expect(shown(host.querySelector('[data-slot="range-picker-segments"]'))).toBe(false);
		expect(shown(select)).toBe(true);
		expect(select.value).toBe("7d");
		expect([...select.options].map((option) => option.text)).toContain("Last 30 days");
		expect(host.scrollWidth).toBeLessThanOrEqual(300);
		await expect.element(page.getByRole("button", { name: "Apply" })).toBeVisible();
	});

	test("submits the preset with the kept parameters", async () => {
		mount(640);
		await userEvent.click(page.getByRole("button", { name: "Last 30 days" }));
		expect(submitted).toEqual(["monitor=api&range=30d"]);
	});

	test("picks a preset by its letter key once enhanced, but leaves typing alone", async () => {
		let host = mount(640, true);
		await userEvent.keyboard("t");
		expect(submitted).toEqual(["monitor=api&range=30d"]);

		let field = document.createElement("input");
		host.appendChild(field);
		field.focus();
		await userEvent.keyboard("d");
		expect(submitted).toHaveLength(1);
	});

	test("submits the narrow select on change once enhanced, hiding Apply", async () => {
		let host = mount(300, true);
		expect(shown(host.querySelector('[data-slot="range-picker-apply"] button'))).toBe(false);

		await userEvent.selectOptions(host.querySelector("select")!, "90d");
		expect(submitted).toEqual(["monitor=api&range=90d"]);

		await userEvent.keyboard("d");
		expect(submitted.at(-1)).toBe("monitor=api&range=24h");
	});

	test("opens the custom date range in a popover that submits from and to", async () => {
		let host = mount(640);
		await userEvent.click(page.getByRole("button", { name: "Custom" }));
		let popover = host.querySelector<HTMLElement>("[popover]")!;
		expect(popover.matches(":popover-open")).toBe(true);

		let [from, to] = popover.querySelectorAll<HTMLInputElement>('input[type="date"]');
		from!.value = "2026-10-01";
		to!.value = "2026-10-07";
		popover.querySelector("form")!.requestSubmit();
		expect(submitted).toEqual(["monitor=api&range=custom&from=2026-10-01&to=2026-10-07"]);
	});
});
