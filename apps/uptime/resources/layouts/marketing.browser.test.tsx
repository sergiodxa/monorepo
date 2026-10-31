/**
 * Lays the marketing chrome out in a real browser: at laptop and desktop widths every
 * footer link keeps its label on one line beside the brand block, the footer stays inside
 * the viewport on a phone, and the phone sheet closes when one of its links is followed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { createTranslator } from "@sdxc/i18n";
import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import MarketingLayout, { buildMarketingChrome } from "~/resources/layouts/marketing";
import en from "~/resources/locales/en";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";

/** English copy, built here because the app's translator also wires the server logger. */
const translate = createTranslator({
	resources: { en },
	supportedLanguages: ["en"],
	fallbackLanguage: "en",
});

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	await page.viewport(414, 896);
});

/** Mounts the layout around an empty page, signed out. */
function mountLayout() {
	let { t } = translate("en");
	mounted = render(
		<MarketingLayout isSignedIn={false} {...buildMarketingChrome(t)}>
			<p>Page</p>
		</MarketingLayout>,
	);
	return mounted;
}

/**
 * Clicks `link` the way a visitor's press reaches it, with navigation cancelled once the
 * click has bubbled past the sheet, so the page under test stays loaded.
 */
function press(link: Element, init: MouseEventInit = {}) {
	document.addEventListener("click", (event) => event.preventDefault(), { once: true });
	link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...init }));
}

/** Footer column links whose label breaks onto a second line. */
function wrappedLinks(container: Element): string[] {
	return [...container.querySelectorAll('[data-slot="site-footer-column"] a')]
		.filter((link) => {
			let range = document.createRange();
			range.selectNodeContents(link);
			let lines = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)));
			return lines.size > 1;
		})
		.map((link) => link.textContent?.trim() ?? "");
}

describe("MarketingLayout", () => {
	test.each([1280, 1440])("keeps every footer link on one line at %ipx", async (width) => {
		await page.viewport(width, 900);
		let { container } = mountLayout();

		expect(wrappedLinks(container)).toEqual([]);
	});

	test("lists the use cases and audiences together under Solutions", () => {
		let { container } = mountLayout();
		let titles = [...container.querySelectorAll('[data-slot="site-footer-column-title"]')].map(
			(title) => title.textContent?.trim(),
		);

		expect(titles).toEqual(["Features", "Solutions", "Compare", "Documentation"]);
	});

	test("keeps the footer inside a 320px viewport", async () => {
		await page.viewport(320, 800);
		let { container } = mountLayout();
		let limit = document.documentElement.clientWidth + 1;
		let wide = [...container.querySelectorAll("footer *")].filter((element) => {
			let box = element.getBoundingClientRect();
			return box.width > 0 && box.right > limit;
		});

		expect(wide.map((element) => element.outerHTML.slice(0, 80))).toEqual([]);
	});

	test("closes the phone sheet when a link in it is followed, and not on a modified click", async () => {
		await page.viewport(375, 812);
		let { container } = mountLayout();
		let sheet = container.querySelector<HTMLDialogElement>('[data-slot="site-header-sheet"]')!;
		let link = sheet.querySelector('[data-slot="site-header-sheet-nav"] a[href]')!;

		sheet.showModal();
		press(link, { metaKey: true });
		expect(sheet.open).toBe(true);

		press(link);
		expect(sheet.open).toBe(false);
	});
});
