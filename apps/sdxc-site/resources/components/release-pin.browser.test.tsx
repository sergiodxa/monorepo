/**
 * Hovers the release pin in a real browser: the pill and its text hold their box, the fill
 * deepens rather than clearing, and only the arrow nudges, which reduced motion keeps still.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { cdp, page } from "vitest/browser";

import ReleasePin from "~/resources/components/release-pin";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";

/** A release as the changelog reads it, with only the fields the pin shows filled in. */
const RELEASE = {
	version: "2026.10.30",
	publishedAt: "2026-10-30T03:49:41Z",
	href: "https://github.com/sergiodxa/monorepo/releases/tag/2026.10.30",
	notes: "",
};

/** How long the test waits for the pin's 150ms transitions to settle. */
const SETTLE_MS = 400;

/** Mounts the pin and returns its link. */
function mount(): HTMLAnchorElement {
	let host = document.createElement("div");
	host.style.cssText = "display: flex; flex-direction: column; inline-size: 600px; padding: 40px";
	document.body.appendChild(host);
	render(<ReleasePin release={RELEASE} />, { container: host });
	let link = host.querySelector("a");
	if (!link) throw new Error("missing the pin link");
	return link;
}

/** The pin's pill, label, version and arrow boxes, rounded to a hundredth of a pixel. */
function measure(link: HTMLAnchorElement) {
	let box = (element: Element | null) => {
		if (!element) throw new Error("missing a pin part");
		let { x, y, width, height } = element.getBoundingClientRect();
		let round = (value: number) => Math.round(value * 100) / 100;
		return { x: round(x), y: round(y), width: round(width), height: round(height) };
	};
	return {
		pill: box(link),
		label: box(link.querySelector("span")),
		version: box(link.querySelector("time")),
		arrow: box(link.querySelector("svg")),
	};
}

/** Moves the pointer onto the pin's label and waits for the transitions to finish. */
async function hover(link: HTMLAnchorElement) {
	let label = link.querySelector("span");
	if (!label) throw new Error("missing the pin label");
	await page.elementLocator(label).hover();
	await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
}

afterEach(async () => {
	document.body.replaceChildren();
	await cdp().send("Emulation.setEmulatedMedia", { features: [] });
});

describe("ReleasePin hover", () => {
	test("keeps the pill and its text in place and nudges only the arrow", async () => {
		let link = mount();
		let rest = measure(link);
		let restFill = getComputedStyle(link).backgroundColor;

		await hover(link);
		let hovered = measure(link);

		expect(link.matches(":hover")).toBe(true);
		expect(hovered.pill).toEqual(rest.pill);
		expect(hovered.label).toEqual(rest.label);
		expect(hovered.version).toEqual(rest.version);
		expect(hovered.arrow).toEqual({ ...rest.arrow, x: rest.arrow.x + 2 });
		expect(getComputedStyle(link).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
		expect(getComputedStyle(link).backgroundColor).not.toBe(restFill);
	});

	test("keeps the arrow still when motion is reduced", async () => {
		await cdp().send("Emulation.setEmulatedMedia", {
			features: [{ name: "prefers-reduced-motion", value: "reduce" }],
		});
		let link = mount();
		let rest = measure(link);

		await hover(link);

		expect(link.matches(":hover")).toBe(true);
		expect(measure(link)).toEqual(rest);
	});
});
