/**
 * Opens the phone sheet of each demo landing's header in a real browser: following a link in it closes the sheet, which a same-page link leaves open
 * otherwise, and a modified click keeps it open for the visitor still using it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import { SiteHeader as AppDemoHeader } from "~/resources/views/demos/app/site-chrome";
import BookHeader from "~/resources/views/demos/book/header";
import { SaasHeader } from "~/resources/views/demos/saas/header";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

/** Every header that carries a phone sheet, by the page it heads. */
const HEADERS: Array<[string, () => RemixNode]> = [
	["the app demo", () => <AppDemoHeader />],
	["the book demo", () => <BookHeader />],
	["the SaaS demo", () => <SaasHeader />],
];

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	await page.viewport(414, 896);
});

/**
 * Clicks `link` the way a visitor's press reaches it, with navigation cancelled once the
 * click has bubbled past the sheet, so the page under test stays loaded.
 */
function press(link: Element, init: MouseEventInit = {}) {
	document.addEventListener("click", (event) => event.preventDefault(), { once: true });
	link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...init }));
}

describe("header phone sheets", () => {
	test.each(HEADERS)("%s closes its sheet when a link in it is followed", async (_, header) => {
		await page.viewport(375, 812);
		mounted = render(header());
		let sheet = mounted.container.querySelector<HTMLDialogElement>(
			'[data-slot="site-header-sheet"]',
		)!;
		let link = sheet.querySelector('[data-slot="site-header-sheet-nav"] a[href]')!;

		sheet.showModal();
		press(link, { metaKey: true });
		expect(sheet.open).toBe(true);

		press(link);
		expect(sheet.open).toBe(false);
	});
});
