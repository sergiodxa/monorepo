/**
 * Reads and reviews a change in a real browser: unified and split rows, word marks, the split
 * view laid out as unified on a phone without sideways scroll, collapse and "Viewed", the `+`
 * link and a drag across numbers asking for a comment, threads between rows, and dark.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { diffLines } from "@sdxc/diff";
import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, onTestFinished, test } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";

import { DIFF_COMMENT_EVENT, Diff } from "./diff.js";

import "../reset.css";
import "../theme.css";

const LABELS: Diff.FileLabels = {
	columns: {
		oldNumber: "Original file line number",
		newNumber: "Diff line number",
		oldText: "Original file line",
		change: "Diff line change",
	},
	expandContext: "Expand context",
	addComment: (side, line) => `Comment on line ${side}${line}`,
	copyPath: "Copy file path",
	statuses: {
		added: "Added",
		modified: "Modified",
		deleted: "Deleted",
		renamed: "Renamed",
		copied: "Copied",
	},
	changes: (additions, deletions) => `${additions} additions, ${deletions} deletions`,
	binary: "Binary file not shown.",
	tooLarge: "Large diff not shown.",
	largeDiff: "Large diffs are not rendered by default.",
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

/** A 30-line module before the change. */
const BEFORE = Array.from(
	{ length: 30 },
	(_, index) => `let value${index + 1} = ${index + 1};`,
).join("\n");

/** The module after: line 5 changes one number, line 10 grows long enough to wrap, line 20 goes. */
const AFTER = BEFORE.split("\n")
	.map((line, index) => {
		if (index === 4) return "let value5 = 50;";
		if (index === 9)
			return `let value10 = "${"a fairly long string that keeps going ".repeat(4)}";`;
		return line;
	})
	.filter((_, index) => index !== 19)
	.join("\n");

/** The change's hunks, as `@sdxc/diff` computes them. */
const HUNKS = diffLines(BEFORE, AFTER).hunks;

/**
 * Nodes per unchanged `let valueN = N;`: six of chrome (row, three cells, two number links),
 * four highlighted runs at two nodes each and two plain runs make 16, plus one of slack. A
 * sign cell, a row component or a text node per number breaks it.
 */
const NODES_PER_LINE_CEILING = 17;

/** The address the page started on, restored after each test. */
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

/** Mounts one file of the change inside a page root and returns the file's card. */
function mount(props: Partial<Diff.FileProps> = {}): HTMLElement {
	mounted = render(
		<Diff labels={{ copied: "Copied" }}>
			<Diff.File
				id="diff-routes"
				path="app/routes.ts"
				status="modified"
				additions={2}
				deletions={3}
				hunks={HUNKS}
				language="ts"
				commentHref={(path, side, line) => `/comment?path=${path}&line=${side}${line}`}
				labels={LABELS}
				{...props}
			/>
		</Diff>,
	);
	return document.querySelector<HTMLElement>('[data-slot="diff-file"]')!;
}

/** The number link of `side` line `line`. */
function number(side: "L" | "R", line: number): HTMLAnchorElement {
	return document.getElementById(`diff-routes${side}${line}`) as HTMLAnchorElement;
}

/** The code cell beside `side` line `line`'s number in the unified view. */
function code(side: "L" | "R", line: number): HTMLElement {
	return number(side, line).closest("tr")!.lastElementChild as HTMLElement;
}

/** The cell after the one holding `side` line `line`'s number, its code in the split view. */
function splitCode(side: "L" | "R", line: number): HTMLElement {
	return number(side, line).closest("td")!.nextElementSibling as HTMLElement;
}

/**
 * Waits two frames, so chunks under `content-visibility: auto` are laid out and hit-testable
 * as they are once a reader can point at them.
 */
function frames(): Promise<void> {
	return new Promise((resolve) =>
		requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
	);
}

/** The centre of an element, in viewport coordinates. */
function centre(element: Element): { clientX: number; clientY: number } {
	let box = element.getBoundingClientRect();
	return { clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 };
}

