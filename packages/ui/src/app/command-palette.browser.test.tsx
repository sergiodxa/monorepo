/**
 * Drives the command palette in a real browser: ⌘K opens it with focus in the search field,
 * recent commands show before typing, the filter folds case and accents, arrows and Enter run
 * a command, Backspace pops a page, Esc closes and returns focus, it sizes per viewport, and
 * the file finder opens on `t` and ranks 5,000 paths per keystroke with the matches in bold.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import { shortcutRegistry } from "./behaviors/shortcuts.js";
import { CommandPalette } from "./command-palette.js";
import { foldSearchText } from "./mixins/command-palette.js";

import "../reset.css";

const LABELS: CommandPalette.Labels = {
	title: "Command menu",
	open: "Open command menu",
	placeholder: "Search or run a command…",
	recent: "Recent",
	noResults: "No commands match",
	noResultsHint: "Try a monitor name or “create”.",
	results: "{count} results",
	back: "Back",
	close: "Close",
};

const REMEMBER_KEY = "palette-test:recent";

let mounted: RenderResult | undefined;
let ran: string[] = [];

beforeEach(async () => {
	await page.viewport(1440, 900);
	localStorage.removeItem(REMEMBER_KEY);
	ran = [];
});

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
});

/** Mounts an ops app's palette beside the button a reader was on. */
function mount(recent: string[] = ["go-incidents"]): HTMLDialogElement {
	mounted = render(
		<div>
			<button type="button" id="before">
				Before
			</button>
			<CommandPalette.Trigger for="palette">Search…</CommandPalette.Trigger>
			<CommandPalette id="palette" labels={LABELS} recent={recent} remember={REMEMBER_KEY}>
				<CommandPalette.Group heading="Navigation">
					<CommandPalette.Item
						id="go-monitors"
						title="Go to Monitors"
						href="#monitors"
						shortcut="g m"
					/>
					<CommandPalette.Item id="go-incidents" title="Go to Incidents" href="#incidents" />
				</CommandPalette.Group>
				<CommandPalette.Group heading="Monitors">
					<CommandPalette.Item id="create" title="Create Monitor" keywords={["new", "check"]} />
					<CommandPalette.Item id="pause" title="Pause All Monitors" />
					<CommandPalette.Item id="cafe" title="Open Café Status Page" />
				</CommandPalette.Group>
				<CommandPalette.Group heading="Account">
					<CommandPalette.Item id="switch" title="Switch Team…" page="teams" />
				</CommandPalette.Group>
				<CommandPalette.Page id="teams" title="Switch Team" placeholder="Search teams…">
					<CommandPalette.Item id="team-acme" title="Acme Ops" />
					<CommandPalette.Item id="team-equipe" title="Équipe Paris" />
				</CommandPalette.Page>
			</CommandPalette>
		</div>,
	);

	for (let link of document.querySelectorAll<HTMLAnchorElement>("a[data-palette-control]")) {
		link.addEventListener("click", (event) => event.preventDefault());
	}
	for (let control of document.querySelectorAll<HTMLElement>("[data-palette-control]")) {
		control.addEventListener("click", () => {
			ran.push(control.closest("[data-palette-item]")?.getAttribute("data-palette-item") ?? "");
		});
	}

	return document.getElementById("palette") as HTMLDialogElement;
}

/** The ids of the rows a reader can see right now, recent copies included. */
function visibleIds(dialog: HTMLDialogElement): string[] {
	return [...dialog.querySelectorAll<HTMLElement>("[data-palette-item]")]
		.filter((item) => item.checkVisibility())
		.map((item) => item.id);
}

/** Opens the palette from the keyboard. */
async function open(): Promise<void> {
	await userEvent.keyboard("{Control>}k{/Control}");
}

/** Waits for the dialog's entry motion to settle, so its box is the one a reader sees. */
async function settled(dialog: HTMLDialogElement): Promise<DOMRect> {
	await Promise.all(dialog.getAnimations().map((animation) => animation.finished));
	return dialog.getBoundingClientRect();
}

