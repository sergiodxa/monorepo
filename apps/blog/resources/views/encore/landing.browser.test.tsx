/**
 * Measures Encore's landing in a real browser under its own theme: at 320px nothing reaches
 * past the page's edge in any of its languages, except inside the rows that scroll sideways
 * by design, and the drawn cards keep the app's 320 × 460 proportions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { EncoreLandingContent } from "~/resources/views/encore/landing";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";
import "~/resources/css/encore.css";

/** What the current test mounted, unmounted after it. */
let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.documentElement.className = "";
	document.documentElement.lang = "";
});

/** Whether `element` sits inside a box that scrolls or clips its own overflow. */
function insideScroller(element: Element, host: Element): boolean {
	for (
		let parent = element.parentElement;
		parent && parent !== host;
		parent = parent.parentElement
	) {
		let overflow = getComputedStyle(parent).overflowX;
		if (["auto", "scroll", "hidden", "clip"].includes(overflow)) return true;
	}
	return false;
}

/** Mounts the landing in `language` inside a host `width` pixels wide. */
function mount(width: number, language: "en" | "es-AR" | "ja" = "en"): HTMLElement {
	document.documentElement.className = "system encore";
	document.documentElement.lang = language;
	let host = document.createElement("div");
	host.style.inlineSize = `${width}px`;
	document.body.appendChild(host);
	mounted = render(<EncoreLandingContent locale={language} />, { container: host });
	for (let section of Array.from(host.querySelectorAll<HTMLElement>("section"))) {
		section.style.contentVisibility = "visible";
	}
	return host;
}

describe("The deck", () => {
	test("turns a card over when the reader taps it", () => {
		let host = mount(1200);

		let label = host.querySelector<HTMLLabelElement>("#deck li label");
		let flipper = label?.querySelector<HTMLElement>(":scope > span[aria-hidden]");
		expect(flipper && getComputedStyle(flipper).transform).toBe("none");
		label?.click();
		expect(label?.querySelector("input")?.checked).toBe(true);
		flipper?.getAnimations().forEach((animation) => animation.finish());
		expect(flipper && getComputedStyle(flipper).transform).not.toBe("none");
		host.remove();
	});
});

describe("EncoreLandingContent", () => {
	test.each(["en", "es-AR", "ja"] as const)(
		"keeps every box inside a 320px page in %s",
		(language) => {
			let host = mount(320, language);

			let edge = host.getBoundingClientRect().right;
			let escaping = Array.from(host.querySelectorAll("*"))
				.filter((element) => !insideScroller(element, host))
				.filter((element) => element.getBoundingClientRect().right > edge + 1)
				.map((element) => `${element.tagName.toLowerCase()} ${element.textContent?.slice(0, 40)}`);

			expect(escaping).toEqual([]);
			expect(host.scrollWidth).toBeLessThanOrEqual(320);
			host.remove();
		},
	);

	test("draws its cards in the app's 320 × 460 proportions", () => {
		let host = mount(1200);

		let cards = Array.from(
			host.querySelectorAll<HTMLElement>("#deck li label > span > span > div"),
		);
		expect(cards).toHaveLength(10);
		for (let card of cards) {
			expect(card.offsetHeight / card.offsetWidth).toBeCloseTo(460 / 320, 2);
		}
		host.remove();
	});

	test("hides the drawn stage cards on a phone, where they would cover the screens", () => {
		let host = mount(375);

		let stageCards = Array.from(
			host.querySelectorAll<HTMLElement>("#top div[aria-hidden='true']"),
		).filter((element) => getComputedStyle(element).rotate !== "none");
		expect(stageCards).toHaveLength(2);
		expect(stageCards.map((card) => getComputedStyle(card).display)).toEqual(["none", "none"]);
		host.remove();
	});
});
