/**
 * Drives the range picker in a real browser: presets as pressed submit buttons with key
 * hints in a wide container, a select in a narrow one, letter keys and select changes that
 * submit the range with the kept parameters, and a Custom entry that opens the date range.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { renderToString } from "remix/component/server";
import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";

import { rangePickerKeys } from "./mixins/range-picker-keys.js";
import { PageHeader } from "./page-header.js";
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

/** A cool neutral ramp, as an app's stylesheet sets the palette the theme's roles read. */
const PALETTE: Record<string, string> = Object.fromEntries(
	Object.entries({
		50: 0.985,
		100: 0.965,
		200: 0.915,
		300: 0.84,
		400: 0.73,
		500: 0.62,
		600: 0.52,
		700: 0.42,
		800: 0.32,
		900: 0.235,
		950: 0.155,
	}).map(([step, l]) => [`--ui-color-neutral-${step}`, `oklch(${l} 0.012 275)`]),
);

/** Query strings of every submission the picker made, in order. */
let submitted: string[] = [];

/** Records a submission and keeps the test page in place. */
function record(event: SubmitEvent) {
	event.preventDefault();
	let form = event.target as HTMLFormElement;
	let data = new FormData(form, event.submitter);
	submitted.push(
		new URLSearchParams(
			[...data].map(([key, value]) => [key, typeof value === "string" ? value : value.name]),
		).toString(),
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

/** Mounts a picker as one item of a flex `row` beside a button, inside a host `width` pixels wide. */
function mountInRow(width: number, row: "page-header" | "flex"): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	let picker = <RangePicker value="7d" presets={PRESETS} labels={LABELS} />;
	render(
		row === "page-header" ? (
			<PageHeader
				title="Overview"
				actions={picker}
				primaryAction={<button type="button">Export</button>}
			/>
		) : (
			<div style="display: flex; align-items: center; gap: 8px">
				<button type="button">Export</button>
				{picker}
			</div>
		),
		{ container: host },
	);
	return host;
}

/** The sRGB channels a CSS color paints as, read back from a one-pixel canvas. */
function rgb(color: string): [number, number, number] {
	let canvas = document.createElement("canvas");
	canvas.width = 1;
	canvas.height = 1;
	let context = canvas.getContext("2d")!;
	context.fillStyle = color;
	context.fillRect(0, 0, 1, 1);
	let [r, g, b] = context.getImageData(0, 0, 1, 1).data;
	return [r!, g!, b!];
}

/** WCAG relative luminance of a CSS color. */
function luminance(color: string): number {
	let [r, g, b] = rgb(color).map((channel) => {
		let c = channel / 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG contrast between two opaque CSS colors. */
function contrast(one: string, other: string): number {
	let [a, z] = [luminance(one), luminance(other)];
	return (Math.max(a, z) + 0.05) / (Math.min(a, z) + 0.05);
}

/** Emulates the system color scheme, which a `.system` host follows. */
async function scheme(value: "light" | "dark") {
	await cdp().send("Emulation.setEmulatedMedia", {
		features: [{ name: "prefers-color-scheme", value }],
	});
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

afterEach(async () => {
	document.removeEventListener("submit", record);
	document.body.replaceChildren();
	for (let name of Object.keys(PALETTE)) document.documentElement.style.removeProperty(name);
	await cdp().send("Emulation.setEmulatedMedia", { features: [] });
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

	test("marks the range from the URL as pressed in the server-rendered markup", async () => {
		let html = await renderToString(<RangePicker value="7d" presets={PRESETS} labels={LABELS} />);
		let markup = new DOMParser().parseFromString(html, "text/html");
		let pressed = markup.querySelectorAll('[role="group"] button[aria-pressed="true"]');

		expect([...pressed].map((button) => button.getAttribute("value"))).toEqual(["7d"]);
		expect(markup.querySelectorAll('[role="group"] button[aria-pressed="false"]')).toHaveLength(3);
	});

	for (let mode of ["light", "dark"] as const) {
		test(`draws the pressed segment apart from the track and the rest in ${mode}`, async () => {
			for (let [name, value] of Object.entries(PALETTE)) {
				document.documentElement.style.setProperty(name, value);
			}
			await scheme(mode);
			let host = mount(640);
			host.className = "system";
			let track = getComputedStyle(host.querySelector('[role="group"]')!).backgroundColor;
			let selected = getComputedStyle(host.querySelector('button[value="7d"]')!);
			let resting = getComputedStyle(host.querySelector('button[value="24h"]')!);
			let drawn = selected.borderTopStyle !== "none" && parseFloat(selected.borderTopWidth) > 0;
			let step = Math.max(
				contrast(selected.backgroundColor, track),
				drawn ? contrast(selected.borderTopColor, track) : 1,
			);

			expect(step).toBeGreaterThanOrEqual(3);
			expect(selected.backgroundColor).not.toBe(resting.backgroundColor);
			expect(selected.borderTopColor).not.toBe(resting.borderTopColor);
			expect(Number(selected.fontWeight)).toBeGreaterThan(Number(resting.fontWeight));
			expect(selected.color).not.toBe(resting.color);
		});
	}

	test("draws a hover on a resting segment that differs from the pressed one", async () => {
		let host = mount(640);
		let selected = getComputedStyle(host.querySelector('button[value="7d"]')!);
		let resting = host.querySelector<HTMLButtonElement>('button[value="24h"]')!;
		let before = getComputedStyle(resting).backgroundColor;

		await userEvent.hover(resting);
		let hovered = getComputedStyle(resting);
		expect(hovered.backgroundColor).not.toBe(before);
		expect(hovered.backgroundColor).not.toBe(selected.backgroundColor);
		expect(hovered.borderTopColor).not.toBe(selected.borderTopColor);
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

	for (let row of ["page-header", "flex"] as const) {
		test(`sizes to its segments as an auto-width item of a ${row} row`, () => {
			let host = mountInRow(1024, row);
			let picker = host.querySelector<HTMLElement>('[data-slot="range-picker"]')!;
			let group = host.querySelector<HTMLElement>('[role="group"]')!;
			let box = picker.getBoundingClientRect();
			let segments = group.getBoundingClientRect();

			expect(box.width).toBeGreaterThan(0);
			expect(shown(group)).toBe(true);
			expect(shown(host.querySelector("select"))).toBe(false);
			expect(segments.left).toBeGreaterThanOrEqual(box.left - 0.5);
			expect(segments.right).toBeLessThanOrEqual(box.right + 0.5);
			expect(box.width).toBeLessThan(1024);
		});

		test(`becomes a select as an item of a narrow ${row} row, with nothing overflowing`, () => {
			let host = mountInRow(280, row);
			let select = host.querySelector("select")!;

			expect(shown(select)).toBe(true);
			expect(select.getBoundingClientRect().width).toBeGreaterThan(0);
			expect(host.scrollWidth).toBeLessThanOrEqual(280);
		});
	}
});
