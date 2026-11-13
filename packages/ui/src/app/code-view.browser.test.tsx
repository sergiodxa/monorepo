/**
 * Reads and cites code in a real browser: a number click selects its line, shift-click a
 * range, the address follows without a history entry, the band and line menu paint, `y`
 * and Escape answer, blame cells span their hunk, and the view holds up in dark and at 375.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import { CodeView } from "./code-view.js";

import "../reset.css";
import "../theme.css";

const LABELS: CodeView.Labels = {
	lineMenu: "Line options",
	copyLine: "Copy line",
	copyPermalink: "Copy permalink",
	referenceInNewIssue: "Reference in new issue",
	copied: "Copied",
	group: "Code",
	permalinkKey: "Expand to permalink",
};

/** Lightness of each palette step, so every tone the theme reads resolves to a real colour. */
const STEPS: Record<number, number> = {
	50: 0.97,
	100: 0.94,
	200: 0.88,
	300: 0.8,
	400: 0.7,
	500: 0.62,
	600: 0.55,
	700: 0.48,
	800: 0.4,
	900: 0.32,
	950: 0.24,
};

/** Hue and chroma per tone, as an app's palette would set them. */
const HUES: Record<string, [hue: number, chroma: number]> = {
	brand: [250, 0.15],
	neutral: [250, 0.01],
	success: [150, 0.15],
	warning: [85, 0.16],
	danger: [25, 0.2],
};

/** A 30-line module whose line 5 is long enough to wrap on a phone. */
const SOURCE = Array.from({ length: 30 }, (_, index) =>
	index === 4
		? `export const LONG = "${"a fairly long string that keeps going ".repeat(4)}";`
		: `let value${index + 1} = ${index + 1};`,
).join("\n");

/**
 * Nodes per line allowed for `let valueN = N;`: four elements of chrome (row, two cells,
 * number link), four highlighted runs at a span and a text node each, and two plain runs,
 * which is 14, plus one of slack. A row component or a text node per number would break it.
 */
const NODES_PER_LINE_CEILING = 15;

/** The address the page started on, restored after each test rewrites it. */
const START = location.href;

let mounted: RenderResult | undefined;

beforeEach(async () => {
	await page.viewport(1024, 768);
	for (let [tone, [hue, chroma]] of Object.entries(HUES)) {
		for (let [step, lightness] of Object.entries(STEPS)) {
			document.documentElement.style.setProperty(
				`--ui-color-${tone}-${step}`,
				`oklch(${lightness} ${chroma} ${hue})`,
			);
		}
	}
});

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
	document.documentElement.removeAttribute("style");
	document.documentElement.classList.remove("dark");
	history.replaceState(null, "", START);
});

/** Mounts a code view over {@link SOURCE} and returns its root. */
function mount(props: Partial<CodeView.Props> = {}): HTMLElement {
	mounted = render(
		<CodeView
			path="app/routes.ts"
			language="ts"
			code={SOURCE}
			permalink="/blob/3f2a9c1/app/routes.ts"
			issueHref="/issues/new"
			labels={LABELS}
			{...props}
		/>,
	);
	return document.querySelector<HTMLElement>('[data-slot="code-view"]')!;
}

/** Line `line`'s number link. */
function number(line: number): HTMLAnchorElement {
	return document.getElementById(`L${line}`) as HTMLAnchorElement;
}

/** Line `line`'s code cell. */
function code(line: number): HTMLElement {
	return number(line).closest("tr")!.lastElementChild as HTMLElement;
}

/** Lines whose rows are marked selected. */
function selectedLines(): number[] {
	return [...document.querySelectorAll("tr[data-selected] a[data-line-number]")].map((link) =>
		Number(link.getAttribute("data-line-number")),
	);
}

