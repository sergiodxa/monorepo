/**
 * Lays the solution page out in a real browser at a phone and a desktop width: the
 * capabilities read as an un-carded list with full rows, the display figures fit their
 * cells, and nothing on the page reaches past the viewport.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { createTranslator } from "@sdxc/i18n";
import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import ProductMockup, {
	AUDIENCE_MOCKUPS,
	USE_CASE_MOCKUPS,
} from "~/resources/components/marketing/product-mockups";
import { audiences, useCases } from "~/resources/content/marketing";
import en from "~/resources/locales/en";
import SolutionPageView, { buildSolutionPageChrome } from "~/resources/views/marketing/solution";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";

/** A page of six capabilities, one of four, and one whose spotlight is a full mockup. */
const PAGES = [
	["agencies", audiences.agencies!, AUDIENCE_MOCKUPS.agencies!],
	["cron-jobs", useCases["cron-jobs"]!, USE_CASE_MOCKUPS["cron-jobs"]!],
	["devops", audiences.devops!, AUDIENCE_MOCKUPS.devops!],
] as const;

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

/** Mounts one solution page in English, with the animations settled at their end state. */
function mountPage(index: number) {
	let [, content, area] = PAGES[index]!;
	let { t } = translate("en");
	mounted = render(
		<main>
			<style>{"*{animation:none!important;transition:none!important}"}</style>
			<SolutionPageView
				content={content}
				isSignedIn={false}
				chrome={buildSolutionPageChrome(t)}
				media={<ProductMockup area={area} t={t} />}
			/>
		</main>,
	);
	return mounted;
}

/** The top edge of each capability cell, grouped into rows. */
function rowSizes(grid: Element): number[] {
	let rows = new Map<number, number>();
	for (let cell of grid.querySelectorAll(':scope > [data-slot="feature"]')) {
		let top = Math.round(cell.getBoundingClientRect().top);
		rows.set(top, (rows.get(top) ?? 0) + 1);
	}
	return [...rows.values()];
}

describe("SolutionPageView", () => {
	test.each([320, 1280])("keeps every band inside a %ipx viewport", async (width) => {
		await page.viewport(width, 900);
		for (let index of PAGES.keys()) {
			let { container } = mountPage(index);
			let limit = document.documentElement.clientWidth + 1;
			let wide = [...container.querySelectorAll("main *")].filter((element) => {
				let box = element.getBoundingClientRect();
				return box.width > 0 && box.right > limit;
			});

			expect(wide.map((element) => element.outerHTML.slice(0, 80))).toEqual([]);
			mounted?.cleanup();
			mounted = undefined;
		}
	});

	test("lists the capabilities without cards, every row full at desktop width", async () => {
		await page.viewport(1280, 900);
		for (let index of PAGES.keys()) {
			let { $ } = mountPage(index);
			let grid = $('#capabilities [data-slot="feature-grid"]')!;
			let sizes = rowSizes($('#capabilities [data-slot="feature"]')!.parentElement!);

			expect(grid.getAttribute("data-variant")).toBe("list");
			expect(new Set(sizes).size).toBe(1);
			expect(sizes[0]).toBeGreaterThan(1);
			mounted?.cleanup();
			mounted = undefined;
		}
	});

	test("sets the figures at display size, each value inside its cell", async () => {
		await page.viewport(320, 900);
		let { $, container } = mountPage(0);
		let strip = $('[data-slot="stat-strip"]')!;

		expect(strip.getAttribute("data-size")).toBe("display");
		for (let item of container.querySelectorAll('[data-slot="stat-strip-item"]')) {
			expect(item.scrollWidth).toBeLessThanOrEqual(item.clientWidth + 1);
		}
	});
});
