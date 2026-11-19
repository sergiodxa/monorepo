/**
 * Runs the reel feed in a real page: the preload window around the reel on screen, the next
 * reel's video loading before any swipe, one reel per key press or wheel flick, reels off
 * screen pausing, opening on a reel further down, and tapping a reel to pause it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { afterEach, describe, expect, test, vi } from "vitest";

import { mountReels, scrollerOf, videoAt, waitForActive } from "../test/reels.js";

import { reelPreload } from "./reel-feed.js";

import "../reset.css";
import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** Every reel's `preload`, in feed order. */
function preloads(feed: RenderResult): string[] {
	return [...feed.container.querySelectorAll<HTMLVideoElement>("video")].map(
		(video) => video.preload,
	);
}

describe("reelPreload", () => {
	test("loads the current and next reel, the metadata of the one after, and nothing else", () => {
		expect([-2, -1, 0, 1, 2, 3].map(reelPreload)).toEqual([
			"none",
			"none",
			"auto",
			"auto",
			"metadata",
			"none",
		]);
	});
});

describe("ReelFeed", () => {
	test("renders the preload window around the reel the page opens on", () => {
		mounted = mountReels(0);
		expect(preloads(mounted)).toEqual(["auto", "auto", "metadata", "none", "none", "none"]);
		expect(videoAt(mounted, 0).autoplay).toBe(true);
		expect(videoAt(mounted, 1).autoplay).toBe(false);
		expect(mounted.container.querySelector("link[rel=prefetch]")?.getAttribute("href")).toBe(
			"?reel=1",
		);
	});

	test("starts loading the next reel's video before the visitor swipes", async () => {
		mounted = mountReels(0);
		await waitForActive(mounted, 0);
		let feed = mounted;

		await vi.waitFor(() => expect(videoAt(feed, 1).readyState).toBeGreaterThanOrEqual(1));
		await vi.waitFor(() => expect(videoAt(feed, 2).readyState).toBeGreaterThanOrEqual(1));

		expect(scrollerOf(feed).scrollTop).toBe(0);
		expect(videoAt(feed, 3).readyState).toBe(0);
		expect(videoAt(feed, 5).readyState).toBe(0);
	});

	test("steps one reel for ArrowDown, sliding the window and pausing the reel it left", async () => {
		mounted = mountReels(0);
		await waitForActive(mounted, 0);
		let feed = mounted;
		await vi.waitFor(() => expect(videoAt(feed, 0).paused).toBe(false));

		document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));

		await waitForActive(feed, 1);
		await vi.waitFor(() => expect(scrollerOf(feed).scrollTop).toBeCloseTo(600, -1));
		expect(preloads(feed)).toEqual(["none", "auto", "auto", "metadata", "none", "none"]);
		expect(videoAt(feed, 0).paused).toBe(true);
		await vi.waitFor(() => expect(videoAt(feed, 1).paused).toBe(false));
		expect(feed.container.querySelector("link[rel=prefetch]")?.getAttribute("href")).toBe(
			"?reel=2",
		);
	});

	test("moves one reel for a whole wheel flick, however many events its momentum sends", async () => {
		mounted = mountReels(0);
		await waitForActive(mounted, 0);
		let scroller = scrollerOf(mounted);

		for (let delta of [30, 60, 90, 60, 30, 15]) {
			scroller.dispatchEvent(
				new WheelEvent("wheel", { deltaY: delta, bubbles: true, cancelable: true }),
			);
		}

		await waitForActive(mounted, 1);
		await new Promise((resolve) => setTimeout(resolve, 700));
		expect(scroller.scrollTop).toBeCloseTo(600, -1);
		expect(mounted.container.querySelector("[data-reel-active]")?.id).toBe("reel-1");
	});

	test("never steps past either end", async () => {
		mounted = mountReels(0);
		await waitForActive(mounted, 0);

		document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
		await new Promise((resolve) => setTimeout(resolve, 100));

		expect(scrollerOf(mounted).scrollTop).toBe(0);
		expect(mounted.container.querySelector("[data-reel-active]")?.id).toBe("reel-0");
	});

	test("opens on a reel further down, scrolled to it with the window around it", async () => {
		mounted = mountReels(3);
		await waitForActive(mounted, 3);
		expect(scrollerOf(mounted).scrollTop).toBeCloseTo(1800, -1);
		expect(preloads(mounted)).toEqual(["none", "none", "none", "auto", "auto", "metadata"]);
	});

	test("pauses the reel on screen when its stage is pressed, and plays it on the next press", async () => {
		mounted = mountReels(0);
		await waitForActive(mounted, 0);
		let feed = mounted;
		let video = videoAt(feed, 0);
		await vi.waitFor(() => expect(video.paused).toBe(false));
		let toggle = feed.container.querySelector<HTMLButtonElement>("#reel-0 [data-reel-toggle]")!;

		toggle.click();
		expect(video.paused).toBe(true);
		expect(toggle.getAttribute("aria-pressed")).toBe("true");

		toggle.click();
		await vi.waitFor(() => expect(video.paused).toBe(false));
		expect(toggle.getAttribute("aria-pressed")).toBe("false");
	});

	test("fills the feed's height with each reel and keeps the stage at most 9:16", () => {
		mounted = mountReels(0, 600);
		let reel = mounted.container.querySelector<HTMLElement>("#reel-0")!;
		let stage = reel.querySelector<HTMLElement>("[data-slot=reel-feed-stage]")!;
		expect(reel.getBoundingClientRect().height).toBe(600);
		expect(stage.getBoundingClientRect().height).toBe(600);
		expect(stage.getBoundingClientRect().width).toBeLessThanOrEqual(338);
	});
});
