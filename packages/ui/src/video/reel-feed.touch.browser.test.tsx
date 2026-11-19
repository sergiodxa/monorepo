/**
 * Swipes the reel feed with a finger, in a page that matches `(hover: none)` and
 * `(pointer: coarse)`: touch events go through Chromium's own input pipeline, so native
 * scrolling and scroll snap move the feed exactly as they do on a phone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { cdp, page } from "vitest/browser";

import { mountReels, scrollerOf, videoAt, waitForActive } from "../test/reels.js";

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
});

/**
 * Drags one finger from `fromY` to `toY` down the middle of `element` in eight steps `stepMs`
 * apart, through the browser's touch input rather than synthetic DOM events; no pause between
 * steps makes it a fast flick.
 */
async function swipe(element: HTMLElement, fromY: number, toY: number, stepMs = 0): Promise<void> {
	let box = element.getBoundingClientRect();
	let x = Math.round(box.left + box.width / 2);
	let top = box.top;
	let session = cdp();
	await session.send("Input.dispatchTouchEvent", {
		type: "touchStart",
		touchPoints: [{ x, y: Math.round(top + fromY) }],
	});
	let steps = 8;
	for (let step = 1; step <= steps; step++) {
		let y = Math.round(top + fromY + ((toY - fromY) * step) / steps);
		await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
		if (stepMs > 0) await new Promise((resolve) => setTimeout(resolve, stepMs));
	}
	await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

/** Resolves once the scroller has held still for 300ms, so a fling and any correction are over. */
async function settled(scroller: HTMLElement): Promise<void> {
	let last = -1;
	let stillSince = performance.now();
	let deadline = performance.now() + 5000;
	while (performance.now() < deadline) {
		await new Promise((resolve) => setTimeout(resolve, 50));
		if (scroller.scrollTop !== last) {
			last = scroller.scrollTop;
			stillSince = performance.now();
		} else if (performance.now() - stillSince >= 300) return;
	}
}

describe("ReelFeed under a finger", () => {
	test("swiping up snaps to the next reel and plays it, and swiping down returns", async () => {
		mounted = mountReels(0, 600);
		await waitForActive(mounted, 0);
		let feed = mounted;
		let scroller = scrollerOf(feed);

		await swipe(scroller, 540, 120, 16);

		await waitForActive(feed, 1);
		await vi.waitFor(() => expect(scroller.scrollTop).toBeCloseTo(600, -1), { timeout: 4000 });
		await vi.waitFor(() => expect(videoAt(feed, 1).paused).toBe(false), { timeout: 4000 });
		expect(videoAt(feed, 0).paused).toBe(true);

		await swipe(scroller, 120, 540, 16);

		await waitForActive(feed, 0);
		await vi.waitFor(() => expect(scroller.scrollTop).toBeCloseTo(0, -1), { timeout: 4000 });
	});

	test("in a looping feed, swiping up on the last reel comes round to the first", async () => {
		mounted = mountReels(5, 600, { loop: true });
		await waitForActive(mounted, 5);
		let scroller = scrollerOf(mounted);

		await swipe(scroller, 480, 180, 16);

		await waitForActive(mounted, 0);
		await vi.waitFor(() => expect(scroller.scrollTop).toBe(0), { timeout: 4000 });
	});

	test("a short, slow drag settles back on the same reel", async () => {
		mounted = mountReels(0, 600);
		await waitForActive(mounted, 0);
		let scroller = scrollerOf(mounted);

		await swipe(scroller, 400, 340, 40);
		await new Promise((resolve) => setTimeout(resolve, 600));

		expect(scroller.scrollTop).toBeCloseTo(0, -1);
		expect(mounted.container.querySelector("[data-reel-active]")?.id).toBe("reel-0");
	});

	test("a long fling moves one reel, never two", async () => {
		mounted = mountReels(0, 600);
		await waitForActive(mounted, 0);
		let scroller = scrollerOf(mounted);

		await swipe(scroller, 590, 10);

		await settled(scroller);
		expect(scroller.scrollTop).toBeCloseTo(600, -1);
		expect(mounted.container.querySelector("[data-reel-active]")?.id).toBe("reel-1");
	});
});
