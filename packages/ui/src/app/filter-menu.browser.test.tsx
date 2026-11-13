/**
 * Drives the filter menu in a real browser, as server HTML alone and hydrated: links, radios
 * and checkboxes with their no-script filter and Save, filter-as-you-type, the arrow keys and
 * Enter, submit on close, a 2,000-item list kept to a small page, both themes and a phone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RemixNode } from "remix/component";

import { run } from "remix/component";
import { renderToString } from "remix/component/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";

import { PropertyList } from "../components/property-list.js";

import { FilterMenu, FilterMenuList } from "./filter-menu.js";

import "../reset.css";
import "../theme.css";

const LABELS: FilterMenu.Labels = {
	title: "Switch branches/tags",
	filter: "Filter branches",
	empty: "Nothing to show",
	more: "{count} more, refine your filter",
	save: "Save",
	tabs: "Ref type",
};

const BRANCHES: FilterMenu.Item[] = [
	{ value: "feat/diff", label: "feat/diff", href: "/tree/feat/diff" },
	{ value: "main", label: "main", href: "/tree/main", badge: "default", selected: true },
	{ value: "fix/résumé", label: "fix/résumé", href: "/tree/fix/resume" },
	{ value: "feat/menu", label: "feat/menu", href: "/tree/feat/menu" },
];

const TAGS: FilterMenu.Item[] = [
	{ value: "v1.0.0", label: "v1.0.0", href: "/tree/v1.0.0" },
	{ value: "v1.1.0", label: "v1.1.0", href: "/tree/v1.1.0" },
];

const ISSUE_LABELS: FilterMenu.Item[] = [
	{ value: "bug", label: "bug", color: "#d73a4a", description: "Something isn't working" },
	{ value: "docs", label: "docs", color: "#0075ca" },
	{ value: "feature", label: "feature", color: "#a2eeef", selected: true },
	{ value: "help", label: "help wanted", color: "#008672" },
];

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
	}).flatMap(([step, l]) => [
		[`--ui-color-neutral-${step}`, `oklch(${l} 0.012 275)`],
		[`--ui-color-brand-${step}`, `oklch(${l} 0.16 255)`],
	]),
);

let app: ReturnType<typeof run> | undefined;

/** Every submit a picker made, as the fields it sent; the page itself never navigates. */
let submitted: [string, string][][] = [];

/** Every link the test followed, by its address; the page itself never navigates. */
let followed: string[] = [];

/** Records a submit or a followed link instead of letting it leave the page. */
let controller: AbortController;

/** Writes the server's HTML for `node` into the page, with no script attached. */
async function serve(node: RemixNode): Promise<HTMLElement> {
	let host = document.createElement("div");
	host.innerHTML = await renderToString(node);
	document.body.appendChild(host);
	return host;
}

/** Serves `node` and hydrates its island, as the app's browser entry does. */
async function hydrate(node: RemixNode): Promise<HTMLElement> {
	let host = await serve(node);
	let errors = vi.spyOn(console, "error").mockImplementation(() => {});
	app = run({ loadModule: () => FilterMenuList });
	await app.ready();
	await settle();
	let calls = errors.mock.calls;
	errors.mockRestore();
	expect(calls).toEqual([]);
	return host;
}

