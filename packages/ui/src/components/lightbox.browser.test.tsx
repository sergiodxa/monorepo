/**
 * Opens `Lightbox` in a real browser: a trigger opens it as a true modal at the photo it
 * names, arrow keys step through the photos and the announced counter follows, the step
 * links address each neighbour by id, the close button dismisses it, and nothing overflows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import { Lightbox } from "./lightbox.js";

import "../reset.css";
import "@sdxc/u/theme.css";
import "../theme.css";

/** Three drawn photos of a cabin stay. */
const PHOTOS: Lightbox.Photo[] = [
	{ alt: "The cabin at dusk", caption: "Outside", art: <svg viewBox="0 0 4 3" /> },
	{ alt: "The wood stove", caption: "Living room", art: <svg viewBox="0 0 4 3" /> },
	{ alt: "A loft bed", art: <svg viewBox="0 0 4 3" /> },
];

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
});

/** Mounts two triggers and the viewer, waits for the island, and returns the parts. */
async function mount(initial?: number) {
	mounted = render(
		<div>
			<Lightbox.Trigger lightbox="photos">Show all photos</Lightbox.Trigger>
			<Lightbox.Trigger lightbox="photos" index={2}>
				Loft
			</Lightbox.Trigger>
			<Lightbox id="photos" label="Photos of Fern Cabin" photos={PHOTOS} initial={initial} />
		</div>,
	);
	await new Promise((resolve) => requestAnimationFrame(resolve));
	await new Promise((resolve) => setTimeout(resolve, 0));
	let root = mounted.container;
	let triggers = [...root.querySelectorAll<HTMLButtonElement>("[data-slot=lightbox-trigger]")];
	return {
		dialog: root.querySelector<HTMLDialogElement>("dialog")!,
		triggers,
		track: root.querySelector<HTMLElement>("[data-lightbox-track]")!,
		status: root.querySelector<HTMLElement>("[data-lightbox-status]")!,
	};
}

/** The counter of the slide the script marks as in view. */
function currentCounter(dialog: HTMLDialogElement): string | null | undefined {
	return dialog.querySelector("[data-current] [data-slot=lightbox-counter]")?.textContent;
}

describe("Lightbox", () => {
	test("a trigger opens it as a modal at the photo it names, instantly", async () => {
		let { dialog, triggers, track, status } = await mount();
		expect(dialog.open).toBe(false);
		expect(dialog.getAttribute("aria-label")).toBe("Photos of Fern Cabin");

		triggers[1]!.click();
		expect(dialog.matches(":modal")).toBe(true);
		expect(Math.round(track.scrollLeft)).toBe(track.clientWidth * 2);
		expect(currentCounter(dialog)).toBe("3 / 3");
		expect(status.textContent).toBe("3 / 3");
	});

	test("arrow keys step through the photos and the counter follows", async () => {
		let { dialog, triggers, status } = await mount();
		triggers[0]!.click();
		expect(currentCounter(dialog)).toBe("1 / 3");
		expect(status.textContent).toBe("1 / 3. Outside");

		dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
		await expect.poll(() => currentCounter(dialog)).toBe("2 / 3");
		expect(status.textContent).toBe("2 / 3. Living room");

		dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
		await expect.poll(() => currentCounter(dialog)).toBe("1 / 3");
	});

	test("step links address each neighbour by id, and the ends have none", async () => {
		let { dialog } = await mount();
		let slides = [...dialog.querySelectorAll<HTMLElement>("[data-lightbox-slide]")];
		expect(slides.map((slide) => slide.id)).toEqual([
			"photos-photo-1",
			"photos-photo-2",
			"photos-photo-3",
		]);
		let hrefs = slides.map((slide) =>
			[...slide.querySelectorAll("a")].map((link) => link.getAttribute("href")),
		);
		expect(hrefs).toEqual([
			["#photos-photo-2"],
			["#photos-photo-1", "#photos-photo-3"],
			["#photos-photo-2"],
		]);
		expect(slides[1]!.querySelector("a")!.getAttribute("aria-label")).toBe("Previous photo");
	});

	test("a step link scrolls in place without changing the address", async () => {
		let { dialog, triggers } = await mount();
		triggers[0]!.click();
		let before = location.hash;
		dialog.querySelector<HTMLAnchorElement>("#photos-photo-1 a")!.click();
		await expect.poll(() => currentCounter(dialog)).toBe("2 / 3");
		expect(location.hash).toBe(before);
	});

	test("the close button closes it", async () => {
		let { dialog, triggers } = await mount();
		triggers[0]!.click();
		dialog.querySelector<HTMLButtonElement>("[data-slot=lightbox-close]")!.click();
		expect(dialog.open).toBe(false);
	});

	test("a server-opened viewer is upgraded to a modal at its initial photo", async () => {
		let { dialog } = await mount(1);
		expect(dialog.matches(":modal")).toBe(true);
		expect(currentCounter(dialog)).toBe("2 / 3");
	});

	test("fills a 320px screen without overflowing, with 44px controls", async () => {
		await page.viewport(320, 640);
		let { dialog, triggers } = await mount();
		triggers[0]!.click();
		let box = dialog.getBoundingClientRect();
		expect(box.left).toBe(0);
		expect(box.width).toBe(320);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320);
		for (let control of dialog.querySelectorAll("[data-slot=lightbox-close], a")) {
			let rect = control.getBoundingClientRect();
			expect(rect.width).toBe(44);
			expect(rect.height).toBe(44);
		}
	});
});