describe("Diff unified view", () => {
	test("quotes unchanged lines with one number column", () => {
		mounted = render(
			<Diff.Hunks
				path="app/routes.ts"
				anchored={false}
				labels={LABELS}
				hunks={[
					{
						oldStart: 40,
						oldLines: 2,
						newStart: 40,
						newLines: 2,
						lines: [
							{ kind: "context", old: 40, new: 40, text: "let a = 1;" },
							{ kind: "context", old: 41, new: 41, text: "let b = 2;" },
						],
					},
				]}
			/>,
		);
		let numbers = [...document.querySelectorAll<HTMLElement>("[data-line-number]")].filter((cell) =>
			cell.checkVisibility(),
		);
		expect(numbers.map((cell) => cell.dataset.lineNumber)).toEqual(["40", "41"]);
		expect(document.querySelector("tbody td:nth-child(2)")!.getBoundingClientRect().left).toBe(
			document.querySelector("tbody")!.getBoundingClientRect().left,
		);
	});

	test("draws every character as typed, with no ligatures", () => {
		mount();
		expect(getComputedStyle(code("R", 5)).fontVariantLigatures).toBe("none");
	});

	test("colours added and deleted rows and paints their signs, keeping numbers out of the text", () => {
		mount();
		let added = code("R", 5);
		let deleted = code("L", 5);
		let context = code("R", 4);

		expect(getComputedStyle(added).backgroundColor).not.toBe(
			getComputedStyle(context).backgroundColor,
		);
		expect(getComputedStyle(deleted).backgroundColor).not.toBe(
			getComputedStyle(added).backgroundColor,
		);
		expect(getComputedStyle(added, "::before").content).toBe('"+"');
		expect(getComputedStyle(deleted, "::before").content).toBe('"-"');
		expect(number("R", 5).textContent).toBe("");
		expect(getComputedStyle(number("R", 5), "::before").content).toBe('"5"');
	});

	test("marks the changed word stronger than its line", () => {
		mount();
		let mark = code("R", 5).querySelector("mark")!;

		expect(mark.textContent).toBe("50");
		expect(getComputedStyle(mark).backgroundColor).not.toBe(
			getComputedStyle(code("R", 5)).backgroundColor,
		);
		expect(code("L", 5).querySelector("mark")!.textContent).toBe("5");
	});

	test("draws the hunk header with its expand link across the row", () => {
		mount({ expandHref: (_, index) => `?expand=${index}` });
		let header = document.querySelector<HTMLElement>("tr[data-hunk] > td")!;

		expect(header.textContent).toContain("@@ -2,");
		expect(header.querySelector("a")!.getAttribute("href")).toBe("?expand=0");
		expect(header.getBoundingClientRect().width).toBeCloseTo(
			document.querySelector('[data-slot="diff-scroll"]')!.getBoundingClientRect().width,
			0,
		);
	});
});

describe("Diff split view", () => {
	test("pairs a deletion with its addition on one row, old on the start side", () => {
		mount({ view: "split" });
		let old = splitCode("L", 5).getBoundingClientRect();
		let next = splitCode("R", 5).getBoundingClientRect();

		expect(old.top).toBeCloseTo(next.top, 0);
		expect(old.right).toBeLessThanOrEqual(next.left);
		expect(splitCode("R", 5).querySelector("mark")!.textContent).toBe("50");
	});

	test("lays the same rows out as unified at 375, without scrolling the page sideways", async () => {
		await page.viewport(375, 812);
		mount({ view: "split" });
		let old = splitCode("L", 5).getBoundingClientRect();
		let next = splitCode("R", 5).getBoundingClientRect();
		let contextOld = splitCode("L", 4);

		expect(next.top).toBeGreaterThanOrEqual(old.bottom - 1);
		expect(old.left).toBeCloseTo(next.left, 0);
		expect(getComputedStyle(contextOld).display).toBe("none");
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
	});
});

