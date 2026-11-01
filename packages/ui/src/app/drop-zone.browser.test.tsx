/**
 * Lays the drop zone out in a real browser: its icon stacks above the centred copy, the native file
 * input stays out of sight yet focusable, the whole surface reads as clickable, and a narrow zone
 * never overflows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";

import { DropZone } from "./drop-zone.js";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
});

/** Mounts a media-library drop zone in a host `width` pixels wide and returns the zone. */
function mount(width = 960): HTMLLabelElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	mounted = render(
		<DropZone name="files" accept="image/png, image/jpeg" multiple>
			<svg data-testid="icon" width="20" height="20" aria-hidden="true" />
			<span data-testid="title">Drop images here, or click to choose</span>
			<span data-testid="hint">PNG or JPEG · up to 20 MB each</span>
		</DropZone>,
		{ container: host },
	);
	return host.querySelector<HTMLLabelElement>('[data-slot="zone"]')!;
}

describe("DropZone", () => {
	test("stacks its icon above the copy, centred on the zone", () => {
		let zone = mount();
		let box = zone.getBoundingClientRect();
		let icon = zone.querySelector('[data-testid="icon"]')!.getBoundingClientRect();
		let title = zone.querySelector('[data-testid="title"]')!.getBoundingClientRect();

		expect(icon.bottom).toBeLessThanOrEqual(title.top);
		expect(icon.left + icon.width / 2).toBeCloseTo(box.left + box.width / 2, 0);
		expect(title.left + title.width / 2).toBeCloseTo(box.left + box.width / 2, 0);
	});

	test("keeps the native file input out of sight while it stays focusable", async () => {
		let zone = mount();
		let input = zone.querySelector<HTMLInputElement>('input[type="file"]')!;
		let rect = input.getBoundingClientRect();

		expect(rect.width).toBeLessThanOrEqual(1);
		expect(rect.height).toBeLessThanOrEqual(1);

		await userEvent.tab();
		expect(document.activeElement).toBe(input);
	});

	test("reads as clickable across the whole surface", () => {
		let zone = mount();
		expect(getComputedStyle(zone).cursor).toBe("pointer");
	});

	test("fits a 320px column without overflowing", () => {
		let zone = mount(320);
		expect(zone.scrollWidth).toBeLessThanOrEqual(zone.clientWidth);
	});
});