describe("CodeView selection", () => {
	test("selects a line on a number click and writes #Ln without a navigation", async () => {
		mount();
		history.replaceState({ $rmx: "kept" }, "", START);
		let entries = history.length;

		await userEvent.click(number(3));

		expect(selectedLines()).toEqual([3]);
		expect(location.hash).toBe("#L3");
		expect(history.length).toBe(entries);
		expect(history.state).toEqual({ $rmx: "kept" });
	});

	test("extends to a range on shift-click and writes #La-Lb", async () => {
		mount();

		await userEvent.click(number(3));
		await userEvent.keyboard("{Shift>}");
		await userEvent.click(number(8));
		await userEvent.keyboard("{/Shift}");

		expect(selectedLines()).toEqual([3, 4, 5, 6, 7, 8]);
		expect(location.hash).toBe("#L3-L8");
	});

	test("paints the band behind the code and an accent bar on the number", async () => {
		mount();
		let plain = getComputedStyle(code(10)).backgroundColor;

		await userEvent.click(number(4));

		expect(getComputedStyle(code(4)).backgroundColor).not.toBe(plain);
		expect(getComputedStyle(number(4).parentElement!).boxShadow).toContain("inset");
	});

	test("shows the line menu beside the first selected line", async () => {
		let root = mount();
		let menu = root.querySelector<HTMLElement>('[data-slot="code-view-line-menu"]')!;
		expect(getComputedStyle(menu).display).toBe("none");

		await userEvent.click(number(6));
		await userEvent.keyboard("{Shift>}");
		await userEvent.click(number(9));
		await userEvent.keyboard("{/Shift}");

		let button = menu.querySelector("button")!.getBoundingClientRect();
		let row = number(6).getBoundingClientRect();
		expect(getComputedStyle(menu).display).toBe("block");
		expect(Math.abs(button.top + button.height / 2 - (row.top + row.height / 2))).toBeLessThan(2);
	});

	test("copies the selected lines and the permalink from the line menu", async () => {
		let root = mount();
		let written: string[] = [];
		let spy = vi.spyOn(navigator.clipboard, "writeText").mockImplementation(async (text) => {
			written.push(text);
		});

		await userEvent.click(number(2));
		await userEvent.keyboard("{Shift>}");
		await userEvent.click(number(3));
		await userEvent.keyboard("{/Shift}");
		await userEvent.click(root.querySelector('[aria-label="Line options"]')!);
		await userEvent.click(page.getByRole("menuitem", { name: "Copy line" }));
		await userEvent.click(root.querySelector('[aria-label="Line options"]')!);
		await userEvent.click(page.getByRole("menuitem", { name: "Copy permalink" }));
		spy.mockRestore();

		expect(written[0]).toBe("let value2 = 2;\nlet value3 = 3;");
		expect(written[1]).toBe(`${location.origin}/blob/3f2a9c1/app/routes.ts#L2-L3`);
		await expect.poll(() => root.querySelector('[role="status"]')!.textContent).toBe("Copied");
	});

	test("points Reference in new issue at the permalink", async () => {
		let root = mount();

		await userEvent.click(number(7));
		let item = root.querySelector<HTMLAnchorElement>('[data-action="reference"]')!;
		item.addEventListener("click", (event) => event.preventDefault(), { once: true });
		item.click();

		let target = new URL(item.href);
		expect(target.pathname).toBe("/issues/new");
		expect(target.searchParams.get("body")).toBe(
			`${location.origin}/blob/3f2a9c1/app/routes.ts#L7`,
		);
	});

	test("reads a range from the address on load", () => {
		history.replaceState(null, "", "#L12-L14");
		mount();
		expect(selectedLines()).toEqual([12, 13, 14]);
	});

	test("paints a ?L range the server sent and keeps the query in step", async () => {
		history.replaceState(null, "", "?L=4-5#L4");
		mount({ selected: { start: 4, end: 5 } });
		expect(selectedLines()).toEqual([4]);

		await userEvent.click(number(10));
		expect(new URL(location.href).searchParams.get("L")).toBe("10");
		expect(location.hash).toBe("#L10");
	});

	test("paints a ?L range without script", () => {
		mounted = render(
			<CodeView path="a.ts" code={SOURCE} selected={{ start: 2, end: 4 }} labels={LABELS} />,
		);
		document.querySelector('[data-slot="code-view-line-menu"]')?.remove();
		expect(selectedLines()).toEqual([2, 3, 4]);
	});
});

describe("CodeView keyboard", () => {
	test("selects with Enter and extends with Shift+Enter on a focused number", async () => {
		mount();
		number(2).focus();
		await userEvent.keyboard("{Enter}");
		number(5).focus();
		await userEvent.keyboard("{Shift>}{Enter}{/Shift}");

		expect(selectedLines()).toEqual([2, 3, 4, 5]);
		expect(location.hash).toBe("#L2-L5");
	});

	test("rewrites the address to the permalink on y, keeping the lines", async () => {
		mount();
		await userEvent.click(number(3));
		await userEvent.keyboard("y");

		expect(location.pathname).toBe("/blob/3f2a9c1/app/routes.ts");
		expect(location.hash).toBe("#L3");
	});

	test("clears the selection on Escape", async () => {
		mount();
		await userEvent.click(number(3));
		await userEvent.keyboard("{Escape}");

		expect(selectedLines()).toEqual([]);
		expect(location.hash).toBe("");
	});

	test("copies only code when lines are selected with the pointer", () => {
		mount();
		let range = document.createRange();
		range.setStartBefore(number(2).closest("tr")!);
		range.setEndAfter(code(3));
		getSelection()!.removeAllRanges();
		getSelection()!.addRange(range);

		let copied = getSelection()!.toString();
		expect(copied).not.toMatch(/^\s*2/);
		expect(copied).toContain("let value2 = 2;");
		expect(copied).toContain("let value3 = 3;");
		expect(copied).not.toMatch(/\b2\s+let/);
	});
});