/** Waits for queued renders and the next frame. */
async function settle(): Promise<void> {
	await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

/** The branch picker: links, Branches | Tags tabs, a no-script filter page and a footer. */
function branchPicker(): RemixNode {
	return (
		<FilterMenu
			id="ref"
			mode="navigate"
			tabs
			trigger="main"
			groups={[
				{ label: "Branches", items: BRANCHES },
				{ label: "Tags", items: TAGS },
			]}
			filterAction="/branches"
			footer={<a href="/branches">View all branches</a>}
			labels={LABELS}
		/>
	);
}

/** A labels picker posting `label` to the issue. */
function labelPicker(mode: "single" | "multiple" = "multiple"): RemixNode {
	return (
		<FilterMenu
			id="labels"
			mode={mode}
			name="label"
			action="/issues/7/labels"
			trigger="Labels"
			groups={[{ label: "Labels", items: ISSUE_LABELS }]}
			labels={{ ...LABELS, title: "Apply labels", filter: "Filter labels" }}
		/>
	);
}

/** Rows the list draws and the reader can see, by label text. */
function visibleRows(menu: HTMLElement): string[] {
	return [...menu.querySelectorAll<HTMLElement>('[data-slot="filter-menu-row"]')]
		.filter((row) => row.checkVisibility())
		.map((row) => row.textContent?.trim() ?? "");
}

/** Opens the menu from its trigger, as a pointer does. */
async function open(id: string): Promise<HTMLElement> {
	await userEvent.click(document.getElementById(`${id}-trigger`)!);
	let menu = document.getElementById(id)!;
	await expect.poll(() => menu.matches(":popover-open")).toBe(true);
	return menu;
}

/** WCAG contrast between two opaque CSS colors, read back as painted from a canvas. */
function contrast(one: string, other: string): number {
	let [a, z] = [one, other].map((color) => {
		let canvas = document.createElement("canvas");
		canvas.width = 1;
		canvas.height = 1;
		let context = canvas.getContext("2d")!;
		context.fillStyle = color;
		context.fillRect(0, 0, 1, 1);
		let [r, g, b] = [...context.getImageData(0, 0, 1, 1).data].map((channel) => {
			let c = channel / 255;
			return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
		});
		return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
	});
	return (Math.max(a!, z!) + 0.05) / (Math.min(a!, z!) + 0.05);
}

beforeEach(async () => {
	await page.viewport(1024, 768);
	submitted = [];
	followed = [];
	controller = new AbortController();
	document.addEventListener(
		"submit",
		(event) => {
			event.preventDefault();
			let form = event.target as HTMLFormElement;
			submitted.push(
				[...new FormData(form, event.submitter)].map(([name, value]) => [
					name,
					typeof value === "string" ? value : value.name,
				]),
			);
		},
		{ signal: controller.signal },
	);
	document.addEventListener(
		"click",
		(event) => {
			let link = (event.target as Element).closest("a");
			if (!link) return;
			event.preventDefault();
			followed.push(link.getAttribute("href") ?? "");
		},
		{ signal: controller.signal },
	);
});

afterEach(async () => {
	controller.abort();
	app?.dispose();
	app = undefined;
	document.body.replaceChildren();
	document.documentElement.classList.remove("system");
	for (let name of Object.keys(PALETTE)) document.documentElement.style.removeProperty(name);
	await cdp().send("Emulation.setEmulatedMedia", { features: [] });
});

describe("FilterMenu without script", () => {
	test("navigate draws links, current first, and filters through a GET form", async () => {
		await serve(branchPicker());
		let menu = await open("ref");
		let input = menu.querySelector<HTMLInputElement>('input[type="search"]')!;

		expect(menu.getAttribute("role")).toBe("dialog");
		expect(menu.getAttribute("aria-labelledby")).toBe("ref-title");
		expect(visibleRows(menu)).toEqual(["maindefault", "feat/diff", "fix/résumé", "feat/menu"]);
		let current = menu.querySelector('[aria-current="true"]')!;
		expect(current.getAttribute("href")).toBe("/tree/main");
		expect(input.checkVisibility()).toBe(true);
		expect(input.name).toBe("q");
		expect(input.form?.method).toBe("get");
		expect(new URL(input.form!.action).pathname).toBe("/branches");
		expect(menu.querySelector('[data-slot="filter-menu-save"]')).toBeNull();
		expect(menu.querySelector('[data-slot="filter-menu-footer"] a')?.getAttribute("href")).toBe(
			"/branches",
		);
	});

	test("tabs switch panels with CSS alone", async () => {
		await serve(branchPicker());
		let menu = await open("ref");

		expect(visibleRows(menu)).not.toContain("v1.0.0");
		await userEvent.click(
			menu.querySelector<HTMLElement>('[data-slot="filter-menu-tab"]:last-child')!,
		);

		expect(visibleRows(menu)).toEqual(["v1.0.0", "v1.1.0"]);
		let tab = menu.querySelector<HTMLInputElement>('input[data-tab-index="1"]')!;
		expect(tab.form?.id).toBe("ref-filter-form");
	});

	test("single and multiple are a plain form with a Save button", async () => {
		await serve(labelPicker("multiple"));
		let menu = await open("labels");
		let form = menu.querySelector<HTMLFormElement>('[data-slot="filter-menu-form"]')!;
		let save = menu.querySelector<HTMLButtonElement>('[data-slot="filter-menu-save"]')!;

		expect(form.method).toBe("post");
		expect(new URL(form.action).pathname).toBe("/issues/7/labels");
		expect(visibleRows(menu)[0]).toBe("feature");
		expect(menu.querySelector('input[type="search"]')!.checkVisibility()).toBe(false);
		await userEvent.click(menu.querySelector<HTMLElement>('input[name="label"][value="bug"]')!);
		await userEvent.click(save);

		expect(submitted).toEqual([
			[
				["label", "feature"],
				["label", "bug"],
			],
		]);
	});

	test("single posts one radio", async () => {
		await serve(labelPicker("single"));
		let menu = await open("labels");
		let radios = menu.querySelectorAll<HTMLInputElement>('input[type="radio"][name="label"]');

		expect(radios).toHaveLength(4);
		expect(radios[0]!.checked).toBe(true);
		await userEvent.click(radios[2]!.closest("label")!);
		await userEvent.click(menu.querySelector<HTMLElement>('[data-slot="filter-menu-save"]')!);

		expect(submitted).toEqual([[["label", "docs"]]]);
	});
});

describe("FilterMenu with its island", () => {
	test("focuses the filter, hides rows as you type, ignoring case and accents", async () => {
		await hydrate(branchPicker());
		let menu = await open("ref");
		let input = menu.querySelector<HTMLInputElement>('input[type="search"]')!;

		expect(document.activeElement).toBe(input);
		await userEvent.keyboard("RESUME");
		await settle();

		expect(input.value).toBe("RESUME");
		expect(visibleRows(menu)).toEqual(["fix/résumé"]);
		await userEvent.keyboard("zzz");
		expect(visibleRows(menu)).toEqual([]);
		expect(menu.querySelector('[data-slot="filter-menu-empty"]')!.checkVisibility()).toBe(true);
	});

	test("arrows move a highlighted row with an accent bar, and Enter follows it", async () => {
		await hydrate(branchPicker());
		let menu = await open("ref");
		let input = menu.querySelector<HTMLInputElement>('input[type="search"]')!;

		await userEvent.keyboard("feat");
		let active = menu.querySelector<HTMLElement>("[data-active]")!;
		expect(active.textContent).toBe("feat/diff");
		expect(input.getAttribute("aria-activedescendant")).toBe(active.id);

		await userEvent.keyboard("{ArrowDown}");
		active = menu.querySelector<HTMLElement>("[data-active]")!;
		expect(active.textContent).toBe("feat/menu");
		let bar = getComputedStyle(active, "::before");
		expect(bar.width).toBe("4px");

		await userEvent.keyboard("{ArrowDown}");
		expect(menu.querySelector("[data-active]")!.textContent).toBe("feat/diff");
		await userEvent.keyboard("{ArrowUp}{Enter}");
		expect(followed).toEqual(["/tree/feat/menu"]);
	});

	test("the arrows walk only the open tab", async () => {
		await hydrate(branchPicker());
		let menu = await open("ref");

		await userEvent.click(
			menu.querySelector<HTMLElement>('[data-slot="filter-menu-tab"]:last-child')!,
		);
		menu.querySelector<HTMLInputElement>('input[type="search"]')!.focus();
		await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");

		expect(menu.querySelector("[data-active]")!.textContent).toBe("v1.0.0");
		expect(visibleRows(menu)).toEqual(["v1.0.0", "v1.1.0"]);
	});

	test("drops the Save button and submits multiple once, on close, with held picks", async () => {
		await hydrate(labelPicker("multiple"));
		let menu = await open("labels");

		expect(menu.querySelector('[data-slot="filter-menu-save"]')).toBeNull();
		await userEvent.keyboard("bug");
		await userEvent.keyboard("{ArrowDown}{Enter}");
		await settle();
		expect(menu.querySelector<HTMLInputElement>('input[name="label"][value="bug"]')!.checked).toBe(
			true,
		);

		await userEvent.keyboard("{Backspace}{Backspace}{Backspace}help");
		await settle();
		expect(menu.querySelector('input[type="hidden"][value="bug"]')).not.toBeNull();
		await userEvent.click(menu.querySelector<HTMLElement>('input[name="label"][value="help"]')!);
		expect(menu.querySelector<HTMLInputElement>('input[name="label"][value="help"]')!.checked).toBe(
			true,
		);
		expect(submitted).toEqual([]);

		await userEvent.keyboard("{Escape}");
		await expect.poll(() => submitted.length).toBe(1);
		expect(submitted[0]!.map(([, value]) => value).sort()).toEqual(["bug", "feature", "help"]);
	});

	test("closing an unchanged picker posts nothing", async () => {
		await hydrate(labelPicker("multiple"));
		let menu = await open("labels");

		await userEvent.click(menu.querySelector<HTMLElement>('input[name="label"][value="bug"]')!);
		await userEvent.click(menu.querySelector<HTMLElement>('input[name="label"][value="bug"]')!);
		await userEvent.keyboard("{Escape}");
		await settle();

		expect(menu.matches(":popover-open")).toBe(false);
		expect(submitted).toEqual([]);
	});

	test("single picks with Enter, closes and submits the one value", async () => {
		await hydrate(labelPicker("single"));
		let menu = await open("labels");

		await userEvent.keyboard("docs{Enter}");
		await expect.poll(() => menu.matches(":popover-open")).toBe(false);
		await expect.poll(() => submitted).toEqual([[["label", "docs"]]]);
	});

	test("single closes and submits on a pointer pick", async () => {
		await hydrate(labelPicker("single"));
		let menu = await open("labels");

		await userEvent.click(
			menu.querySelector<HTMLInputElement>('input[name="label"][value="help"]')!.closest("label")!,
		);
		await expect.poll(() => submitted).toEqual([[["label", "help"]]]);
		expect(menu.matches(":popover-open")).toBe(false);
	});

	test("coloured items draw a LabelChip dot, with their description", async () => {
		await hydrate(labelPicker());
		let menu = await open("labels");
		let bug = menu
			.querySelector('input[name="label"][value="bug"]')!
			.closest('[data-slot="filter-menu-row"]')!;

		expect(bug.querySelector('[data-slot="label-chip"][data-variant="dot"]')?.textContent).toBe(
			"bug",
		);
		expect(bug.textContent).toContain("Something isn't working");
		expect((bug as HTMLElement).getBoundingClientRect().height).toBeGreaterThanOrEqual(32);
	});
});

describe("FilterMenu in a property row", () => {
	test("opens under the row's value button and saves on close", async () => {
		await hydrate(
			<PropertyList>
				<PropertyList.Item
					label="Labels"
					empty="None yet"
					edit={{
						id: "edit-labels",
						label: "Edit labels",
						popover: (
							<FilterMenu.Popover
								id="edit-labels"
								mode="multiple"
								name="label"
								action="/issues/7/labels"
								groups={[{ label: "Labels", items: ISSUE_LABELS }]}
								labels={{ ...LABELS, title: undefined, filter: "Filter labels" }}
							/>
						),
					}}
				>
					feature
				</PropertyList.Item>
			</PropertyList>,
		);
		let button = document.querySelector<HTMLElement>('[data-slot="property-edit"]')!;
		await userEvent.click(button);
		let menu = document.getElementById("edit-labels")!;
		await expect.poll(() => menu.matches(":popover-open")).toBe(true);

		expect(document.querySelector('[data-slot="property-popover"]')).toBeNull();
		expect(menu.getBoundingClientRect().top).toBeGreaterThanOrEqual(
			button.getBoundingClientRect().bottom,
		);
		expect(document.activeElement).toBe(menu.querySelector('input[type="search"]'));
		await userEvent.keyboard("doc{Enter}{Escape}");
		await expect.poll(() => submitted.length).toBe(1);
		expect(submitted[0]!.map(([, value]) => value).sort()).toEqual(["docs", "feature"]);
	});
});

describe("FilterMenu with a long list", () => {
	/** 2,000 branches, the kind of list a big repository's picker holds. */
	const MANY: FilterMenu.Item[] = Array.from({ length: 2000 }, (_, index) => ({
		value: `branch-${index}`,
		label: `branch-${index}`,
		href: `/tree/branch-${index}`,
		selected: index === 1500,
	}));

	test("draws at most 100 rows and counts the rest, with and without script", async () => {
		let node = (
			<FilterMenu
				id="many"
				mode="navigate"
				trigger="branch-1500"
				groups={[{ label: "Branches", items: MANY }]}
				labels={LABELS}
			/>
		);
		let served = await serve(node);
		expect(served.querySelectorAll('[data-slot="filter-menu-row"]')).toHaveLength(100);
		expect(served.querySelector('[data-slot="filter-menu-row"]')!.textContent).toBe("branch-1500");
		served.remove();

		await hydrate(node);
		let menu = await open("many");
		expect(menu.querySelectorAll('[data-slot="filter-menu-row"]')).toHaveLength(100);
		expect(menu.querySelector('[data-slot="filter-menu-more"]')!.textContent).toBe(
			"1,900 more, refine your filter",
		);

		let started = performance.now();
		await userEvent.keyboard("branch-19");
		await settle();
		let elapsed = performance.now() - started;

		expect(menu.querySelectorAll('[data-slot="filter-menu-row"]').length).toBeLessThanOrEqual(100);
		expect(visibleRows(menu)[0]).toBe("branch-19");
		expect(menu.querySelector('[data-slot="filter-menu-more"]')!.textContent).toBe(
			"11 more, refine your filter",
		);
		expect(elapsed).toBeLessThan(2000);
		expect(document.querySelectorAll("*").length).toBeLessThan(1500);
	});
});

describe("FilterMenu's look", () => {
	for (let mode of ["light", "dark"] as const) {
		test(`draws the highlighted row apart from the surface in ${mode}`, async () => {
			for (let [name, value] of Object.entries(PALETTE)) {
				document.documentElement.style.setProperty(name, value);
			}
			document.documentElement.classList.add("system");
			await cdp().send("Emulation.setEmulatedMedia", {
				features: [{ name: "prefers-color-scheme", value: mode }],
			});
			await hydrate(branchPicker());
			let menu = await open("ref");
			await userEvent.keyboard("{ArrowDown}");
			let active = menu.querySelector<HTMLElement>("[data-active]")!;
			let surface = getComputedStyle(menu).backgroundColor;

			expect(getComputedStyle(active).backgroundColor).not.toBe(surface);
			expect(contrast(getComputedStyle(active).color, surface)).toBeGreaterThanOrEqual(4.5);
			expect(
				contrast(getComputedStyle(active, "::before").backgroundColor, surface),
			).toBeGreaterThanOrEqual(3);
		});
	}

	test("opens under its trigger, 320px wide, on a desktop", async () => {
		await hydrate(branchPicker());
		let trigger = document.getElementById("ref-trigger")!.getBoundingClientRect();
		let menu = (await open("ref")).getBoundingClientRect();

		expect(menu.width).toBe(320);
		expect(menu.top).toBeGreaterThanOrEqual(trigger.bottom);
		expect(Math.abs(menu.left - trigger.left)).toBeLessThan(1);
	});

	test("is a full-width bottom sheet at 375", async () => {
		await page.viewport(375, 700);
		await hydrate(branchPicker());
		let menu = await open("ref");
		let box = menu.getBoundingClientRect();

		expect(box.width).toBe(375);
		expect(box.left).toBe(0);
		expect(Math.round(box.bottom)).toBe(700);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
	});
});