describe("CommandPalette", () => {
	test("opens on mod+k with focus in the search field, and closes on it again", async () => {
		let dialog = mount();
		await open();

		expect(dialog.open).toBe(true);
		expect(dialog.matches(":modal")).toBe(true);
		expect(document.activeElement).toBe(dialog.querySelector("[data-command-input]"));

		await open();
		expect(dialog.open).toBe(false);
	});

	test("closes on Esc and returns focus to where the reader was", async () => {
		let dialog = mount();
		let before = document.getElementById("before")!;
		before.focus();

		await open();
		await userEvent.keyboard("{Escape}");

		expect(dialog.open).toBe(false);
		expect(document.activeElement).toBe(before);
	});

	test("opens from its trigger, which shows the key", async () => {
		let dialog = mount();
		let trigger = document.querySelector<HTMLButtonElement>(
			'[commandfor="palette"][command="show-modal"]',
		)!;

		expect(trigger.textContent).toContain("K");
		await userEvent.click(trigger);
		expect(dialog.open).toBe(true);
	});

	test("shows recent commands before typing, server-passed and remembered, and hides them once typing", async () => {
		localStorage.setItem(REMEMBER_KEY, JSON.stringify(["pause"]));
		let dialog = mount();
		await open();

		let recent = dialog.querySelector<HTMLElement>("[data-palette-recent]")!;
		expect(recent.checkVisibility()).toBe(true);
		expect(visibleIds(dialog).slice(0, 2)).toEqual(["go-incidents-recent", "pause-recent"]);

		await userEvent.keyboard("mon");
		expect(recent.checkVisibility()).toBe(false);
	});

	test("remembers a command run from the palette", async () => {
		let dialog = mount([]);
		await open();
		await userEvent.keyboard("create{Enter}");
		await open();

		expect(JSON.parse(localStorage.getItem(REMEMBER_KEY) ?? "[]")).toEqual(["create"]);
		expect(visibleIds(dialog)[0]).toBe("create-recent");
	});

	test("filters by title and keywords, ignoring case and accents, and hides empty groups", async () => {
		let dialog = mount();
		await open();

		await userEvent.keyboard("CAFE");
		expect(visibleIds(dialog)).toEqual(["cafe"]);

		await userEvent.fill(dialog.querySelector<HTMLInputElement>("[data-command-input]")!, "new");
		expect(visibleIds(dialog)).toEqual(["create"]);
		let groups = [...dialog.querySelectorAll<HTMLElement>("[data-palette-group]")];
		expect(groups.map((group) => group.checkVisibility())).toEqual([false, true, false]);
		expect(dialog.querySelector("[data-palette-status]")?.textContent).toBe("1 results");
	});

	test("says nothing matched, quoting the query", async () => {
		let dialog = mount();
		await open();
		await userEvent.keyboard("zzz");

		let empty = dialog.querySelector<HTMLElement>("[data-command-empty]")!;
		expect(empty.checkVisibility()).toBe(true);
		expect(empty.textContent).toContain("No commands match “zzz”");
		expect(empty.textContent).toContain("Try a monitor name");
	});

	test("moves the active row with the arrows and runs it with Enter, closing the palette", async () => {
		let dialog = mount([]);
		await open();
		let input = dialog.querySelector<HTMLInputElement>("[data-command-input]")!;

		expect(input.getAttribute("aria-activedescendant")).toBe("go-monitors");
		await userEvent.keyboard("{ArrowDown}{ArrowDown}");
		expect(input.getAttribute("aria-activedescendant")).toBe("create");
		expect(document.getElementById("create")?.getAttribute("aria-selected")).toBe("true");
		await userEvent.keyboard("{ArrowUp}{Enter}");

		expect(ran).toEqual(["go-incidents"]);
		expect(dialog.open).toBe(false);
	});

	test("opens a nested page, and Backspace on an empty field pops it with the query restored", async () => {
		let dialog = mount();
		await open();
		let input = dialog.querySelector<HTMLInputElement>("[data-command-input]")!;

		await userEvent.keyboard("swi{Enter}");
		expect(dialog.open).toBe(true);
		expect(input.placeholder).toBe("Search teams…");
		expect(visibleIds(dialog)).toEqual(["team-acme", "team-equipe"]);
		expect(dialog.querySelector("[data-palette-crumb]")?.textContent).toBe("Switch Team");

		await userEvent.keyboard("equipe");
		expect(visibleIds(dialog)).toEqual(["team-equipe"]);
		await userEvent.fill(input, "");
		await userEvent.keyboard("{Backspace}");

		expect(input.value).toBe("swi");
		expect(input.placeholder).toBe(LABELS.placeholder);
		expect(visibleIds(dialog)).toEqual(["switch"]);
	});

	test("keeps page shortcuts inert while open, and binds an item's own key on the page", async () => {
		let page = 0;
		let controller = new AbortController();
		shortcutRegistry(document).register({
			keys: "j",
			run: () => void page++,
			signal: controller.signal,
		});
		let dialog = mount();

		await userEvent.keyboard("j");
		await open();
		dialog.querySelector<HTMLInputElement>("[data-command-input]")!.blur();
		dialog.focus();
		await userEvent.keyboard("j");
		expect(page).toBe(1);

		await userEvent.keyboard("{Escape}");
		await userEvent.keyboard("gm");
		expect(ran).toEqual(["go-monitors"]);
		controller.abort();
	});

	test("sits 640px wide and 15% from the top at 1440, with 36px rows", async () => {
		let dialog = mount();
		await open();
		let box = await settled(dialog);

		expect(box.width).toBe(640);
		expect(Math.round(box.left)).toBe(400);
		expect(Math.round(box.top)).toBe(135);
		expect(document.getElementById("create")!.getBoundingClientRect().height).toBe(36);
	});

	test("fills the width less a gutter at 375", async () => {
		await page.viewport(375, 812);
		let dialog = mount();
		await open();
		let box = await settled(dialog);

		expect(box.width).toBe(359);
		expect(box.left).toBe(8);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
	});

	test("folds case and accents for matching", () => {
		expect(foldSearchText("  Équipe Café ")).toBe("equipe cafe");
	});
});