describe("Diff toolbar", () => {
	test("pads each view segment so its label sits inside the raised tile", () => {
		mounted = render(
			<Diff labels={{ copied: "Copied" }}>
				<Diff.Toolbar
					view="unified"
					unifiedHref="?diff=unified"
					splitHref="?diff=split"
					labels={{
						view: "Diff view",
						unified: "Unified",
						split: "Split",
						filesViewed: "files viewed",
					}}
				/>
			</Diff>,
		);
		let segments = document.querySelectorAll<HTMLElement>('[data-slot="diff-toolbar"] nav a');
		expect(segments).toHaveLength(2);
		for (let segment of segments) {
			let style = getComputedStyle(segment);
			expect(Number.parseFloat(style.paddingInlineStart)).toBeGreaterThanOrEqual(8);
			expect(segment.getBoundingClientRect().height).toBeGreaterThanOrEqual(26);
		}
	});
});

describe("Diff file card", () => {
	test("turns its chevron without motion under reduced motion", async () => {
		await cdp().send("Emulation.setEmulatedMedia", {
			features: [{ name: "prefers-reduced-motion", value: "reduce" }],
		});
		onTestFinished(async () => {
			await cdp().send("Emulation.setEmulatedMedia", { features: [] });
		});
		let card = mount();
		let chevron = card.querySelector<SVGElement>("summary svg")!;
		expect(getComputedStyle(chevron).transitionDuration).toBe("0s");
	});

	test("reaches the header's actions by Tab before the file's lines, and draws them on top", () => {
		let card = mount();
		let actions = card.querySelector<HTMLElement>('[data-slot="diff-file-actions"]')!;
		let line = card.querySelector("a[data-line-number]")!;
		let box = actions.getBoundingClientRect();

		expect(actions.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(
			actions.contains(document.elementFromPoint(box.right - 4, box.top + box.height / 2)),
		).toBe(true);
	});

	test("collapses through its summary and keeps the actions on the header's row", async () => {
		let card = mount();
		let details = card.querySelector("details")!;
		let summary = card.querySelector("summary")!.getBoundingClientRect();
		let actions = card.querySelector('[data-slot="diff-file-actions"]')!.getBoundingClientRect();

		expect(actions.top).toBeGreaterThanOrEqual(summary.top - 1);
		expect(actions.bottom).toBeLessThanOrEqual(summary.bottom + 1);
		expect(actions.left).toBeGreaterThanOrEqual(summary.right - 1);

		await userEvent.click(card.querySelector("summary")!);
		expect(details.open).toBe(false);
	});

	test("renders a viewed file closed, its header still showing the counts", () => {
		let card = mount({ viewed: true });
		expect(card.querySelector("details")!.open).toBe(false);
		expect(card.querySelector('[data-slot="diff-file-counts"]')!.textContent).toContain("+2");
	});

	test("shows the copy button once the island runs", () => {
		let card = mount();
		let copy = card.querySelector<HTMLElement>('[data-action="copy-path"]')!;
		expect(getComputedStyle(copy).display).not.toBe("none");
	});
});

describe("Diff comments", () => {
	test("puts a table's line links in one Tab stop the arrow keys walk", async () => {
		let card = mount();
		let links = () => [
			...card.querySelectorAll<HTMLElement>("a[data-line-number], a[data-comment]"),
		];
		let first = links().find((link) => link.tabIndex === 0)!;

		expect(links().filter((link) => link.tabIndex === 0)).toEqual([first]);
		first.focus();
		await userEvent.keyboard("{ArrowDown}");
		let below = document.activeElement as HTMLElement;
		expect(below.matches("a[data-line-number]")).toBe(true);
		expect(below.closest("td")!.cellIndex).toBe(first.closest("td")!.cellIndex);
		expect(below.closest("tr")).not.toBe(first.closest("tr"));
		await userEvent.keyboard("{ArrowRight}");
		expect(document.activeElement!.closest("tr")).toBe(below.closest("tr"));
		expect(document.activeElement).not.toBe(below);
		expect(links().filter((link) => link.tabIndex === 0)).toEqual([document.activeElement]);
	});

	test("shows a line's + on hover, linked to the comment form without script", async () => {
		mount();
		let plus = code("R", 5).querySelector<HTMLAnchorElement>("a[data-comment]")!;

		expect(plus.getAttribute("href")).toBe("/comment?path=app/routes.ts&line=R5");
		expect(getComputedStyle(plus).opacity).toBe("0");
		await userEvent.hover(code("R", 5));
		await expect.poll(() => getComputedStyle(plus).opacity).toBe("1");
	});

	test("asks for a comment on the + line without following its link", async () => {
		let card = mount();
		let details: Diff.CommentDetail[] = [];
		card.addEventListener(DIFF_COMMENT_EVENT, ({ path, side, start, end }) => {
			details.push({ path, side, start, end });
		});
		let plus = code("L", 5).querySelector<HTMLAnchorElement>("a[data-comment]")!;

		await userEvent.hover(code("L", 5));
		await userEvent.click(plus);

		expect(details).toEqual([{ path: "app/routes.ts", side: "L", start: 5, end: 5 }]);
		expect(location.href).toBe(START);
	});

	test("asks for the range a drag across numbers covers, painting it as it moves", async () => {
		let card = mount();
		await frames();
		let details: Diff.CommentDetail[] = [];
		card.addEventListener(DIFF_COMMENT_EVENT, ({ path, side, start, end }) => {
			details.push({ path, side, start, end });
		});
		let start = number("R", 6);
		let end = number("R", 3);
		let init = { bubbles: true, button: 0, pointerId: 1, isPrimary: true };

		start.dispatchEvent(new PointerEvent("pointerdown", { ...init, ...centre(start) }));
		start.dispatchEvent(new PointerEvent("pointermove", { ...init, ...centre(end) }));
		let painted = [...card.querySelectorAll("tr[data-selected] a[id*='R']")].map((link) => link.id);
		end.dispatchEvent(new PointerEvent("pointerup", { ...init, ...centre(end) }));

		expect(painted).toEqual(["diff-routesR3", "diff-routesR4", "diff-routesR5", "diff-routesR6"]);
		expect(details).toEqual([{ path: "app/routes.ts", side: "R", start: 3, end: 6 }]);
	});
});

describe("Diff threads", () => {
	test("draws a thread full width after its line, in either view", () => {
		for (let view of ["unified", "split"] as const) {
			mount({ view, threads: { R5: <p data-testid="thread">Why 50?</p> } });
			let thread = document.querySelector<HTMLElement>('[data-testid="thread"]')!;
			let row = thread.closest("tr")!;
			let table = document.querySelector("table")!.getBoundingClientRect();

			expect(row.previousElementSibling!.contains(number("R", 5))).toBe(true);
			expect(thread.closest("td")!.getBoundingClientRect().width).toBeCloseTo(table.width, 0);
			mounted?.cleanup();
			document.body.replaceChildren();
		}
	});
});

describe("Diff themes and size", () => {
	test("is designed in dark as in light", () => {
		mount();
		let added = code("R", 5);
		let keyword = code("R", 4).querySelector<HTMLElement>(".token.keyword")!;
		let lightAdded = getComputedStyle(added).backgroundColor;
		let lightKeyword = getComputedStyle(keyword).color;

		document.documentElement.classList.add("dark");

		expect(getComputedStyle(added).backgroundColor).not.toBe(lightAdded);
		expect(getComputedStyle(keyword).color).not.toBe(lightKeyword);
	});

	test("keeps every line of a 10,000-line file in the document within a node budget, in skippable chunks", () => {
		let lines = Array.from({ length: 10_000 }, (_, index) => ({
			kind: "context" as const,
			old: index + 1,
			new: index + 1,
			text: `let value${index} = ${index};`,
		}));
		let card = mount({
			hunks: [{ oldStart: 1, oldLines: 10_000, newStart: 1, newLines: 10_000, lines }],
			commentHref: undefined,
		});
		let rows = [...card.querySelectorAll("tbody")];
		let nodes = 0;
		for (let chunk of rows) {
			let walker = document.createTreeWalker(chunk, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
			while (walker.nextNode()) nodes += 1;
		}
		let headerNodes = 3;

		expect(document.getElementById("diff-routesR10000")).not.toBeNull();
		expect(rows.length).toBeGreaterThanOrEqual(50);
		expect(getComputedStyle(rows[0]!).contentVisibility).toBe("auto");
		expect((nodes - headerNodes) / 10_000).toBeLessThanOrEqual(NODES_PER_LINE_CEILING);
		expect(document.querySelectorAll('[data-slot="diff-status"]')).toHaveLength(1);
	});
});
