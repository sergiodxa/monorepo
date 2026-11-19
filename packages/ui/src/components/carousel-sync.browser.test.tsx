/**
 * Runs a Carousel through its `CarouselSync` island in a real page: a dot scrolls to its slide
 * and takes `aria-current`, the `n / N` count follows the slide in view, the arrows disable at
 * either end, and the root is marked ready for controls that only make sense with script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { Carousel, CarouselSync } from "./carousel.js";

import "../reset.css";
import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** Mounts three 300px slides in a 300px viewport, with arrows, dots, a count and the island. */
function mountPhotos(): RenderResult {
	return render(
		<div style="inline-size: 300px">
			<Carousel aria-label="Photos" style="--ui-carousel-slide-size: 100%; --ui-carousel-gap: 0px">
				<Carousel.Viewport id="photos" style="scroll-behavior: auto">
					<Carousel.Track>
						{[0, 1, 2].map((index) => (
							<Carousel.Slide aria-label={`${index + 1} of 3`}>
								<div style="block-size: 200px; background: #888" />
							</Carousel.Slide>
						))}
					</Carousel.Track>
				</Carousel.Viewport>
				<Carousel.Count viewport="photos" total={3} id="count" />
				<Carousel.Dots commandfor="photos" count={3} label={(index) => `Photo ${index + 1} of 3`} />
				<Carousel.Previous commandfor="photos" aria-label="Previous photo" />
				<Carousel.Next commandfor="photos" aria-label="Next photo" />
				<CarouselSync />
			</Carousel>
		</div>,
	);
}

/** The dots' `aria-current`, in order. */
function currentDots(feed: RenderResult): Array<string | null> {
	return [...feed.container.querySelectorAll("[data-slot=dots] button")].map((dot) =>
		dot.getAttribute("aria-current"),
	);
}

describe("Carousel with CarouselSync", () => {
	test("renders the first dot current and the count at 1 / N before script", () => {
		mounted = mountPhotos();
		expect(currentDots(mounted)).toEqual(["true", null, null]);
		expect(mounted.container.querySelector("#count")?.textContent).toBe("1 / 3");
	});

	test("a dot scrolls to its slide, and the dots, count and arrows follow", async () => {
		mounted = mountPhotos();
		let feed = mounted;
		await vi.waitFor(() =>
			expect(
				feed.container.querySelector("[data-slot=carousel][data-carousel-ready]"),
			).not.toBeNull(),
		);
		let previous = feed.container.querySelector<HTMLButtonElement>(
			'[aria-label="Previous photo"]',
		)!;
		let next = feed.container.querySelector<HTMLButtonElement>('[aria-label="Next photo"]')!;
		expect(previous.disabled).toBe(true);

		feed.container.querySelector<HTMLButtonElement>('[aria-label="Photo 3 of 3"]')!.click();

		await vi.waitFor(() => expect(currentDots(feed)).toEqual([null, null, "true"]));
		expect(feed.container.querySelector("#count")?.textContent).toBe("3 / 3");
		expect(next.disabled).toBe(true);
		expect(previous.disabled).toBe(false);
	});

	test("the previous arrow steps back one slide", async () => {
		mounted = mountPhotos();
		let feed = mounted;
		let viewport = feed.container.querySelector<HTMLElement>("#photos")!;
		await vi.waitFor(() =>
			expect(feed.container.querySelector("[data-carousel-ready]")).not.toBeNull(),
		);
		viewport.scrollLeft = 600;

		await vi.waitFor(() =>
			expect(feed.container.querySelector("#count")?.textContent).toBe("3 / 3"),
		);
		feed.container.querySelector<HTMLButtonElement>('[aria-label="Previous photo"]')!.click();

		await vi.waitFor(() =>
			expect(feed.container.querySelector("#count")?.textContent).toBe("2 / 3"),
		);
	});
});
