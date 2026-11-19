/**
 * Lays the media grid out in a real page: three square tiles to a row, a tall tile spanning
 * two rows without leaving a hole, the badge in its corner, and the overlay hidden until the
 * tile is focused.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { MediaGrid } from "./media-grid.js";

import "../reset.css";
import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** Mounts six tiles in a 302px box, the second one tall. */
function mountGrid(): RenderResult {
	return render(
		<div style="inline-size: 302px">
			<MediaGrid label="Posts">
				{[0, 1, 2, 3, 4, 5].map((index) => (
					<MediaGrid.Item
						id={`tile-${index}`}
						href={`#post-${index}`}
						label={`Post ${index + 1}`}
						tall={index === 1}
						badge={index === 0 ? <svg id="badge" viewBox="0 0 10 10" /> : undefined}
						overlay={index === 0 ? <span>12 likes</span> : undefined}
					>
						<div style="background: #777" />
					</MediaGrid.Item>
				))}
			</MediaGrid>
		</div>,
	);
}

/** A tile's box. */
function box(feed: RenderResult, index: number): DOMRect {
	return feed.container.querySelector(`#tile-${index} a`)!.getBoundingClientRect();
}

describe("MediaGrid", () => {
	test("lays three square tiles to a row with a hairline gap", () => {
		mounted = mountGrid();
		let first = box(mounted, 0);
		expect(first.width).toBeCloseTo(first.height, 0);
		expect(first.width).toBeCloseTo(99.33, 0);
	});

	test("stands a tall tile two rows high and fills the hole beside it", () => {
		mounted = mountGrid();
		let tall = box(mounted, 1);
		let square = box(mounted, 0);
		expect(tall.height).toBeCloseTo(square.height * 2 + 2, 0);
		let below = box(mounted, 3);
		expect(below.top).toBeCloseTo(square.bottom + 2, 0);
		expect(below.left).toBeCloseTo(square.left, 0);
	});

	test("hides the overlay until the tile is focused, and links each tile by name", () => {
		mounted = mountGrid();
		let link = mounted.container.querySelector<HTMLAnchorElement>("#tile-0 a")!;
		let overlay = mounted.container.querySelector<HTMLElement>("[data-media-grid-overlay]")!;
		expect(link.getAttribute("aria-label")).toBe("Post 1");
		expect(getComputedStyle(overlay).opacity).toBe("0");
		expect(mounted.container.querySelector("[data-media-grid-badge] #badge")).not.toBeNull();
	});
});
