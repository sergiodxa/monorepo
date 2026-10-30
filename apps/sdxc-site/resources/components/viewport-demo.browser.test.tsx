/**
 * Tests the viewport stage against the real layout engine: the demo it frames lays out
 * against a 1280px or a 390px viewport whatever the guide's width, the screen always fits
 * the stage, and the frame grows to the demo's height up to the screen's.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import ViewportDemo from "~/resources/components/viewport-demo";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";

/** Host widths from a small phone to a wide desktop, which is every stage size a guide gives. */
const WIDTHS = [320, 375, 768, 1024, 1440];

/** The height of the stand-in demo, shorter than either screen. */
const DEMO_HEIGHT = 300;

/** A same-origin page standing in for a demo, so the test can read its viewport. */
let src = "";

let mounted: RenderResult | undefined;

beforeAll(() => {
	let html = `<!doctype html><body style="margin:0"><main data-frame-root style="block-size:${DEMO_HEIGHT}px"></main></body>`;
	src = URL.createObjectURL(new Blob([html], { type: "text/html" }));
});

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	await page.viewport(414, 896);
});

/** Mounts a stage the width of the viewport and waits for its demo to load. */
async function mount(width: number): Promise<HTMLIFrameElement> {
	await page.viewport(width, 900);
	mounted = render(<ViewportDemo name="demo" src={src} />);
	let frame = mounted.$("iframe") as HTMLIFrameElement;
	await expect.poll(() => frame.contentDocument?.querySelector("[data-frame-root]")).toBeTruthy();
	return frame;
}

/** Picks one of the stage's views, as a reader's click on its label does. */
function pick(view: "desktop" | "phone") {
	(mounted!.$(`input[value="${view}"]`) as HTMLInputElement).click();
}

/** Whether the screen ends inside the stage it is drawn on. */
function screenFits(): boolean {
	let screen = mounted!.$('[data-slot="viewport-screen"]') as HTMLElement;
	let stage = screen.parentElement!.getBoundingClientRect();
	let box = screen.getBoundingClientRect();
	return box.left >= stage.left - 0.5 && box.right <= stage.right + 0.5;
}

describe("ViewportDemo", () => {
	test.each(WIDTHS)("lays the desktop view out at 1280px on a %ipx page", async (width) => {
		let frame = await mount(width);

		expect(frame.contentWindow!.innerWidth).toBe(1280);
		expect(screenFits()).toBe(true);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
	});

	test.each(WIDTHS)("lays the phone view out at 390px on a %ipx page", async (width) => {
		let frame = await mount(width);
		pick("phone");

		await expect.poll(() => frame.contentWindow!.innerWidth).toBe(390);
		expect(screenFits()).toBe(true);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
	});

	test("grows the frame to the demo's height", async () => {
		let frame = await mount(1440);

		await expect.poll(() => frame.offsetHeight).toBe(DEMO_HEIGHT);
	});
});
