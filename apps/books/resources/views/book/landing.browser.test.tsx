/**
 * Lays a book's landing out in a real browser at every width a reader brings, in both
 * schemes: nothing scrolls sideways, every text run clears WCAG contrast against its band,
 * the outline has one `h1`, and the actions that sit side by side line up.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import type { Scheme } from "~/app/test/mount-page";

import {
	WIDTHS,
	contrastFailures,
	headingLevels,
	horizontalOverflow,
	overflowingElements,
} from "~/app/test/layout-audit";
import { imagesSettled, mountPage } from "~/app/test/mount-page";
import { BOOKS } from "~/config/books";
import { Product } from "~/config/products";
import { BOOK_COPY } from "~/resources/content/books";
import BookLanding from "~/resources/views/book/landing";
import BookFooter from "~/resources/views/site/footer";
import BookHeader from "~/resources/views/site/header";

/** The book under test, with a launch price on its flagship so the struck price renders. */
const BOOK = BOOKS["react-router-oauth2"];
const LANDING = "/react-router-oauth2";

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	await page.viewport(414, 896);
});

/** Mounts the landing with its header and footer, as the controller composes it. */
async function mountLanding(scheme: Scheme = "light") {
	let copy = BOOK_COPY[BOOK.slug];
	mounted = await mountPage(
		<>
			<BookHeader landing={LANDING} title={copy.shortTitle} sample />
			<BookLanding
				book={BOOK}
				copy={copy}
				from="$49"
				prices={{
					[Product.Complete]: { price: "$99", discounted: "$69" },
					[Product.Essentials]: { price: "$49" },
				}}
				links={{
					sample: `${LANDING}/sample`,
					upgrade: `${LANDING}/upgrade`,
					checkout: {
						[Product.Complete]: "/api/checkout/complete",
						[Product.Essentials]: "/api/checkout/essentials",
					},
				}}
			/>
			<BookFooter landing={LANDING} title={copy.shortTitle} tagline={BOOK.description} />
		</>,
		scheme,
	);
	await imagesSettled(mounted.container);
	return mounted.container;
}

describe("the book landing", () => {
	for (let scheme of ["light", "dark"] as const) {
		test.each(WIDTHS)(`never scrolls sideways at %ipx (${scheme})`, async (width) => {
			await page.viewport(width, 900);
			let container = await mountLanding(scheme);

			expect(overflowingElements(container)).toEqual([]);
			expect(horizontalOverflow()).toBe(0);
		});

		test.each([375, 1280])(
			`keeps every text run at WCAG contrast at %ipx (${scheme})`,
			async (width) => {
				await page.viewport(width, 900);
				let container = await mountLanding(scheme);

				expect(contrastFailures(container)).toEqual([]);
			},
		);
	}

	test("has one h1, first, and never skips a heading level", async () => {
		let levels = headingLevels(await mountLanding());

		expect(levels.filter((level) => level === 1)).toHaveLength(1);
		expect(levels[0]).toBe(1);
		for (let [index, level] of levels.entries()) {
			expect(level - (levels[index - 1] ?? 0)).toBeLessThanOrEqual(1);
		}
	});

	test.each([1024, 1440])("lines the two plans' buy buttons up at %ipx", async (width) => {
		await page.viewport(width, 900);
		let container = await mountLanding();
		let buttons = [...container.querySelectorAll("#pricing a[href^='/api/checkout/']")];
		let tops = new Set(buttons.map((button) => Math.round(button.getBoundingClientRect().top)));

		expect(buttons).toHaveLength(2);
		expect(tops.size).toBe(1);
	});

	test("centres the hero's text link on its buy button", async () => {
		await page.viewport(1280, 900);
		let container = await mountLanding();
		let [button, link] = [
			...container.querySelectorAll("#top a[href='#pricing'], #top a[href='#sample']"),
		];
		let middle = (element?: Element) => {
			let rect = element?.getBoundingClientRect();
			return rect ? Math.round(rect.top + rect.height / 2) : Number.NaN;
		};

		expect(Math.abs(middle(button) - middle(link))).toBeLessThanOrEqual(2);
	});

	test("shows the author's portrait in its own colours", async () => {
		let container = await mountLanding();
		let portrait = container.querySelector("#author img");

		expect(portrait).toBeTruthy();
		expect(getComputedStyle(portrait ?? document.body).filter).toBe("none");
	});
});
