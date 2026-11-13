/**
 * Renders the whole Plumb page in a real browser: dark whatever the reader's scheme, the
 * lime button legible, the install lines switching and copying apart from each other,
 * every in-page link landing on a section, no sideways scroll on a phone, and the phone
 * sheet closing when a link in it is followed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import demo from "~/resources/views/demos/library";
import { INSTALL } from "~/resources/views/demos/library/data";
import { LibraryHeader } from "~/resources/views/demos/library/header";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	await page.viewport(414, 896);
});

/** Mounts the page at `width` pixels and returns the theme root it paints. */
async function mount(width: number): Promise<HTMLElement> {
	await page.viewport(width, 900);
	mounted = render(demo.render());
	return mounted.container.querySelector<HTMLElement>('[data-slot="demo-theme"]')!;
}

/** The lightness of a computed colour, read back through a canvas as sRGB luminance. */
function luminance(color: string): number {
	let canvas = document.createElement("canvas");
	canvas.width = canvas.height = 1;
	let context = canvas.getContext("2d")!;
	context.fillStyle = color;
	context.fillRect(0, 0, 1, 1);
	let [r, g, b] = [...context.getImageData(0, 0, 1, 1).data].map((channel) => {
		let value = channel / 255;
		return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** The contrast ratio between two computed colours. */
function contrast(a: string, b: string): number {
	let [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (light! + 0.05) / (dark! + 0.05);
}

describe("the Plumb page", () => {
	test("paints dark in a light-scheme document, with legible text and a lime button", async () => {
		let root = await mount(1440);
		let style = getComputedStyle(root);
		expect(style.colorScheme).toBe("dark");
		expect(luminance(style.backgroundColor)).toBeLessThan(0.02);
		expect(contrast(style.color, style.backgroundColor)).toBeGreaterThan(12);

		let cta = [...root.querySelectorAll<HTMLElement>("a")].find(
			(link) => link.textContent === "Get started",
		)!;
		let button = getComputedStyle(cta);
		expect(luminance(button.backgroundColor)).toBeGreaterThan(0.5);
		expect(contrast(button.color, button.backgroundColor)).toBeGreaterThan(7);
	});

	test("switches each install line on its own and copies the command it shows", async () => {
		let root = await mount(1440);
		let [hero, closing] = [...root.querySelectorAll<HTMLElement>('[data-slot="install-tabs"]')];
		expect(hero).toBeDefined();
		expect(closing).toBeDefined();

		let visible = (strip: HTMLElement) =>
			[...strip.querySelectorAll<HTMLElement>("code")].filter((code) => code.offsetParent !== null);

		expect(visible(hero!).map((code) => code.textContent)).toEqual([INSTALL[0].command]);

		await userEvent.click(hero!.querySelector<HTMLElement>('label[for="plumb-install-hero-bun"]')!);
		expect(visible(hero!).map((code) => code.textContent)).toEqual(["bun add plumb"]);
		expect(visible(closing!).map((code) => code.textContent)).toEqual([INSTALL[0].command]);

		let shown = visible(hero!)[0]!;
		let copy = shown.parentElement!.querySelector<HTMLButtonElement>('[data-slot="copy-button"]')!;
		expect(copy.getAttribute("commandfor")).toBe(shown.id);
		expect(copy.getAttribute("aria-label")).toBe("Copy the bun command");
	});

	test("lands every in-page link on an element of the page", async () => {
		let root = await mount(1440);
		let targets = new Set(
			[...root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')].map((link) =>
				link.getAttribute("href")!.slice(1),
			),
		);
		expect(targets.size).toBeGreaterThan(5);
		for (let target of targets) expect(document.getElementById(target), target).not.toBeNull();
	});

	test("never scrolls sideways on a phone", async () => {
		await mount(375);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
	});

	test("closes the phone sheet when a link in it is followed", async () => {
		await page.viewport(375, 812);
		mounted = render(<LibraryHeader />);
		let sheet = mounted.container.querySelector<HTMLDialogElement>(
			'[data-slot="site-header-sheet"]',
		)!;
		let link = sheet.querySelector('[data-slot="site-header-sheet-nav"] a[href]')!;

		sheet.showModal();
		document.addEventListener("click", (event) => event.preventDefault(), { once: true });
		link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
		expect(sheet.open).toBe(false);
	});
});
