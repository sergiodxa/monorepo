/**
 * Holds Cairn's frames to the box their placeholders reserve, and its layouts to a phone and a
 * tablet: no screen scrolls sideways at 375px, an open issue ends above the tab bar, and the
 * issue's id stays on one line in a narrow pane.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { themeScope } from "@sdxc/ui/styles";
import { render } from "remix/component/test";
import { afterAll, describe, expect, onTestFinished, test } from "vitest";
import { page } from "vitest/browser";

import { PENDING_FRAMES, blockSize } from "~/app/test/frame-size";
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

/**
 * Mounts one of Cairn's screens with its frames pending, as on first paint.
 *
 * @param screen A page path with its query, as `cairn.screens` lists it.
 * @param cookie The visitor's `Cookie` header, for a screen drawn with their edits.
 */
async function mountScreen(screen: string, cookie: string | null = null): Promise<HTMLElement> {
	let [path = "", query = ""] = screen.split("?");
	let url = new URL(`http://localhost/demo/apps/cairn/${path}${query ? `?${query}` : ""}`);
	let rendered = cairn.render({ page: path, url, cookie });
	let mounted = render(themed(rendered.body), PENDING_FRAMES);
	onTestFinished(() => mounted.cleanup());
	await new Promise((resolve) => requestAnimationFrame(resolve));
	expect(mounted.container.querySelector('[data-slot="app-shell"]'), screen).not.toBeNull();
	return mounted.container;
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
