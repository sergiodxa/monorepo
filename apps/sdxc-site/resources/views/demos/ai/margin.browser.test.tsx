/**
 * Renders Margin's landing in a real browser: every timestamp links to a transcript line
 * that marks itself when reached, the calculator answers a GET query with no script, the
 * outline holds one `h1`, tinted bands stay flat, and nothing runs wider than a 320px phone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToStream } from "remix/component/server";
import { afterEach, describe, expect, test } from "vitest";
import { cdp, page } from "vitest/browser";

import landing from "~/resources/views/demos/ai/index";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

afterEach(async () => {
	document.body.replaceChildren();
	for (let style of document.head.querySelectorAll("style[data-margin-test]")) style.remove();
	history.replaceState(null, "", location.pathname + location.search);
	await cdp().send("Emulation.setEmulatedMedia", { features: [] });
	await page.viewport(414, 896);
});

/**
 * Puts the landing in the document as `/demo/ai` serves it for `query`: rendered on the
 * server, with each named frame filled from the landing's own `target`, and its styles kept.
 */
async function mount(query = "") {
	let url = new URL(`https://sdxc.dev/demo/ai${query}`);
	let html = await new Response(
		renderToStream(landing.render(url), {
			frameSrc: url.href,
			resolveFrame: (src, name) =>
				renderToStream(landing.target?.(name ?? "", new URL(src, url)) ?? null),
		}),
	).text();
	let rendered = new DOMParser().parseFromString(html, "text/html");
	for (let style of rendered.querySelectorAll("style")) {
		let copy = document.createElement("style");
		copy.setAttribute("data-margin-test", "");
		copy.textContent = style.textContent;
		document.head.appendChild(copy);
	}
	document.body.innerHTML = rendered.body.innerHTML;
	return document.body;
}

describe("Margin's landing", () => {
	test("links every timestamp to a transcript line", async () => {
		let root = await mount();
		let cites = [...root.querySelectorAll<HTMLAnchorElement>('[data-slot="margin-cite"]')];
		expect(cites.length).toBeGreaterThan(0);
		for (let cite of cites) {
			let id = cite.getAttribute("href")!.slice(1);
			expect(root.querySelector(`#${id}`)?.tagName, id).toBe("LI");
		}
	});

	test("marks the transcript line a timestamp lands on", async () => {
		let root = await mount();
		let line = root.querySelector<HTMLElement>("#t-0218")!;
		let before = getComputedStyle(line).backgroundColor;
		location.hash = "t-0218";
		expect(line.matches(":target")).toBe(true);
		expect(getComputedStyle(line).backgroundColor).not.toBe(before);
	});

	test("prints the bill for the hours and retention in the query", async () => {
		let root = await mount("?hours=250&retention=2-years");
		let form = root.querySelector<HTMLFormElement>("#pricing form")!;
		expect(form.method).toBe("get");
		expect(form.querySelector<HTMLInputElement>('input[name="hours"]')!.value).toBe("250");
		expect(form.querySelector<HTMLInputElement>('input[value="2-years"]')!.checked).toBe(true);
		expect(root.querySelector("#pricing tfoot td")?.textContent).toBe("$92.00");
	});

	test("falls back to the default estimate for a malformed query", async () => {
		let root = await mount("?hours=lots&retention=forever");
		expect(root.querySelector<HTMLInputElement>('input[name="hours"]')!.value).toBe("40");
		expect(root.querySelector("#pricing tfoot td")?.textContent).toBe("$12.60");
	});

	test("opens its outline with one h1 and skips no level", async () => {
		let root = await mount();
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

	test("paints its tinted bands flat, with no glow", async () => {
		let root = await mount();
		for (let id of ["drafting", "privacy"]) {
			expect(getComputedStyle(root.querySelector(`#${id}`)!).backgroundImage, id).toBe("none");
		}
	});

	test("rules a stacked privacy row only above the row, never between its cells", async () => {
		await page.viewport(375, 812);
		let root = await mount();
		let cells = root.querySelectorAll("#privacy tbody tr:nth-child(2) > *");
		for (let cell of cells) {
			expect(getComputedStyle(cell).borderTopWidth).toBe("0px");
		}
	});

	test("holds every scene still and finished when motion is reduced", async () => {
		await cdp().send("Emulation.setEmulatedMedia", {
			features: [{ name: "prefers-reduced-motion", value: "reduce" }],
		});
		let root = await mount();
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
		let root = await mount();
		for (let section of root.querySelectorAll<HTMLElement>("main > *")) {
			section.style.contentVisibility = "visible";
		}
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320);
	});
});
