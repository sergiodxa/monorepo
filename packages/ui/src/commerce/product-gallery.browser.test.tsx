/**
 * Holds the product gallery to its contract in a real browser: wide, a stage beside a rail
 * of thumbnail links marked at the current picture, a zoom that follows the pointer and a
 * Lightbox button; on a phone, a scroll-snap strip of every picture with the rail hidden.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import { ProductGallery, zoomOnHover } from "./product-gallery.js";

import "../theme.css";

let mounted: RenderResult | undefined;

beforeEach(async () => {
	await page.viewport(1280, 800);
});

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** Three pictures of one poster. */
const IMAGES: ProductGallery.Image[] = ["front", "framed", "detail"].map((id) => ({
	id,
	alt: `Poster, ${id}`,
	href: `?image=${id}`,
	media: <svg viewBox="0 0 4 5" data-image={id} />,
}));

/** Mounts a gallery 640px wide and returns its host. */
function mount(current = "framed"): HTMLElement {
	mounted = render(
		<div style={{ inlineSize: "640px" }}>
			<ProductGallery
				id="poster"
				images={IMAGES}
				current={current}
				lightbox="poster-photos"
				labels={{ zoom: "Zoom", image: "Image {n} of {total}" }}
			/>
		</div>,
	);
	return mounted.container.querySelector<HTMLElement>('[data-slot="product-gallery"]')!;
}

/** Waits until a check passes, for an island whose task runs after the first render. */
async function until(check: () => boolean, timeout = 2000): Promise<void> {
	let start = performance.now();
	while (!check()) {
		if (performance.now() - start > timeout) throw new Error("timed out");
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
}

describe("ProductGallery wide", () => {
	test("shows the current picture on the stage and marks its thumbnail", () => {
		let gallery = mount();
		let stage = gallery.querySelector<HTMLElement>('[data-slot="product-gallery-stage"]')!;
		expect(stage.getAttribute("aria-label")).toBe("Poster, framed");
		expect(stage.querySelector("[data-image]")!.getAttribute("data-image")).toBe("framed");
		let thumbs = [
			...gallery.querySelectorAll<HTMLAnchorElement>('[data-slot="product-gallery-thumbnail"]'),
		];
		expect(thumbs.map((thumb) => thumb.getAttribute("href"))).toEqual([
			"?image=front",
			"?image=framed",
			"?image=detail",
		]);
		expect(thumbs.map((thumb) => thumb.getAttribute("aria-current"))).toEqual([null, "true", null]);
		expect(
			getComputedStyle(gallery.querySelector('[data-slot="product-gallery-strip"]')!).display,
		).toBe("none");
	});

	test("opens the Lightbox at the current picture", () => {
		let gallery = mount("detail");
		let zoom = gallery.querySelector<HTMLButtonElement>('[data-slot="lightbox-trigger"]')!;
		expect(zoom.getAttribute("command")).toBe("show-modal");
		expect(zoom.getAttribute("commandfor")).toBe("poster-photos");
		expect(zoom.getAttribute("data-lightbox-index")).toBe("2");
		expect(zoom.getAttribute("aria-label")).toBe("Zoom");
	});

	test("falls back to the first picture for an unknown id", () => {
		let gallery = mount("missing");
		let stage = gallery.querySelector('[data-slot="product-gallery-stage"]')!;
		expect(stage.getAttribute("aria-label")).toBe("Poster, front");
	});

	test("zooms from the point under a mouse", async () => {
		let gallery = mount();
		let stage = gallery.querySelector<HTMLElement>('[data-slot="product-gallery-stage"]')!;
		await until(() => stage.hasAttribute("data-zoom-tracked"));
		let box = stage.getBoundingClientRect();
		stage.dispatchEvent(
			new PointerEvent("pointermove", {
				pointerType: "mouse",
				clientX: box.left + box.width / 4,
				clientY: box.top + box.height / 2,
				bubbles: true,
			}),
		);
		expect(stage.style.getPropertyValue("--ui-zoom-x")).toBe("25%");
		expect(stage.style.getPropertyValue("--ui-zoom-y")).toBe("50%");
		await userEvent.hover(stage);
		let picture = stage.firstElementChild as HTMLElement;
		await until(() => getComputedStyle(picture).transform.startsWith("matrix(2"));
		stage.dispatchEvent(new PointerEvent("pointerleave"));
		expect(stage.style.getPropertyValue("--ui-zoom-x")).toBe("");
	});

	test("leaves the origin centred under touch", async () => {
		mounted = render(
			<div mix={[zoomOnHover()]} style={{ inlineSize: "200px", blockSize: "200px" }}>
				<span />
			</div>,
		);
		let host = mounted.container.firstElementChild as HTMLElement;
		host.dispatchEvent(
			new PointerEvent("pointermove", { pointerType: "touch", clientX: 1, clientY: 1 }),
		);
		expect(host.style.getPropertyValue("--ui-zoom-x")).toBe("");
	});
});

describe("ProductGallery on a phone", () => {
	test("hides the rail and stage and lays every picture in a snap strip", async () => {
		await page.viewport(375, 800);
		let gallery = mount();
		expect(
			getComputedStyle(gallery.querySelector('[data-slot="product-gallery-thumbnails"]')!).display,
		).toBe("none");
		expect(
			getComputedStyle(gallery.querySelector('[data-slot="product-gallery-main"]')!).display,
		).toBe("none");
		let track = gallery.querySelector<HTMLElement>('[data-slot="product-gallery-track"]')!;
		expect(getComputedStyle(track).scrollSnapType).toBe("x mandatory");
		let slides = [...track.querySelectorAll('[data-slot="product-gallery-slide"]')];
		expect(slides.map((slide) => slide.getAttribute("aria-label"))).toEqual([
			"Poster, front, Image 1 of 3",
			"Poster, framed, Image 2 of 3",
			"Poster, detail, Image 3 of 3",
		]);
		expect(slides[0]!.getBoundingClientRect().width).toBeCloseTo(track.clientWidth, 0);
		expect(gallery.querySelectorAll('[data-slot="product-gallery-dots"] a')).toHaveLength(3);
	});
});
