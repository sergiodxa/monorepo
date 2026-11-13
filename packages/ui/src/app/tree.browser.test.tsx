/**
 * Drives a file tree in a real browser: file rows indent under their folders and link into a
 * frame, the current file and a diff's statuses draw, the filter narrows the tree as the
 * reader types while keeping folders, and the keyboard walks rows without taking the page's keys.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";

import { shortcutRegistry } from "./behaviors/shortcuts.js";
import { Tree } from "./tree.js";

import "../reset.css";
import "../theme.css";

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

let mounted: RenderResult | undefined;

beforeEach(() => {
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
});

/** Mounts a small repository tree with `app/routes.ts` current and `docs` closed. */
function mount(options: { open?: boolean } = {}): HTMLElement {
	mounted = render(
		<div>
			<Tree.Filter tree="files" label="Filter files" action="/files" />
			<Tree id="files" aria-label="Files" frame="main">
				<Tree.Navigation labels={{ group: "Files", next: "Next file" }} />
				<Tree.Item id="app" open>
					<Tree.ItemContent>
						<Tree.ExpandButton />
						app
					</Tree.ItemContent>
					<Tree.Leaf href="/blob/app/routes.ts" name="routes.ts" path="app/routes.ts" current />
					<Tree.Leaf
						href="/blob/app/worker.ts"
						name="worker.ts"
						path="app/worker.ts"
						status="modified"
						statusLabel="Modified"
						additions={12}
						deletions={3}
					/>
				</Tree.Item>
				<Tree.Item id="docs" open={options.open}>
					<Tree.ItemContent>
						<Tree.ExpandButton />
						docs
					</Tree.ItemContent>
					<Tree.Leaf
						href="/blob/docs/guide.md"
						name="guide.md"
						path="docs/guide.md"
						status="deleted"
						statusLabel="Deleted"
					/>
				</Tree.Item>
				<Tree.Leaf href="/blob/package.json" name="package.json" />
				<Tree.NoMatches>No file matches</Tree.NoMatches>
			</Tree>
			<button type="button" id="outside">
				Outside
			</button>
		</div>,
	);
	return document.getElementById("files")!;
}

/** The row named `name`: a file link by its name, or a folder's summary by its text. */
function row(tree: HTMLElement, name: string): HTMLElement {
	let leaf = tree.querySelector<HTMLElement>(`[data-search-value="${name}"]`);
	if (leaf) return leaf;
	return [...tree.querySelectorAll<HTMLElement>("summary")].find(
		(summary) => summary.textContent?.trim() === name,
	)!;
}

/** The inline-start padding a row is drawn with, in pixels. */
function indent(element: HTMLElement): number {
	return Number.parseFloat(getComputedStyle(element).paddingInlineStart);
}

