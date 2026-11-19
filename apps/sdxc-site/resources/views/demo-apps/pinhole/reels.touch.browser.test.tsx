/**
 * Swipes Pinhole's reels with a finger on a phone-sized touch screen: a swipe up rides native
 * scroll snap to the next reel, whose address and title follow in place, and a swipe down
 * comes back, all without loading a page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { cdp, page } from "vitest/browser";

import type { MountedApp } from "~/app/test/spa-harness";

import { mountApp } from "~/app/test/spa-harness";
import pinhole from "~/resources/views/demo-apps/pinhole";
import { REELS } from "~/resources/views/demo-apps/pinhole/data";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

let mounted: MountedApp | undefined;

beforeAll(async () => {
	await page.viewport(390, 844);
});

afterAll(async () => {
	await page.viewport(414, 896);
});

afterEach(() => {
	mounted?.dispose();
	mounted = undefined;
});

/** Drags one finger up or down the middle of the screen, as a quick swipe. */
async function swipe(fromY: number, toY: number): Promise<void> {
	let session = cdp();
	await session.send("Input.dispatchTouchEvent", {
		type: "touchStart",
		touchPoints: [{ x: 195, y: fromY }],
	});
	for (let step = 1; step <= 8; step++) {
		let y = Math.round(fromY + ((toY - fromY) * step) / 8);
		await session.send("Input.dispatchTouchEvent", {
			type: "touchMove",
			touchPoints: [{ x: 195, y }],
		});
	}
	await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

describe("Pinhole's reels under a finger", () => {
	test("a swipe up plays the next reel at its own address, and a swipe down comes back", async () => {
		let [first, second] = REELS;
		mounted = await mountApp(pinhole, "pinhole", `reels/${first!.id}`);
		await vi.waitFor(
			() =>
				expect(document.querySelector("[data-reel-feed-ready] [data-reel-active]")?.id).toBe(
					`reel-${first!.id}`,
				),
			{ timeout: 4000 },
		);

		await swipe(600, 220);

		await vi.waitFor(
			() => expect(location.pathname).toBe(`/demo/apps/pinhole/reels/${second!.id}`),
			{ timeout: 4000 },
		);
		expect(document.querySelector("[data-reel-active]")?.id).toBe(`reel-${second!.id}`);
		expect(document.title).toContain("Reel by Teo Lindqvist");

		await swipe(220, 600);

		await vi.waitFor(
			() => expect(location.pathname).toBe(`/demo/apps/pinhole/reels/${first!.id}`),
			{ timeout: 4000 },
		);
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
	});
});
