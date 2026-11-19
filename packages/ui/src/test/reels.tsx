/**
 * The feed the reel feed's browser tests mount, on a hovering pointer and on touch: six reels,
 * each playing its own address of one short clip so the browser loads every reel separately,
 * plus the waits both test files share.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { expect, vi } from "vitest";

import { ReelFeed } from "../video/reel-feed.js";

/** An eight-second 32px clip; each reel adds its own query, so no two share a cache entry. */
const CLIP = new URL("./reel.webm", import.meta.url).href;

/** How many reels the feed holds. */
export const REEL_COUNT = 6;

/**
 * Mounts a feed of {@link REEL_COUNT} reels opening on `current`, inside a box of the given
 * height so each reel is one box tall.
 *
 * @param current The reel the page opens on.
 * @param height The feed's height in pixels.
 */
export function mountReels(current = 0, height = 600): RenderResult {
	return render(
		<div style={`block-size: ${height}px; inline-size: 360px; --ui-reel-feed-height: ${height}px`}>
			<ReelFeed label="Reels">
				{Array.from({ length: REEL_COUNT }, (_, index) => (
					<ReelFeed.Item
						id={`reel-${index}`}
						href={`?reel=${index}`}
						label={`Reel ${index + 1}`}
						offset={index - current}
						loopAt={4}
						sources={[{ src: `${CLIP}?reel=${index}`, type: "video/webm" }]}
						labels={{ pause: "Pause" }}
					>
						<p>Caption {index + 1}</p>
					</ReelFeed.Item>
				))}
			</ReelFeed>
		</div>,
	);
}

/** The feed's scroller. */
export function scrollerOf(mounted: RenderResult): HTMLElement {
	let scroller = mounted.container.querySelector<HTMLElement>("[data-slot=reel-feed-scroller]");
	if (scroller === null) throw new Error("The feed drew no scroller");
	return scroller;
}

/** The video of the reel at `index`. */
export function videoAt(mounted: RenderResult, index: number): HTMLVideoElement {
	let video = mounted.container.querySelector<HTMLVideoElement>(`#reel-${index} video`);
	if (video === null) throw new Error(`Reel ${index} has no video`);
	return video;
}

/** Resolves once the feed's island has run and the reel at `index` is the one on screen. */
export async function waitForActive(mounted: RenderResult, index: number): Promise<void> {
	await vi.waitFor(() => {
		expect(
			mounted.container.querySelector("[data-slot=reel-feed][data-reel-feed-ready]"),
		).not.toBeNull();
		let active = [...mounted.container.querySelectorAll("[data-reel-active]")].map(
			(reel) => reel.id,
		);
		expect(active).toEqual([`reel-${index}`]);
	});
}
