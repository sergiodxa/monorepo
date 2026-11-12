/**
 * Holds Chorus's layout in a real browser: the rail's cards land at their placeholders'
 * height, no screen scrolls sideways on a phone, the phone's compose button is gone from a
 * tablet up, the icon rail shows no names, and a profile's avatar sits over its banner.
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

import { blockSize } from "~/app/test/frame-size";
import { demoThemeTokens } from "~/resources/components/demo-theme";
import chorus from "~/resources/views/demo-apps/chorus";
import { FollowCard, TrendsCard } from "~/resources/views/demo-apps/chorus/rail";
import { readState } from "~/resources/views/demo-apps/chorus/state";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

/** The rail's widths: a 1024px screen's and a 1280px screen's. */
const RAIL_WIDTHS = [296, 344];

/** A frame that never answers, so each frame draws its placeholder as on first paint. */
const PENDING = new Promise<never>(() => {});

/** Wraps a node in Chorus's theme tokens, so type and spacing match the page. */
function themed(node: RemixNode): RemixNode {
	return (
		<div
			mix={[
				themeScope(),
				raw({ ...demoThemeTokens(chorus.theme), fontFamily: "var(--ui-font-sans)" }),
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
 * Mounts one screen of the app at the current viewport, its frames pending as on first
 * paint, and waits a frame. The screen must draw something, so a render that throws fails.
 */
async function mountScreen(screen: string): Promise<HTMLElement> {
	let [path = "", query = ""] = screen.split("?");
	let url = new URL(`http://localhost/demo/apps/chorus/${path}${query ? `?${query}` : ""}`);
	let rendered = chorus.render({ page: path, url, cookie: null });
	let mounted = render(themed(rendered.body), { frameInit: { resolveFrame: () => PENDING } });
	onTestFinished(() => mounted.cleanup());
	await new Promise((resolve) => requestAnimationFrame(resolve));
	expect(mounted.container.querySelector('[data-slot="chorus"]'), screen).not.toBeNull();
	return mounted.container;
}

afterAll(async () => {
	await page.viewport(414, 896);
});

describe("Chorus rail cards keep their placeholder's size", () => {
	describe.each(RAIL_WIDTHS)("at %ipx", (width) => {
		test("trends", () => {
			expectSameSize(
				blockSize(<TrendsCard />, width, themed),
				blockSize(<TrendsCard ghost />, width, themed),
			);
		});

		test("who to follow", () => {
			expectSameSize(
				blockSize(<FollowCard state={readState(null)} />, width, themed),
				blockSize(<FollowCard ghost />, width, themed),
			);
		});
	});
});

describe("Chorus on a phone", () => {
	test.each(chorus.screens)("screen %j never scrolls sideways at 375px", async (screen) => {
		await page.viewport(375, 812);
		await mountScreen(screen);

		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
	});

	test("a profile's avatar is drawn over its banner", async () => {
		await page.viewport(375, 812);
		let root = await mountScreen("u/meilin");
		let tile = [...root.querySelectorAll<HTMLElement>("span[aria-hidden='true']")].find(
			(element) => element.textContent === "ML" && element.getBoundingClientRect().width > 80,
		)!;
		let box = tile.getBoundingClientRect();
		let hit = document.elementFromPoint(box.left + box.width / 2, box.top + 8);

		expect(tile.contains(hit)).toBe(true);
	});

	test("shows the compose button and the tab bar", async () => {
		await page.viewport(375, 812);
		let root = await mountScreen("");

		expect(getComputedStyle(root.querySelector('[data-slot="chorus-fab"]')!).display).not.toBe(
			"none",
		);
		expect(getComputedStyle(root.querySelector('[data-slot="tab-bar"]')!).display).not.toBe("none");
	});

	test("a post's page gives the foot to its reply box, not the compose button", async () => {
		await page.viewport(375, 812);
		let root = await mountScreen("post/p-leonids");

		expect(root.querySelector('[data-slot="chorus-fab"]')).toBeNull();
	});
});

describe("Chorus from a tablet up", () => {
	test("hides the phone's compose button and tab bar at 768px", async () => {
		await page.viewport(768, 1024);
		let root = await mountScreen("");

		expect(getComputedStyle(root.querySelector('[data-slot="chorus-fab"]')!).display).toBe("none");
		expect(getComputedStyle(root.querySelector('[data-slot="tab-bar"]')!).display).toBe("none");
	});

	test("keeps names out of the icon rail at 768px, account row included", async () => {
		await page.viewport(768, 1024);
		let root = await mountScreen("");
		let header = root.querySelector('[data-slot="chorus"] > header')!;

		for (let label of header.querySelectorAll<HTMLElement>("[data-nav-label]")) {
			expect(label.getBoundingClientRect().width, label.textContent ?? "").toBe(0);
		}
	});

	test("shows every name and hides the compose button at 1280px", async () => {
		await page.viewport(1280, 860);
		let root = await mountScreen("");
		let header = root.querySelector('[data-slot="chorus"] > header')!;

		expect(getComputedStyle(root.querySelector('[data-slot="chorus-fab"]')!).display).toBe("none");
		for (let label of header.querySelectorAll<HTMLElement>("[data-nav-label]")) {
			expect(label.getBoundingClientRect().width, label.textContent ?? "").toBeGreaterThan(0);
		}
	});
});
