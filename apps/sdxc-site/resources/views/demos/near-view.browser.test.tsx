/**
 * Renders each demo landing in a real browser and checks its heavy below-the-fold sections
 * skip rendering until they near the viewport, the hero always renders, and a link to an
 * anchor inside a skipped section still lands its target in view under the sticky header.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import type { DemoLanding } from "~/resources/views/demos";

import app from "~/resources/views/demos/app/index";
import book from "~/resources/views/demos/book/index";
import saas from "~/resources/views/demos/saas/index";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

/** Each landing with the ids of the sections that render only near the viewport. */
const LANDINGS: Array<[string, DemoLanding, string[]]> = [
	["Keel", saas, ["product", "workflow", "platform", "security", "customers", "pricing"]],
	["The Measure", book, ["sample", "contents", "learn", "author", "reviews", "pricing"]],
	["Rooftree", app, ["features", "stories", "small-things", "privacy", "platforms", "pricing"]],
];

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	history.replaceState(null, "", location.pathname + location.search);
	scrollTo(0, 0);
	await page.viewport(414, 896);
});

/** Waits until the browser has run style, layout and paint for at least one frame. */
function nextFrame() {
	return new Promise<void>((resolve) => {
		requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
	});
}

describe("demo landing sections rendered near the viewport", () => {
	test.each(LANDINGS)("%s skips its heavy sections but never its hero", async (_, landing, ids) => {
		await page.viewport(1440, 900);
		mounted = render(landing.render());

		for (let id of ids) {
			let style = getComputedStyle(document.getElementById(id)!);
			expect(style.contentVisibility, id).toBe("auto");
			expect(style.containIntrinsicSize, id).toMatch(/^auto \d+px$/);
		}

		let hero = getComputedStyle(document.querySelector("main section")!);
		expect(hero.contentVisibility).toBe("visible");
		expect(hero.containIntrinsicSize).toBe("none");
	});

	test.each(LANDINGS)("%s takes a smaller phone placeholder", async (_, landing) => {
		await page.viewport(1440, 900);
		mounted = render(landing.render());
		let desktop = getComputedStyle(document.getElementById("pricing")!).containIntrinsicSize;

		await page.viewport(375, 812);
		let phone = getComputedStyle(document.getElementById("pricing")!).containIntrinsicSize;

		expect(parseFloat(phone.slice("auto ".length))).toBeGreaterThan(
			parseFloat(desktop.slice("auto ".length)),
		);
	});

	test.each(LANDINGS)("%s lands a link to #pricing inside the viewport", async (_, landing) => {
		await page.viewport(1440, 900);
		mounted = render(landing.render());
		await nextFrame();
		let target = document.getElementById("pricing")!;
		expect(target.firstElementChild!.checkVisibility({ contentVisibilityAuto: true })).toBe(false);

		let link = document.createElement("a");
		link.href = "#pricing";
		document.body.appendChild(link);
		link.click();
		link.remove();
		await nextFrame();

		let top = target.getBoundingClientRect().top;
		let margin = parseFloat(getComputedStyle(target).scrollMarginBlockStart);
		expect(top).toBeGreaterThanOrEqual(0);
		expect(top).toBeLessThan(innerHeight);
		expect(Math.abs(top - margin)).toBeLessThanOrEqual(2);
	});
});