describe("Tree.Leaf", () => {
	test("is a treeitem link one level below its folder, indented under it", () => {
		let tree = mount();
		let routes = row(tree, "routes.ts");

		expect(routes.localName).toBe("a");
		expect(routes.getAttribute("role")).toBe("treeitem");
		expect(routes.getAttribute("aria-level")).toBe("2");
		expect(row(tree, "app").getAttribute("aria-level")).toBe("1");
		expect(row(tree, "package.json").getAttribute("aria-level")).toBe("1");
		expect(indent(routes)).toBeGreaterThan(indent(row(tree, "package.json")));
	});

	test("links into the tree's frame", () => {
		let tree = mount();
		expect(row(tree, "routes.ts").getAttribute("data-rmx-target")).toBe("main");
	});

	test("marks the current file by tint and an accent bar", () => {
		let tree = mount();
		let current = row(tree, "routes.ts");
		let other = row(tree, "package.json");

		expect(current.getAttribute("aria-current")).toBe("page");
		expect(other.hasAttribute("aria-current")).toBe(false);
		expect(getComputedStyle(current).backgroundColor).not.toBe(
			getComputedStyle(other).backgroundColor,
		);
		expect(getComputedStyle(current, "::before").inlineSize).toBe("2px");
	});

	test("draws a status letter with a spoken label and end-aligned counts", () => {
		let tree = mount();
		let worker = row(tree, "worker.ts");
		let letter = worker.querySelector<HTMLElement>('[data-slot="tree-status"]')!;
		let counts = worker.querySelector<HTMLElement>('[data-slot="tree-counts"]')!;

		expect(letter.textContent).toBe("M");
		expect(letter.getAttribute("aria-hidden")).toBe("true");
		expect(worker.textContent).toContain("Modified");
		expect(counts.textContent).toBe("+12−3");
		expect(getComputedStyle(counts).fontVariantNumeric).toBe("tabular-nums");
		expect(counts.getBoundingClientRect().right).toBeGreaterThan(
			worker.getBoundingClientRect().right - 64,
		);
	});

	test("tones each status differently", () => {
		let tree = mount({ open: true });
		let modified = row(tree, "worker.ts").querySelector('[data-slot="tree-status"]')!;
		let deleted = row(tree, "guide.md").querySelector('[data-slot="tree-status"]')!;

		expect(deleted.textContent).toBe("D");
		expect(getComputedStyle(modified).color).not.toBe(getComputedStyle(deleted).color);
		expect(
			getComputedStyle(row(tree, "guide.md").querySelector('[data-slot="tree-leaf-name"]')!)
				.textDecorationLine,
		).toBe("line-through");
	});
});

describe("Tree.Filter", () => {
	test("is a GET form that submits the query as ?filter=", () => {
		mount();
		let form = document.querySelector<HTMLFormElement>('[data-slot="tree-filter"]')!;
		let field = form.querySelector<HTMLInputElement>('input[type="search"]')!;

		expect(form.method).toBe("get");
		expect(field.name).toBe("filter");
		expect(field.getAttribute("aria-label")).toBe("Filter files");
	});

	test("hides files that miss the query and opens the folders holding matches", async () => {
		let tree = mount();
		let field = document.querySelector<HTMLInputElement>('input[type="search"]')!;

		await userEvent.type(field, "guide");

		expect(row(tree, "guide.md").hidden).toBe(false);
		expect(row(tree, "routes.ts").hidden).toBe(true);
		expect(row(tree, "package.json").hidden).toBe(true);
		expect(document.getElementById("docs")).toMatchObject({ open: true, hidden: false });
		expect(document.getElementById("app")!.hidden).toBe(true);
		expect(row(tree, "guide.md").getBoundingClientRect().height).toBeGreaterThan(0);
		expect(row(tree, "routes.ts").getBoundingClientRect().height).toBe(0);
	});

	test("says no file matches while a query leaves none, and hides that once it clears", async () => {
		let tree = mount();
		let field = document.querySelector<HTMLInputElement>('input[type="search"]')!;
		let note = tree.querySelector<HTMLElement>("[data-tree-no-matches]")!;

		expect(note.checkVisibility()).toBe(false);
		await userEvent.type(field, "zzz");
		expect(note.checkVisibility()).toBe(true);
		expect(note.textContent).toBe("No file matches");
		await userEvent.clear(field);
		expect(note.checkVisibility()).toBe(false);
		await userEvent.type(field, "guide");
		expect(note.checkVisibility()).toBe(false);
	});

	test("matches every term against the whole path", async () => {
		let tree = mount();
		let field = document.querySelector<HTMLInputElement>('input[type="search"]')!;

		await userEvent.type(field, "app work");

		expect(row(tree, "worker.ts").hidden).toBe(false);
		expect(row(tree, "routes.ts").hidden).toBe(true);
	});

	test("puts every folder back the way it was once the query is cleared", async () => {
		let tree = mount();
		let field = document.querySelector<HTMLInputElement>('input[type="search"]')!;

		await userEvent.type(field, "guide");
		await userEvent.clear(field);

		expect(document.getElementById("docs")).toMatchObject({ open: false, hidden: false });
		expect(document.getElementById("app")).toMatchObject({ open: true, hidden: false });
		expect(row(tree, "routes.ts").hidden).toBe(false);
	});

	test("moves into the first visible row on ArrowDown", async () => {
		let tree = mount();
		let field = document.querySelector<HTMLInputElement>('input[type="search"]')!;

		await userEvent.type(field, "package");
		await userEvent.keyboard("{ArrowDown}");

		expect(document.activeElement).toBe(row(tree, "package.json"));
	});
});

