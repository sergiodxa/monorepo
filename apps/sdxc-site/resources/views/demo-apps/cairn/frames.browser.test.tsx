/**
 * Holds Cairn's frames to the box their placeholders reserve, and its layouts to a phone and a
 * tablet: no screen scrolls sideways at 375px, an open issue ends above the tab bar, and the
 * issue's id stays on one line in a narrow pane.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { themeScope } from "@sdxc/ui/styles";
import { render } from "remix/component/test";
import { afterAll, describe, expect, onTestFinished, test } from "vitest";
import { page } from "vitest/browser";

import { blockSize } from "~/app/test/frame-size";
import { demoThemeTokens } from "~/resources/components/demo-theme";
import cairn from "~/resources/views/demo-apps/cairn";
import {
	BurnUpChart,
	BurnUpPlaceholder,
	CycleStats,
} from "~/resources/views/demo-apps/cairn/cycles";
import { CYCLES } from "~/resources/views/demo-apps/cairn/data";
import { allIssues, readState } from "~/resources/views/demo-apps/cairn/state";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

/** The column widths the frames sit in, from a phone's content column to a desktop's. */
const WIDTHS = [343, 720, 1100];

/** Every issue as a visitor with no edits sees it. */
const ISSUES = allIssues(readState(null));

/** Wraps a node in Cairn's theme tokens, so type and spacing match the page. */
function themed(node: RemixNode): RemixNode {
	return (
		<div
			mix={[
				themeScope(),
				raw({ ...demoThemeTokens(cairn.theme), fontFamily: "var(--ui-font-sans)" }),
			]}
		>
			{node}
		</div>
	);
}

/** Expects the content to take the placeholder's height, to a pixel. */
function expectSameSize(content: number, fallback: number) {
	expect(content).toBeGreaterThan(0);
	expect(Math.abs(content - fallback)).toBeLessThanOrEqual(1);
}

/** The named frames a mounted screen holds, reached through a probe rendered beside it. */
let frames: Handle["frames"] | undefined;

/** Every frame a mounted screen asked for, by name, in order. */
let requested: string[] = [];

/** Renders nothing and keeps the root's frame handles for the test to reload. */
function FrameProbe(handle: Handle) {
	frames = handle.frames;
	return () => null;
}

/**
 * Resolves Cairn's named frames as the page route does, by asking the app for the frame its
 * name and address pick, and leaves every other frame (a cycle's parts) pending.
 */
function resolveCairnFrame(cookie: string | null) {
	return (src: string, options?: { target?: string }) => {
		let target = options?.target;
		if (target === undefined || cairn.target === undefined) return new Promise<never>(() => {});
		requested.push(target);
		let url = new URL(src, "http://localhost");
		let page = url.pathname.replace(/^\/demo\/apps\/cairn\/?/, "");
		return cairn.target(target, { page, url, cookie }) ?? new Promise<never>(() => {});
	};
}

/**
 * Mounts one of Cairn's screens with its named frames answered and its parts pending, as on
 * first paint.
 *
 * @param screen A page path with its query, as `cairn.screens` lists it.
 * @param cookie The visitor's `Cookie` header, for a screen drawn with their edits.
 */
async function mountScreen(screen: string, cookie: string | null = null): Promise<HTMLElement> {
	let [path = "", query = ""] = screen.split("?");
	let url = new URL(`http://localhost/demo/apps/cairn/${path}${query ? `?${query}` : ""}`);
	let rendered = cairn.render({ page: path, url, cookie });
	requested = [];
	let mounted = render(
		<>
			{themed(rendered.body)}
			<FrameProbe />
		</>,
		{ frameInit: { resolveFrame: resolveCairnFrame(cookie) } },
	);
	onTestFinished(() => mounted.cleanup());
	await settleFrames();
	expect(mounted.container.querySelector('[data-slot="app-shell"]'), screen).not.toBeNull();
	return mounted.container;
}

