/**
 * Holds the time grid's swipe to its contract on a touch screen: a quick horizontal swipe across
 * the hours follows the next or previous link, while a vertical stroke and a slow drag do not.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { TimeGrid } from "./time-grid.js";

import "../reset.css";
import "../theme.css";

let mounted: RenderResult | undefined;
let followed: string[] = [];

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	followed = [];
});

/** Mounts a three-day grid with previous and next pages, recording which link a swipe follows. */
async function mount(): Promise<HTMLElement> {
	mounted = render(
		<div style="display:flex; block-size:600px">
			<TimeGrid
				id="days"
				label="Three days"
				locale="en-US"
				days={[{ date: "2026-11-17" }, { date: "2026-11-18" }, { date: "2026-11-19" }]}
				events={[]}
				zones={[{ label: "EST", hours: Array.from({ length: 24 }, (_, hour) => `${hour}:00`) }]}
				pages={{ previous: "#previous", next: "#next" }}
				labels={{ allDay: "All day", now: "Now", moved: "{title} moved", resized: "{title} ends" }}
				style="flex: 1 1 auto"
			/>
		</div>,
	);
	for (let link of mounted.container.querySelectorAll<HTMLAnchorElement>("a[hidden]")) {
		link.addEventListener("click", (event) => {
			event.preventDefault();
			followed.push(link.getAttribute("href") ?? "");
		});
	}
	await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	return mounted.container.querySelector<HTMLElement>('[data-slot="time-grid-body"]')!;
}

/** Strokes a finger from one point to another over `duration` milliseconds. */
async function stroke(
	target: HTMLElement,
	from: [number, number],
	to: [number, number],
	duration = 120,
) {
	let init = (x: number, y: number) => ({
		bubbles: true,
		cancelable: true,
		clientX: x,
		clientY: y,
		pointerId: 7,
		pointerType: "touch",
		isPrimary: true,
	});
	target.dispatchEvent(new PointerEvent("pointerdown", init(...from)));
	window.dispatchEvent(
		new PointerEvent("pointermove", init((from[0] + to[0]) / 2, (from[1] + to[1]) / 2)),
	);
	await new Promise((resolve) => setTimeout(resolve, duration));
	window.dispatchEvent(new PointerEvent("pointerup", init(...to)));
}

describe("TimeGrid swipe", () => {
	test("follows the next page on a quick swipe left and the previous one on a swipe right", async () => {
		let body = await mount();
		await stroke(body, [300, 300], [120, 310]);
		await stroke(body, [120, 300], [320, 290]);
		expect(followed).toEqual(["#next", "#previous"]);
	});

	test("leaves a vertical stroke and a slow drag alone", async () => {
		let body = await mount();
		await stroke(body, [200, 400], [230, 150]);
		await stroke(body, [300, 300], [120, 300], 900);
		expect(followed).toEqual([]);
	});
});
