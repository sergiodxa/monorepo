/**
 * Uses the story viewer with a finger, in a page that matches `(hover: none)` and
 * `(pointer: coarse)`: touch input goes through Chromium's own pipeline, so a sideways swipe
 * rides native scroll snap to the next person and a pull down closes the viewer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { cdp, page } from "vitest/browser";

import {
	activeGroup,
	currentSegment,
	mountStories,
	viewerOf,
	waitForViewer,
	watchClose,
} from "../test/stories.js";

import "../reset.css";
import "../theme.css";

let mounted: RenderResult | undefined;

beforeAll(async () => {
	await page.viewport(375, 700);
});

afterAll(async () => {
	await page.viewport(414, 896);
});

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	history.replaceState(null, "", location.pathname);
});

/** Drags one finger from one point to another in eight steps `stepMs` apart. */
async function drag(
	from: { x: number; y: number },
	to: { x: number; y: number },
	stepMs = 16,
): Promise<void> {
	let session = cdp();
	await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] });
	for (let step = 1; step <= 8; step++) {
		let x = Math.round(from.x + ((to.x - from.x) * step) / 8);
		let y = Math.round(from.y + ((to.y - from.y) * step) / 8);
		await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
		await new Promise((resolve) => setTimeout(resolve, stepMs));
	}
	await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

describe("StoryViewer under a finger", () => {
	test("swiping down closes the viewer", async () => {
		mounted = mountStories("ana");
		await waitForViewer(mounted);
		let closes = watchClose(mounted);

		await drag({ x: 180, y: 250 }, { x: 185, y: 520 });

		await vi.waitFor(() => expect(closes).toEqual(["closed"]), { timeout: 4000 });
		expect(currentSegment(mounted, "ana")).toBe(0);
	});

	test("a short pull springs back and keeps playing", async () => {
		mounted = mountStories("ana");
		await waitForViewer(mounted);
		let closes = watchClose(mounted);

		await drag({ x: 180, y: 250 }, { x: 180, y: 300 });
		await new Promise((resolve) => setTimeout(resolve, 300));

		expect(closes).toEqual([]);
		expect(viewerOf(mounted).hasAttribute("data-story-paused")).toBe(false);
		expect(currentSegment(mounted, "ana")).toBe(0);
	});

	test("swiping sideways snaps to the next person", async () => {
		mounted = mountStories("ana");
		await waitForViewer(mounted);
		let feed = mounted;

		await drag({ x: 320, y: 350 }, { x: 40, y: 352 });

		await vi.waitFor(() => expect(activeGroup(feed)).toBe("group-bo"), { timeout: 4000 });
		let track = feed.container.querySelector<HTMLElement>("[data-slot=story-viewer-track]")!;
		await vi.waitFor(() => expect(track.scrollLeft).toBeCloseTo(375, -1), { timeout: 4000 });
	});

	test("a tap on the right steps forward", async () => {
		mounted = mountStories("ana");
		await waitForViewer(mounted);
		let feed = mounted;
		let zone = feed.container.querySelector("#group-ana [data-story-zone=next]")!;
		let box = zone.getBoundingClientRect();
		let point = {
			x: Math.round(box.left + box.width / 2),
			y: Math.round(box.top + box.height / 2),
		};
		await cdp().send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
		await cdp().send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

		await vi.waitFor(() => expect(currentSegment(feed, "ana")).toBe(1), { timeout: 4000 });
		expect(location.search).toBe("?story=ana-1");
	});
});