describe("Tree.Navigation", () => {
	test("leaves one Tab stop, on the current file", () => {
		let tree = mount();
		let rows = [...tree.querySelectorAll<HTMLElement>('[role="treeitem"]')];

		expect(rows.filter((candidate) => candidate.tabIndex === 0)).toEqual([row(tree, "routes.ts")]);
	});

	test("moves through visible rows with the arrows and j/k, skipping closed folders", async () => {
		let tree = mount();
		row(tree, "routes.ts").focus();

		await userEvent.keyboard("{ArrowDown}");
		expect(document.activeElement).toBe(row(tree, "worker.ts"));
		await userEvent.keyboard("{ArrowDown}");
		expect(document.activeElement).toBe(row(tree, "docs"));
		await userEvent.keyboard("j");
		expect(document.activeElement).toBe(row(tree, "package.json"));
		await userEvent.keyboard("k");
		expect(document.activeElement).toBe(row(tree, "docs"));
		expect(row(tree, "docs").tabIndex).toBe(0);
		expect(row(tree, "routes.ts").tabIndex).toBe(-1);
	});

	test("opens a folder with →, then enters it", async () => {
		let tree = mount();
		row(tree, "docs").focus();

		await userEvent.keyboard("{ArrowRight}");
		expect(document.getElementById("docs")).toMatchObject({ open: true });
		expect(document.activeElement).toBe(row(tree, "docs"));

		await userEvent.keyboard("{ArrowRight}");
		await expect.poll(() => document.activeElement).toBe(row(tree, "guide.md"));
	});

	test("goes to the parent with ←, then closes it", async () => {
		let tree = mount();
		row(tree, "worker.ts").focus();

		await userEvent.keyboard("{ArrowLeft}");
		expect(document.activeElement).toBe(row(tree, "app"));

		await userEvent.keyboard("{ArrowLeft}");
		expect(document.getElementById("app")).toMatchObject({ open: false });
	});

	test("jumps with Home and End", async () => {
		let tree = mount();
		row(tree, "worker.ts").focus();

		await userEvent.keyboard("{End}");
		expect(document.activeElement).toBe(row(tree, "package.json"));
		await userEvent.keyboard("{Home}");
		expect(document.activeElement).toBe(row(tree, "app"));
	});

	test("finds a row by typing its name", async () => {
		let tree = mount();
		row(tree, "routes.ts").focus();

		await userEvent.keyboard("pa");
		expect(document.activeElement).toBe(row(tree, "package.json"));
		await userEvent.keyboard("w");
		expect(document.activeElement).toBe(row(tree, "worker.ts"));
	});

	test("leaves the page's j and arrows alone while focus is outside the tree", async () => {
		mount();
		let ran: string[] = [];
		let controller = new AbortController();
		shortcutRegistry(document).register({
			keys: ["j", "arrowdown"],
			run: (event) => {
				ran.push(event.key);
			},
			signal: controller.signal,
		});

		document.getElementById("outside")!.focus();
		await userEvent.keyboard("j{ArrowDown}");
		controller.abort();

		expect(ran).toEqual(["j", "ArrowDown"]);
	});

	test("lists its keys in the help sheet under the tree's group", () => {
		mount();
		let entries = shortcutRegistry(document).list(document);

		expect(entries).toContainEqual({
			keys: ["arrowdown", "j"],
			label: "Next file",
			group: "Files",
		});
	});
});