/** A repository of 5,000 paths with one file whose name holds a space, so links must encode it. */
function repository(): string[] {
	let names = ["log-viewer", "command-palette", "page-header", "timeline", "index"];
	let paths = Array.from(
		{ length: 4_999 },
		(_, index) =>
			`packages/pkg-${index % 89}/src/module-${index % 11}/${names[index % names.length]}-${index}.tsx`,
	);
	return ["docs/Read Me.md", ...paths];
}

/** Mounts a palette whose only page is the file finder, opened on `t`. */
function mountFinder(paths: string[] = repository()): HTMLDialogElement {
	mounted = render(
		<CommandPalette id="palette" labels={LABELS}>
			<CommandPalette.Group heading="Navigation">
				<CommandPalette.Item id="find" title="Go to File…" page="files" />
			</CommandPalette.Group>
			<CommandPalette.Finder
				id="files"
				title="Go to File"
				placeholder="Search files…"
				shortcut="t"
				paths={paths}
				href="/blob/main/{path}"
			/>
		</CommandPalette>,
	);
	document.getElementById("palette")!.addEventListener("click", (event) => {
		let link = event.target instanceof Element ? event.target.closest("a") : null;
		if (link === null) return;
		event.preventDefault();
		ran.push(link.getAttribute("href") ?? "");
	});
	return document.getElementById("palette") as HTMLDialogElement;
}

/** The paths the finder lists right now, in order. */
function listedPaths(dialog: HTMLDialogElement): string[] {
	return [...dialog.querySelectorAll<HTMLElement>("[data-palette-finder-results] [data-value]")]
		.filter((row) => row.checkVisibility())
		.map((row) => row.getAttribute("data-value") ?? "");
}