/** Lets frame content land and the layout settle. */
async function settleFrames(): Promise<void> {
	for (let pass = 0; pass < 4; pass++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
		await new Promise((resolve) => requestAnimationFrame(resolve));
	}
}

/**
 * Reloads one named frame at `path`, and answers which frames it asked for.
 *
 * @param name The frame to reload.
 * @param path The page path with its query the frame loads.
 */
async function reloadFrame(name: string, path: string): Promise<string[]> {
	let frame = frames?.get(name);
	expect(frame, name).toBeDefined();
	requested = [];
	await frame!.reload({ src: `/demo/apps/cairn/${path}` });
	await settleFrames();
	return requested;
}

afterAll(async () => {
	await page.viewport(414, 896);
});

describe("Cairn frames keep their placeholder's size", () => {
	describe.each(WIDTHS)("at %ipx", (width) => {
		test.each(CYCLES.map((cycle) => [cycle.id, cycle]))("cycle %s's figures", (_, cycle) => {
			expectSameSize(
				blockSize(<CycleStats cycle={cycle} issues={ISSUES} />, width, themed),
				blockSize(<CycleStats cycle={cycle} issues={ISSUES} ghost />, width, themed),
			);
		});

		test.each(CYCLES.map((cycle) => [cycle.id, cycle]))("cycle %s's burn-up", (_, cycle) => {
			expectSameSize(
				blockSize(<BurnUpChart cycle={cycle} issues={ISSUES} />, width, themed),
				blockSize(<BurnUpPlaceholder />, width, themed),
			);
		});
	});
});

describe("Cairn on a phone", () => {
	test.each(cairn.screens)("screen %j never scrolls sideways at 375px", async (screen) => {
		await page.viewport(375, 812);
		await mountScreen(screen);

		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
	});

	test("an open issue ends above the tab bar, so its last lines stay reachable", async () => {
		await page.viewport(375, 812);
		let root = await mountScreen("?issue=WEB-118");
		let split = root.querySelector<HTMLElement>("#cairn-split")!;
		let bar = root.querySelector<HTMLElement>('[data-slot="tab-bar"] nav')!;

		expect(split.getBoundingClientRect().bottom).toBeLessThanOrEqual(
			bar.getBoundingClientRect().top + 1,
		);
	});
});

describe("Cairn's list", () => {
	test.each([375, 1280])(
		"at %ipx a group's glyph shares the checkboxes' axis and its title starts at the rows' first glyph",
		async (width) => {
			await page.viewport(width, 900);
			let root = await mountScreen("team/web");
			let section = root.querySelector<HTMLElement>('[data-group="started"]')!;
			let glyph = section.querySelector('[data-slot="group-glyph"] svg')!.getBoundingClientRect();
			let title = document.createRange();
			title.selectNodeContents(section.querySelector("h3")!);
			title.setStartAfter(section.querySelector('[data-slot="group-glyph"]')!);
			let row = section.querySelector("li")!;
			let check = row.querySelector('input[type="checkbox"]')!.getBoundingClientRect();
			let link = row.querySelector<HTMLElement>("[data-issue-link]")!.getBoundingClientRect();

			expect(
				Math.abs(glyph.left + glyph.width / 2 - (check.left + check.width / 2)),
			).toBeLessThanOrEqual(1);
			expect(Math.abs(title.getBoundingClientRect().left - link.left)).toBeLessThanOrEqual(1);
		},
	);
});

describe("Cairn's open issue", () => {
	test.each([1280, 1440])(
		"at %ipx keeps its properties in a sidebar beside the title, not under the description",
		async (width) => {
			await page.viewport(width, 900);
			let root = await mountScreen("team/web?issue=WEB-135");
			let article = root.querySelector<HTMLElement>('[data-issue-detail="WEB-135"]')!;
			let title = article.querySelector("h1, h2")!.getBoundingClientRect();
			let aside = article.querySelector('aside[aria-label="Properties"]')!.getBoundingClientRect();

			expect(aside.left).toBeGreaterThanOrEqual(title.right);
			expect(aside.top).toBeLessThanOrEqual(title.bottom);
		},
	);
});

