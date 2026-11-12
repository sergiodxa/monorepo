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
