/**
 * Renders Margin's landing in a real browser: every timestamp links to a transcript line
 * that marks itself when reached, the calculator answers a GET query with no script, the
 * outline holds one `h1`, tinted bands stay flat, and nothing runs wider than a 320px phone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { cdp, page } from "vitest/browser";

import landing from "~/resources/views/demos/ai/index";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	history.replaceState(null, "", location.pathname + location.search);
	await cdp().send("Emulation.setEmulatedMedia", { features: [] });
	await page.viewport(414, 896);
});

/** Mounts the landing as `/demo/ai` renders it for `query`. */
function mount(query = "") {
	mounted = render(landing.render(new URL(`https://sdxc.dev/demo/ai${query}`)));
	return mounted.container;
}

describe("Margin's landing", () => {
	test("links every timestamp to a transcript line", () => {
		let root = mount();
		let cites = [...root.querySelectorAll<HTMLAnchorElement>('[data-slot="margin-cite"]')];
		expect(cites.length).toBeGreaterThan(0);
		for (let cite of cites) {
			let id = cite.getAttribute("href")!.slice(1);
			expect(root.querySelector(`#${id}`)?.tagName, id).toBe("LI");
		}
	});

	test("marks the transcript line a timestamp lands on", () => {
		let root = mount();
		let line = root.querySelector<HTMLElement>("#t-0218")!;
		let before = getComputedStyle(line).backgroundColor;
		location.hash = "t-0218";
		expect(line.matches(":target")).toBe(true);
		expect(getComputedStyle(line).backgroundColor).not.toBe(before);
	});

	test("prints the bill for the hours and retention in the query", () => {
		let root = mount("?hours=250&retention=2-years");
		let form = root.querySelector<HTMLFormElement>("#pricing form")!;
		expect(form.method).toBe("get");
		expect(form.querySelector<HTMLInputElement>('input[name="hours"]')!.value).toBe("250");
		expect(form.querySelector<HTMLInputElement>('input[value="2-years"]')!.checked).toBe(true);
		expect(root.querySelector("#pricing tfoot td")?.textContent).toBe("$92.00");
	});

	test("falls back to the default estimate for a malformed query", () => {
		let root = mount("?hours=lots&retention=forever");
		expect(root.querySelector<HTMLInputElement>('input[name="hours"]')!.value).toBe("40");
		expect(root.querySelector("#pricing tfoot td")?.textContent).toBe("$12.60");
	});

	test("opens its outline with one h1 and skips no level", () => {
		let root = mount();
		let levels = [...root.querySelectorAll("h1, h2, h3, h4, h5, h6")]
			.filter((heading) => heading.checkVisibility() || heading.closest("main"))
			.map((heading) => Number(heading.tagName[1]));
		expect(levels.filter((level) => level === 1)).toHaveLength(1);
		let main = [...root.querySelectorAll("main :is(h1, h2, h3, h4)")].map((h) =>
			Number(h.tagName[1]),
		);
		expect(main[0]).toBe(1);
		for (let [index, level] of main.entries()) {
			if (index > 0) expect(level - main[index - 1]!, `heading ${index}`).toBeLessThanOrEqual(1);
		}
	});

	test("paints its tinted bands flat, with no glow", () => {
		let root = mount();
		for (let id of ["drafting", "privacy"]) {
			expect(getComputedStyle(root.querySelector(`#${id}`)!).backgroundImage, id).toBe("none");
		}
	});

	test("rules a stacked privacy row only above the row, never between its cells", async () => {
		await page.viewport(375, 812);
		let root = mount();
		let cells = root.querySelectorAll("#privacy tbody tr:nth-child(2) > *");
		for (let cell of cells) {
			expect(getComputedStyle(cell).borderTopWidth).toBe("0px");
		}
	});

	test("holds every scene still and finished when motion is reduced", async () => {
		await cdp().send("Emulation.setEmulatedMedia", {
			features: [{ name: "prefers-reduced-motion", value: "reduce" }],
		});
		let root = mount();
		for (let section of root.querySelectorAll<HTMLElement>("main > *")) {
			section.style.contentVisibility = "visible";
		}
		let timed = document
			.getAnimations()
			.filter((animation) => animation.timeline instanceof DocumentTimeline);
		expect(timed.map((animation) => (animation as CSSAnimation).animationName)).toEqual([]);
		let typed = root.querySelectorAll('#drafting [data-kind="output"]');
		expect(typed.length).toBeGreaterThan(0);
		for (let line of typed) expect(getComputedStyle(line).opacity).toBe("1");
	});

	test("stays inside a 320px phone", async () => {
		await page.viewport(320, 720);
		let root = mount();
		for (let section of root.querySelectorAll<HTMLElement>("main > *")) {
			section.style.contentVisibility = "visible";
		}
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320);
	});
});