describe("Cairn's short list", () => {
	test("rests its selection bar at the foot of the window, not under the last row", async () => {
		await page.viewport(1280, 900);
		let root = await mountScreen("my");
		let bar = root.querySelector<HTMLElement>('[data-slot="selection-bar"]')!;
		let rows = root.querySelector<HTMLElement>("#cairn-rows")!;
		let last = [...rows.querySelectorAll("li")].at(-1)!;

		expect(900 - bar.getBoundingClientRect().bottom).toBeLessThanOrEqual(16);
		expect(bar.getBoundingClientRect().top - last.getBoundingClientRect().bottom).toBeGreaterThan(
			100,
		);
	});

	test("starts its footer's count where the page's title starts", async () => {
		await page.viewport(1280, 900);
		let root = await mountScreen("team/web");
		let title = root.querySelector("h1")!.getBoundingClientRect();
		let text = document.createRange();
		text.selectNodeContents(root.querySelector('[data-slot="selection-bar-pagination"]')!);

		expect(Math.abs(text.getBoundingClientRect().left - title.left)).toBeLessThanOrEqual(1);
	});
});

describe("Cairn's long list", () => {
	test("keeps its header in place and one group heading at the top while its rows scroll", async () => {
		await page.viewport(1280, 600);
		let root = await mountScreen("team/web");
		let rows = root.querySelector<HTMLElement>("#cairn-rows")!;
		let title = root.querySelector("h1")!;
		let titleTop = title.getBoundingClientRect().top;
		let content = root.querySelector<HTMLElement>('[data-slot="app-shell-content"]')!;

		expect(content.scrollHeight).toBeLessThanOrEqual(content.clientHeight);
		expect(rows.scrollHeight).toBeGreaterThan(rows.clientHeight);
		rows.scrollTop = 60;
		await new Promise((resolve) => requestAnimationFrame(resolve));

		expect(title.getBoundingClientRect().top).toBe(titleTop);
		let top = rows.getBoundingClientRect().top;
		let stuck = [...rows.querySelectorAll("h3")].filter(
			(heading) => Math.abs(heading.getBoundingClientRect().top - top) <= 1,
		);
		expect(stuck).toHaveLength(1);
		expect(stuck[0]!.closest("section")).toBe(rows.querySelector("section"));
	});
});

describe("Cairn's board columns", () => {
	test("a column's + opens the create dialog in that column's status, and the next opener starts at Todo", async () => {
		await page.viewport(1280, 800);
		let root = await mountScreen("team/web/board");
		let dialog = root.querySelector<HTMLDialogElement>("dialog#cairn-create")!;
		let status = dialog.querySelector<HTMLSelectElement>('select[name="status"]')!;

		root.querySelector<HTMLButtonElement>('button[aria-label="Create issue in Done"]')!.click();
		expect(dialog.open).toBe(true);
		expect(status.value).toBe("done");

		dialog.close();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(status.value).toBe("todo");
	});
});

describe("Cairn's board", () => {
	test("fills the window under the top bar, so its own scrollbars stay on screen", async () => {
		await page.viewport(1280, 600);
		let root = await mountScreen("team/plat/board");
		let scroller = root.querySelector<HTMLElement>('[data-slot="board-columns"]')!;
		let content = root.querySelector<HTMLElement>('[data-slot="app-shell-content"]')!;

		expect(scroller.getBoundingClientRect().bottom).toBeLessThanOrEqual(600);
		expect(content.scrollHeight).toBeLessThanOrEqual(content.clientHeight);
	});
});