describe("CommandPalette.Finder", () => {
	test("opens on t straight onto the finder, listing the first paths, and Backspace returns to the root", async () => {
		let dialog = mountFinder();
		await userEvent.keyboard("t");

		expect(dialog.open).toBe(true);
		let input = dialog.querySelector<HTMLInputElement>("[data-command-input]")!;
		expect(input.placeholder).toBe("Search files…");
		expect(dialog.querySelector("[data-palette-crumb]")?.textContent).toBe("Go to File");
		let listed = listedPaths(dialog);
		expect(listed).toHaveLength(50);
		expect(listed[0]).toBe("docs/Read Me.md");

		await userEvent.keyboard("{Backspace}");
		expect(visibleIds(dialog)).toEqual(["find"]);
	});

	test("ranks matches, bolds the matched characters, and opens the active one with Enter", async () => {
		let dialog = mountFinder();
		await userEvent.keyboard("t");
		await userEvent.keyboard("readme");

		expect(listedPaths(dialog)[0]).toBe("docs/Read Me.md");
		let row = dialog.querySelector<HTMLElement>("[data-palette-finder-results] [data-value]")!;
		let marks = [...row.querySelectorAll("mark")];
		expect(marks.map((mark) => mark.textContent).join("")).toBe("ReadMe");
		expect(Number(getComputedStyle(marks[0]!).fontWeight)).toBeGreaterThanOrEqual(600);
		expect(getComputedStyle(marks[0]!).backgroundColor).toBe("rgba(0, 0, 0, 0)");
		expect(row.getAttribute("aria-selected")).toBe("true");

		await userEvent.fill(
			dialog.querySelector<HTMLInputElement>("[data-command-input]")!,
			"pkg-7/module-7/timeline",
		);
		let second = listedPaths(dialog)[1]!;
		expect(second).toMatch(/^packages\/pkg-7\d*\/src\/module-7\/timeline-\d+\.tsx$/);
		await userEvent.keyboard("{ArrowDown}{Enter}");
		expect(ran).toEqual([`/blob/main/${second}`]);
		expect(dialog.open).toBe(false);
	});

	test("encodes each path segment in the link", async () => {
		let dialog = mountFinder();
		await userEvent.keyboard("t");
		await userEvent.keyboard("readme{Enter}");

		expect(ran).toEqual(["/blob/main/docs/Read%20Me.md"]);
		expect(dialog.open).toBe(false);
	});

	test("ranks 5,000 paths within a keystroke, building at most 50 rows", async () => {
		let dialog = mountFinder();
		await userEvent.keyboard("t");
		let input = dialog.querySelector<HTMLInputElement>("[data-command-input]")!;
		let slowest = 0;
		for (let query of ["p", "pk", "pkg", "pkgsrc", "pkgsrcmodlog", "pkgsrcmodlogview"]) {
			input.value = query;
			let started = performance.now();
			input.dispatchEvent(new Event("input", { bubbles: true }));
			slowest = Math.max(slowest, performance.now() - started);
			expect(listedPaths(dialog).length).toBeLessThanOrEqual(50);
		}
		expect(listedPaths(dialog).length).toBeGreaterThan(0);
		expect(dialog.querySelectorAll("[data-palette-finder-results] [data-value]").length).toBe(
			listedPaths(dialog).length,
		);
		expect(slowest).toBeLessThan(50);
	});

	test("says nothing matched when no path holds the characters in order", async () => {
		let dialog = mountFinder(["src/a.ts", "src/b.ts"]);
		await userEvent.keyboard("t");
		await userEvent.keyboard("zzz");

		expect(listedPaths(dialog)).toEqual([]);
		expect(dialog.querySelector<HTMLElement>("[data-command-empty]")!.checkVisibility()).toBe(true);
	});
});
