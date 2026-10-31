/**
 * Tests for {@link DocsLayout} in a real browser at the widths a reader brings: the drawer and
 * the sticky bar on a phone, the docked sidebar from the dock width, the heading rail from
 * 75rem, no sideways scroll at 320px, and jumped-to headings clearing the sticky chrome.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import { DocsLayout } from "./docs-layout.js";

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.innerHTML = "";
	await page.viewport(1280, 800);
});

/** Four headings, enough to earn the rail and the bar's list. */
const TOC = ["Install", "Configure", "Deploy", "Troubleshoot"].map((text) => ({
	id: text.toLowerCase(),
	text,
	level: 2,
}));

/** Mounts the shell with a long article and a plain sidebar under a 64px sticky header. */
function mountLayout(props: Partial<DocsLayout.Props> = {}) {
	mounted = render(
		<DocsLayout
			header={<div style="block-size: 64px">Site header</div>}
			stickyTop="4rem"
			sidebar={
				<nav aria-label="Documentation">
					<a href="/docs/install">Install</a>
				</nav>
			}
			toc={TOC}
			tocLabel="On this page"
			menuLabel="Menu"
			drawerLabel="Documentation"
			closeLabel="Close menu"
			{...props}
		>
			{props.children ?? (
				<>
					<h1>Install the CLI</h1>
					{TOC.map((item) => (
						<section key={item.id}>
							<h2 id={item.id}>{item.text}</h2>
							<p style="block-size: 700px">Body</p>
						</section>
					))}
					<pre>
						npx some-really-long-command --with-a-flag-that-goes-on-and-on-and-on-past-the-edge
					</pre>
				</>
			)}
		</DocsLayout>,
	);
}

/** Whether `selector`'s element renders a box. */
function shown(selector: string): boolean {
	return document.querySelector(selector)?.checkVisibility() ?? false;
}

describe("DocsLayout", () => {
	test("on a phone: bar with the menu button and headings, no docked columns", async () => {
		await page.viewport(375, 800);
		mountLayout();
		expect(shown('[data-slot="docs-sidebar"]')).toBe(false);
		expect(shown('[data-slot="docs-rail"]')).toBe(false);
		expect(shown('[data-slot="docs-bar"]')).toBe(true);
		expect(shown('[data-slot="docs-bar"] [data-toc="bar"]')).toBe(true);
		expect(document.querySelector('[data-slot="docs-bar"] button')!.textContent).toContain("Menu");
	});

	test("the drawer opens from the bar and has a visible close button", async () => {
		await page.viewport(375, 800);
		mountLayout();
		let drawer = document.querySelector<HTMLDialogElement>("dialog#docs-drawer")!;
		document.querySelector<HTMLButtonElement>('[data-slot="docs-bar"] button')!.click();
		expect(drawer.open).toBe(true);
		let close = drawer.querySelector<HTMLButtonElement>('button[aria-label="Close menu"]')!;
		expect(close.checkVisibility()).toBe(true);
		close.click();
		expect(drawer.open).toBe(false);
	});

	test("docks the sidebar from the dock width and keeps the bar for the headings", async () => {
		await page.viewport(1100, 800);
		mountLayout();
		expect(shown('[data-slot="docs-sidebar"]')).toBe(true);
		expect(shown('[data-slot="docs-bar"]')).toBe(true);
		expect(document.querySelector('[data-slot="docs-bar"] button')!.checkVisibility()).toBe(false);
		expect(shown('[data-slot="docs-rail"]')).toBe(false);
	});

	test("draws the rail from 75rem and hides the bar", async () => {
		await page.viewport(1280, 800);
		mountLayout();
		expect(shown('[data-slot="docs-rail"]')).toBe(true);
		expect(shown('[data-slot="docs-bar"]')).toBe(false);
	});

	test("hides the bar when docked on a page with too few headings", async () => {
		await page.viewport(1100, 800);
		mountLayout({ toc: TOC.slice(0, 1) });
		expect(shown('[data-slot="docs-bar"]')).toBe(false);
		expect(document.querySelector('[data-slot="docs-rail"]')).toBeNull();
	});

	test("docks from 48rem when dock is md", async () => {
		await page.viewport(800, 800);
		mountLayout({ dock: "md" });
		expect(shown('[data-slot="docs-sidebar"]')).toBe(true);
	});

	test("fills its parent's width inside a centred flex parent", async () => {
		await page.viewport(1920, 900);
		mountLayout();

		let layout = document.querySelector<HTMLElement>('[data-slot="docs-layout"]')!;
		let parent = layout.parentElement!;
		parent.style.cssText = "display: flex; flex-direction: column; align-items: center";

		expect(Math.round(layout.getBoundingClientRect().width)).toBe(parent.clientWidth);
	});

	test("caps running text at the prose measure while code fills the column", async () => {
		await page.viewport(1440, 900);
		mountLayout({
			children: (
				<>
					<p id="prose">{"A long paragraph of documentation prose. ".repeat(20)}</p>
					<pre id="code">{"let wide = true;"}</pre>
				</>
			),
		});

		let article = document.querySelector<HTMLElement>('[data-slot="docs-article"]')!;
		let prose = document.getElementById("prose")!;
		let code = document.getElementById("code")!;
		let probe = document.createElement("span");
		probe.textContent = "0".repeat(66);
		probe.style.font = getComputedStyle(prose).font;
		probe.style.position = "absolute";
		document.body.appendChild(probe);
		let sixtySixCh = probe.getBoundingClientRect().width;
		probe.remove();

		expect(prose.getBoundingClientRect().width).toBeCloseTo(sixtySixCh, 0);
		expect(code.getBoundingClientRect().width).toBeCloseTo(article.clientWidth, 0);
		expect(code.getBoundingClientRect().width).toBeGreaterThan(sixtySixCh + 50);
	});

	test("never scrolls sideways at 320px", async () => {
		await page.viewport(320, 640);
		mountLayout();
		let root = document.documentElement;
		expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
	});

	test("a jumped-to heading lands below the header and the bar", async () => {
		await page.viewport(375, 800);
		mountLayout();
		document.getElementById("deploy")!.scrollIntoView();
		let top = document.getElementById("deploy")!.getBoundingClientRect().top;
		let bar = document.querySelector('[data-slot="docs-bar"]')!.getBoundingClientRect();
		expect(top).toBeGreaterThanOrEqual(bar.bottom);
	});

	test("the article is the main landmark unless the app draws its own", () => {
		mountLayout();
		expect(document.querySelector('main[data-slot="docs-article"]')).not.toBeNull();
		mounted?.cleanup();
		mountLayout({ main: false });
		expect(document.querySelector("main")).toBeNull();
	});
});