describe("Cairn on a tablet", () => {
	test("an open issue's id stays on one line in a pane squeezed to 240px", async () => {
		await page.viewport(768, 1024);
		let edited = `cairn.i.WEB-124=started.1.tomasz.${Math.floor(Date.now() / 1000)}`;
		let root = await mountScreen("team/web?issue=WEB-124", edited);
		let article = root.querySelector<HTMLElement>('[data-issue-detail="WEB-124"]')!;
		article.style.inlineSize = "240px";
		let header = article.querySelector(":scope > header")!;
		let id = [...header.querySelectorAll("span")].find((span) => span.textContent === "WEB-124")!;

		expect(getComputedStyle(id).whiteSpace).toBe("nowrap");
		expect(Math.round(id.getBoundingClientRect().height)).toBeLessThanOrEqual(20);
	});
});

describe("Cairn's frames reload alone", () => {
	test("opening another issue reloads only the issue frame, and the list keeps its rows", async () => {
		await page.viewport(1280, 800);
		let root = await mountScreen("team/web?issue=WEB-121");
		let sidebar = root.querySelector("#cairn-sidebar");
		let rowsBox = root.querySelector("#cairn-rows");
		let row = root.querySelector('[data-issue="WEB-124"]');

		expect(await reloadFrame("cairn-issue", "team/web?issue=WEB-124")).toEqual(["cairn-issue"]);
		expect(root.querySelector('[data-issue-detail="WEB-124"]')).not.toBeNull();
		expect(root.querySelector('[data-issue-detail="WEB-121"]')).toBeNull();
		expect(root.querySelector("#cairn-sidebar")).toBe(sidebar);
		expect(root.querySelector("#cairn-rows")).toBe(rowsBox);
		expect(root.querySelector('[data-issue="WEB-124"]')).toBe(row);
	});

	test("a filter reloads the view frame, and the shell around it stays", async () => {
		await page.viewport(1280, 800);
		let root = await mountScreen("team/web");
		let sidebar = root.querySelector("#cairn-sidebar");
		let topbar = root.querySelector('[data-slot="app-shell-topbar"]');

		let asked = await reloadFrame("cairn-view", "team/web?status=todo");
		expect(asked[0]).toBe("cairn-view");
		expect(asked.every((name) => name.startsWith("cairn-"))).toBe(true);
		expect(root.querySelector('[data-group="started"]')).toBeNull();
		expect(root.querySelector("#cairn-sidebar")).toBe(sidebar);
		expect(root.querySelector('[data-slot="app-shell-topbar"]')).toBe(topbar);
	});

	test("a card opens its sheet by reloading only the sheet frame, and the columns stay", async () => {
		await page.viewport(1280, 800);
		let root = await mountScreen("team/web/board");
		let columns = root.querySelector('[data-slot="board-columns"]');
		let card = root.querySelector('[data-sortable-item="WEB-130"]');

		expect(await reloadFrame("cairn-sheet", "team/web/board?issue=WEB-130")).toEqual([
			"cairn-sheet",
		]);
		expect(root.querySelector("#cairn-issue-sheet")).not.toBeNull();
		expect(root.querySelector('[data-slot="board-columns"]')).toBe(columns);
		expect(root.querySelector('[data-sortable-item="WEB-130"]')).toBe(card);
	});

	test("a roadmap tab reloads only the timeline frame, and the title stays", async () => {
		await page.viewport(1280, 800);
		let root = await mountScreen("roadmap");
		let title = root.querySelector("h1");

		expect(await reloadFrame("cairn-roadmap", "roadmap?show=closed")).toEqual(["cairn-roadmap"]);
		expect(root.querySelectorAll('[data-slot="gantt-item"]')).toHaveLength(2);
		expect(root.querySelector("h1")).toBe(title);
		expect(
			root.querySelector('nav[aria-label="Roadmap tabs"] a[aria-current="page"]')?.textContent,
		).toBe("Closed");
	});
});
