/**
 * Lays every docs demo out in a real browser at the six widths a reader brings, from a 320px
 * phone to a 1440px desktop: no page scrolls sideways, the sidebar docks from 48rem, the
 * "On this page" rail joins from 75rem, and its marker follows the reader to the last section.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import type { DemoDocsSite } from "~/resources/views/demo-docs";

import { demoDocsHref } from "~/resources/views/demo-docs";
import { Aside } from "~/resources/views/demo-docs/blocks";
import { DemoDocsHome } from "~/resources/views/demo-docs/pages";
import { DemoDocsArticle, DemoDocsShell } from "~/resources/views/demo-docs/shell";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

/** Every docs demo, keyed by its folder, loaded up front since a browser test can't await a route. */
const SITES = Object.entries(
	import.meta.glob<DemoDocsSite>("./*/index.tsx", { eager: true, import: "default" }),
).map(([key, site]) => ({ slug: key.slice(2, -"/index.tsx".length), site }));

/** The widths a reader brings, phone to desktop. */
const WIDTHS = [320, 375, 768, 1024, 1280, 1440];

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	await page.viewport(414, 896);
});

/** Renders one page of a site the way its controller composes it. */
function mountPage(slug: string, site: DemoDocsSite, path: string) {
	let entry = site.pages[path]!;
	return render(
		<DemoDocsShell site={site} slug={slug} activePath={demoDocsHref(slug)(path)} toc={entry.toc}>
			<DemoDocsArticle site={site} slug={slug} path={path} page={entry}>
				{entry.render({ tab: () => undefined })}
			</DemoDocsArticle>
		</DemoDocsShell>,
	);
}

/** Whether the document is wider than the viewport, which a reader feels as sideways scroll. */
function scrollsSideways(): boolean {
	return document.documentElement.scrollWidth > window.innerWidth;
}

/** Whether the element named by `slot` takes up room on screen. */
function isShown(slot: string): boolean {
	let element = mounted?.container.querySelector<HTMLElement>(`[data-slot="${slot}"]`);
	return element !== null && element !== undefined && element.getClientRects().length > 0;
}

describe("docs demo layout", () => {
	test("finds every demo folder", () => {
		expect(SITES.length).toBeGreaterThan(0);
	});

	test("an aside keeps inline code on the line of the words around it", async () => {
		await page.viewport(1280, 900);
		mounted = render(
			<Aside kind="tip">
				Add <code>--open</code> to open the URL.
			</Aside>,
		);
		let code = mounted.container.querySelector("code")!;
		let paragraph = code.closest("p")!;

		expect(code.getBoundingClientRect().left).toBeGreaterThan(
			paragraph.getBoundingClientRect().left,
		);
		expect(paragraph.getClientRects().length).toBe(1);
	});

	describe.each(SITES)("$slug", ({ site, slug }) => {
		test.each(WIDTHS)("the hub fits a %ipx window", async (width) => {
			await page.viewport(width, 900);
			mounted = render(
				<DemoDocsShell site={site} slug={slug} activePath={demoDocsHref(slug)()}>
					<DemoDocsHome site={site} slug={slug} />
				</DemoDocsShell>,
			);

			expect(scrollsSideways()).toBe(false);
		});

		test.each(WIDTHS)("every page fits a %ipx window", async (width) => {
			await page.viewport(width, 900);
			let wide: string[] = [];
			for (let path of Object.keys(site.pages)) {
				mounted = mountPage(slug, site, path);
				if (scrollsSideways()) wide.push(path);
				mounted.cleanup();
				mounted = undefined;
			}

			expect(wide).toEqual([]);
		});

		test("the rail marks the last section once the reader reaches the bottom", async () => {
			let [path] = Object.entries(site.pages).find(([, entry]) => entry.toc.length >= 3)!;
			await page.viewport(1280, 700);
			mounted = mountPage(slug, site, path);
			let rail = mounted.container.querySelector('[data-slot="docs-rail"]')!;

			window.scrollTo(0, document.documentElement.scrollHeight);
			await expect
				.poll(() => [...rail.querySelectorAll("a")].at(-1)?.hasAttribute("data-active"))
				.toBe(true);

			window.scrollTo(0, 0);
			await expect
				.poll(() => [...rail.querySelectorAll("a")].at(0)?.getAttribute("data-active"))
				.toBe("lead");
		});

		test("docks the sidebar from 48rem and adds the rail from 75rem", async () => {
			let path = Object.keys(site.pages)[0]!;

			await page.viewport(375, 812);
			mounted = mountPage(slug, site, path);
			expect(isShown("docs-sidebar")).toBe(false);
			expect(isShown("docs-bar")).toBe(true);
			mounted.cleanup();

			await page.viewport(1024, 900);
			mounted = mountPage(slug, site, path);
			expect(isShown("docs-sidebar")).toBe(true);
			expect(isShown("docs-rail")).toBe(false);
			mounted.cleanup();

			await page.viewport(1280, 900);
			mounted = mountPage(slug, site, path);
			expect(isShown("docs-sidebar")).toBe(true);
			expect(isShown("docs-rail")).toBe(true);
		});
	});
});
