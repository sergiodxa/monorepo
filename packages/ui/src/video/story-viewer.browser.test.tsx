/**
 * Runs the story viewer in a real page: bars that fill and move on, tap zones that step in
 * place with the address following, a hold that pauses without stepping, the pause button and
 * keys, crossing into the next person after their last segment, and Escape closing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { afterEach, describe, expect, test, vi } from "vitest";

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

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	history.replaceState(null, "", location.pathname);
});

/** The running state of the current bar's fill in a group. */
function fillState(feed: RenderResult, person: string): string {
	let fill = feed.container.querySelector<HTMLElement>(
		`#group-${person} [data-slot=story-viewer-bar][data-current] > span`,
	);
	return fill === null ? "none" : getComputedStyle(fill).animationPlayState;
}

/** Presses the card the way a finger or mouse does, for `ms` milliseconds. */
async function hold(element: Element, ms: number) {
	let box = element.getBoundingClientRect();
	let at = { clientX: box.left + box.width * 0.75, clientY: box.top + box.height / 2 };
	let init = { ...at, bubbles: true, isPrimary: true, pointerId: 7, button: 0 };
	element.dispatchEvent(new PointerEvent("pointerdown", init));
	await new Promise((resolve) => setTimeout(resolve, ms));
	element.dispatchEvent(new PointerEvent("pointerup", init));
	element.dispatchEvent(new MouseEvent("click", { ...at, bubbles: true, cancelable: true }));
}

describe("StoryViewer", () => {
	test("renders tap zones as links to the segments around the current one", () => {
		mounted = mountStories("bo");
		let zones = [...mounted.container.querySelectorAll("#group-bo [data-story-zone]")];
		expect(zones.map((zone) => zone.getAttribute("href"))).toEqual(["?story=ana-1", "?story=bo-1"]);
		expect(mounted.container.querySelector("[data-story-close]")?.getAttribute("href")).toBe(
			"?closed",
		);
		expect(activeGroup(mounted)).toBe("group-bo");
	});

	test("runs only the open group's bar", async () => {
		mounted = mountStories("bo");
		await waitForViewer(mounted);
		expect(fillState(mounted, "bo")).toBe("running");
		expect(fillState(mounted, "ana")).toBe("paused");
	});

	test("steps forward and back in place on a tap, the address following", async () => {
		mounted = mountStories("ana");
		await waitForViewer(mounted);
		let next = mounted.container.querySelector<HTMLElement>("#group-ana [data-story-zone=next]")!;

		next.click();

		expect(currentSegment(mounted, "ana")).toBe(1);
		expect(location.search).toBe("?story=ana-1");
		let bars = [...mounted.container.querySelectorAll("#group-ana [data-slot=story-viewer-bar]")];
		expect(bars.map((bar) => bar.hasAttribute("data-done"))).toEqual([true, false]);

		mounted.container.querySelector<HTMLElement>("#group-ana [data-story-zone=previous]")!.click();
		expect(currentSegment(mounted, "ana")).toBe(0);
		expect(location.search).toBe("?story=ana-0");
	});

	test("moves on by itself when a segment's bar fills, into the next person after the last", async () => {
		mounted = mountStories("ana", 0.15);
		await waitForViewer(mounted);
		let feed = mounted;

		await vi.waitFor(() => expect(currentSegment(feed, "ana")).toBe(1));
		await vi.waitFor(() => expect(activeGroup(feed)).toBe("group-bo"), { timeout: 2000 });
		expect(currentSegment(feed, "bo")).toBe(0);
	});

	test("pauses while held and resumes on release, without stepping", async () => {
		mounted = mountStories("ana");
		await waitForViewer(mounted);
		let viewer = viewerOf(mounted);
		let card = mounted.container.querySelector("#group-ana [data-story-zone=next]")!;
		let paused: boolean[] = [];
		let watcher = new MutationObserver(() => paused.push(viewer.hasAttribute("data-story-paused")));
		watcher.observe(viewer, { attributes: true, attributeFilter: ["data-story-paused"] });

		await hold(card, 400);
		watcher.disconnect();

		expect(paused).toEqual([true, false]);
		expect(currentSegment(mounted, "ana")).toBe(0);
		expect(fillState(mounted, "ana")).toBe("running");
	});

	test("pauses from the pause button and the space bar", async () => {
		mounted = mountStories("ana");
		await waitForViewer(mounted);
		let viewer = viewerOf(mounted);
		let button = mounted.container.querySelector<HTMLButtonElement>("[data-story-pause]")!;

		button.click();
		expect(button.getAttribute("aria-pressed")).toBe("true");
		expect(fillState(mounted, "ana")).toBe("paused");

		viewer.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
		expect(viewer.hasAttribute("data-story-paused")).toBe(false);
		expect(button.getAttribute("aria-pressed")).toBe("false");
	});

	test("steps with the arrow keys and closes on Escape", async () => {
		mounted = mountStories("ana");
		await waitForViewer(mounted);
		let closes = watchClose(mounted);

		document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
		expect(currentSegment(mounted, "ana")).toBe(1);
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

		expect(closes).toEqual(["closed"]);
	});

	test("closes after the last person's last segment", async () => {
		mounted = mountStories("cy");
		await waitForViewer(mounted);
		let closes = watchClose(mounted);
		let next = mounted.container.querySelector<HTMLElement>("#group-cy [data-story-zone=next]")!;

		next.click();
		next.click();

		expect(closes).toEqual(["closed"]);
	});

	test("keeps the card inside the screen and never wider than 9:16", () => {
		mounted = mountStories("ana");
		let card = mounted.container.querySelector<HTMLElement>(
			"#group-ana [data-slot=story-viewer-card]",
		)!;
		let box = card.getBoundingClientRect();
		expect(box.width).toBeLessThanOrEqual(window.innerWidth);
		expect(box.height).toBeLessThanOrEqual(window.innerHeight);
		expect(box.width / box.height).toBeLessThanOrEqual(0.5626);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
	});
});