describe("CodeView blame", () => {
	let commit = (sha: string, date: string) => ({
		sha,
		subject: `Change ${sha}`,
		author: "Ann",
		date,
		href: `/commit/${sha}`,
	});

	test("spans each hunk's rows with one cell and colours its age strip", () => {
		mount({
			now: "2026-11-13",
			blame: [
				{ start: 1, end: 4, commit: commit("old", "2025-01-01") },
				{ start: 5, end: 30, commit: commit("new", "2026-11-10") },
			],
		});
		let cells = [...document.querySelectorAll<HTMLElement>("td[data-blame]")];
		let first = cells[0]!.getBoundingClientRect();

		expect(cells).toHaveLength(2);
		expect(first.top).toBeCloseTo(number(1).getBoundingClientRect().top, 0);
		expect(first.bottom).toBeCloseTo(number(4).getBoundingClientRect().bottom, 0);
		expect(getComputedStyle(cells[0]!).borderInlineEndColor).not.toBe(
			getComputedStyle(cells[1]!).borderInlineEndColor,
		);
		expect(cells[0]!.textContent).toContain("Change old");
	});

	test("keeps every line one line tall beside one- and two-line hunks", () => {
		mount({
			now: "2026-11-13",
			blame: [
				{ start: 1, end: 1, commit: commit("a", "2025-01-01") },
				{ start: 2, end: 3, commit: commit("b", "2025-06-01") },
				{ start: 4, end: 4, commit: commit("c", "2026-01-01") },
				{ start: 5, end: 30, commit: commit("d", "2026-11-10") },
			],
		});
		let step = number(7).getBoundingClientRect().top - number(6).getBoundingClientRect().top;
		let tops = Array.from(
			{ length: 6 },
			(_, index) => number(index + 1).getBoundingClientRect().top,
		);

		expect(tops.slice(1).map((top, index) => Math.round(top - tops[index]!))).toEqual(
			Array.from({ length: 5 }, () => Math.round(step)),
		);
		let single = document.querySelector<HTMLElement>("td[data-blame]")!;
		expect(single.querySelector("[data-slot='blame-subject']")!.getBoundingClientRect().top).toBe(
			single.querySelector("time")!.getBoundingClientRect().top,
		);
	});
});

describe("CodeView layout", () => {
	test("draws every character as typed, with no ligatures", () => {
		mount();
		expect(getComputedStyle(number(1).closest("table")!).fontVariantLigatures).toBe("none");
	});

	test("draws numbers from an attribute, so the text holds only code", () => {
		mount();
		expect(number(12).textContent).toBe("");
		expect(getComputedStyle(number(12), "::before").content).toBe('"12"');
	});

	test("is designed in dark as in light", () => {
		let root = mount();
		let keyword = root.querySelector<HTMLElement>(".token.keyword")!;
		let lightBg = getComputedStyle(root).backgroundColor;
		let lightKeyword = getComputedStyle(keyword).color;

		document.documentElement.classList.add("dark");

		expect(getComputedStyle(root).backgroundColor).not.toBe(lightBg);
		expect(getComputedStyle(keyword).color).not.toBe(lightKeyword);
	});

	test("wraps at 375 without scrolling the page sideways, numbers on the first line", async () => {
		await page.viewport(375, 812);
		mount();
		let long = code(5).getBoundingClientRect();
		let short = code(4).getBoundingClientRect();

		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
		expect(long.height).toBeGreaterThan(short.height * 2);
		expect(number(5).getBoundingClientRect().top).toBeCloseTo(long.top, 0);
	});

	test("scrolls long lines inside the view on a wide screen", async () => {
		let root = mount({ code: `let line = "${"x".repeat(400)}";` });
		let scroller = root.querySelector<HTMLElement>('[data-slot="code-view-scroll"]')!;

		await expect.poll(() => scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(1024);
	});
});

describe("CodeView on a 10,000-line file", () => {
	test("keeps every line in the document within a node budget, in skippable chunks", () => {
		let big = Array.from({ length: 10_000 }, (_, index) => `let value${index} = ${index};`).join(
			"\n",
		);
		let root = mount({ code: big });
		let table = root.querySelector("table")!;
		let walker = document.createTreeWalker(table, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
		let nodes = 0;
		while (walker.nextNode()) nodes += 1;
		let chunks = table.querySelectorAll("tbody");

		expect(document.getElementById("L10000")).not.toBeNull();
		expect(chunks).toHaveLength(50);
		expect(getComputedStyle(chunks[0]!).contentVisibility).toBe("auto");
		expect(nodes / 10_000).toBeLessThanOrEqual(NODES_PER_LINE_CEILING);
		expect(document.querySelectorAll('[data-slot="code-view-line-menu"]')).toHaveLength(1);
	});
});
