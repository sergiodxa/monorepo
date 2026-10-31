/**
 * Lays {@link SiteHeader} out in a real browser: the phone bar keeps the brand, the primary
 * action and a menu button that opens a full-screen sheet of 44px rows; the desktop bar
 * shows the links and opens a mega panel right under itself, all through native commands.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { cdp, page } from "vitest/browser";

import { SiteHeader } from "./site-header.js";

/** A product group with three columns, the shape a mega panel is built for. */
const PRODUCT: SiteHeader.Group = {
	label: "Product",
	columns: [
		{
			title: "Monitor",
			links: [
				{ label: "Uptime", href: "/uptime", description: "Probes from 12 regions" },
				{ label: "Cron jobs", href: "/cron", description: "Heartbeats for schedules" },
			],
		},
		{
			title: "Respond",
			links: [
				{ label: "On-call", href: "/on-call" },
				{ label: "Incidents", href: "/incidents" },
			],
		},
		{ title: "Share", links: [{ label: "Status pages", href: "/status" }] },
	],
	footer: { label: "Browse all features", href: "/features" },
};

/** Mounts a header in a host `width` pixels wide and returns the host. */
function mount(width: number, variant: SiteHeader.Variant = "bar"): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	render(
		<SiteHeader
			variant={variant}
			brand={
				<a href="/" aria-label="Keel home">
					Keel
				</a>
			}
			items={[PRODUCT, { label: "Pricing", href: "/pricing" }, { label: "Docs", href: "/docs" }]}
			actions={[{ label: "Log in", href: "/login" }]}
			cta={{ label: "Start free", href: "/signup" }}
		/>,
		{ container: host },
	);
	return host;
}

/** Resolves after the next frame, once a command's state change has styled, with every entry transition finished. */
async function frame(): Promise<void> {
	await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
	for (let animation of document.getAnimations()) {
		if (animation instanceof CSSTransition) animation.finish();
	}
}

/** The element matching `selector` inside `root`, failing the test when it is missing. */
function find<T extends Element = HTMLElement>(root: Element, selector: string): T {
	let element = root.querySelector<T>(selector);
	if (!element) throw new Error(`missing ${selector}`);
	return element;
}

afterEach(async () => {
	document.body.replaceChildren();
	await cdp().send("Emulation.setEmulatedMedia", { features: [] });
});

describe("SiteHeader on a phone", () => {
	test("keeps the brand, the primary action and a menu button within 375px", async () => {
		await page.viewport(375, 800);
		let host = mount(375);
		let header = find(host, '[data-slot="site-header"]');

		expect(getComputedStyle(find(host, '[data-slot="site-header-nav"]')).display).toBe("none");
		expect(header.scrollWidth).toBeLessThanOrEqual(header.clientWidth);
		expect(find(host, '[data-slot="site-header-end"]').textContent).toContain("Start free");

		let menu = find(host, '[data-slot="site-header-menu-button"]');
		expect(getComputedStyle(menu).display).not.toBe("none");
		expect(menu.getBoundingClientRect().height).toBeGreaterThanOrEqual(40);
	});

	test("rounds the menu button like the page's buttons", async () => {
		await page.viewport(375, 800);
		let host = mount(375);
		host.style.setProperty("--ui-button-radius", "9999px");
		let menu = find(host, '[data-slot="site-header-menu-button"]');

		expect(getComputedStyle(menu).borderTopLeftRadius).toBe("9999px");
	});

	test("opens a full-screen sheet of 44px rows with the actions full width, and closes it", async () => {
		await page.viewport(375, 800);
		let host = mount(375);
		let sheet = find<HTMLDialogElement>(host, '[data-slot="site-header-sheet"]');

		find(host, '[data-slot="site-header-menu-button"]').click();
		await frame();

		expect(sheet.open).toBe(true);
		let box = sheet.getBoundingClientRect();
		expect(box.width).toBe(window.innerWidth);
		expect(box.height).toBe(window.innerHeight);

		for (let row of sheet.querySelectorAll<HTMLElement>("nav > ul > li > a, summary")) {
			expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
		}

		find(sheet, "summary").click();
		await frame();
		for (let link of sheet.querySelectorAll<HTMLElement>("details a")) {
			expect(link.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
		}

		let actions = find(sheet, '[data-slot="site-header-sheet-actions"]');
		let actionsBox = actions.getBoundingClientRect();
		for (let action of actions.querySelectorAll<HTMLElement>("a")) {
			expect(action.getBoundingClientRect().width).toBeGreaterThan(actionsBox.width - 64);
			expect(action.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
		}
		expect(actions.textContent).toContain("Start free");

		find(sheet, 'button[command="close"]').click();
		await frame();
		expect(sheet.open).toBe(false);
	});

	test("animates the sheet in, and drops the animation when motion is reduced", async () => {
		await page.viewport(375, 800);
		let host = mount(375);
		let sheet = find<HTMLDialogElement>(host, '[data-slot="site-header-sheet"]');

		sheet.showModal();
		expect(getComputedStyle(sheet).animationName).toBe("ui-site-header-sheet-enter");
		sheet.close();

		await cdp().send("Emulation.setEmulatedMedia", {
			features: [{ name: "prefers-reduced-motion", value: "reduce" }],
		});
		sheet.showModal();
		expect(getComputedStyle(sheet).animationName).toBe("none");
	});
});

describe("SiteHeader on a desktop", () => {
	test("shows the links, hides the menu button, and centers the navigation", async () => {
		await page.viewport(1280, 800);
		let host = mount(1280);
		let nav = find(host, '[data-slot="site-header-nav"]');

		expect(getComputedStyle(nav).display).toBe("flex");
		expect(getComputedStyle(find(host, '[data-slot="site-header-menu-button"]')).display).toBe(
			"none",
		);
		let box = nav.getBoundingClientRect();
		expect(Math.abs(box.left + box.width / 2 - 640)).toBeLessThan(2);
		for (let link of nav.querySelectorAll<HTMLElement>("a")) {
			expect(getComputedStyle(link).textDecorationLine).toBe("none");
		}
	});

	test("opens a mega panel flush under the bar, one track per column", async () => {
		await page.viewport(1280, 800);
		let host = mount(1280);
		let bar = find(host, '[data-slot="site-header-bar"]');
		let trigger = find(host, '[data-slot="site-header-group-trigger"]');
		let panel = find(host, '[data-slot="site-header-panel"]');

		trigger.click();
		await frame();

		expect(panel.matches(":popover-open")).toBe(true);
		expect(getComputedStyle(find(trigger, "svg")).rotate).toBe("180deg");
		let barBox = bar.getBoundingClientRect();
		let panelBox = panel.getBoundingClientRect();
		expect(Math.abs(panelBox.top - barBox.bottom)).toBeLessThan(1);
		expect(panelBox.width).toBe(barBox.width);
		let tracks = getComputedStyle(find(panel, "div")).gridTemplateColumns.split(" ");
		expect(tracks).toHaveLength(3);

		trigger.click();
		await frame();
		expect(panel.matches(":popover-open")).toBe(false);
	});

	test("matches a floating panel to the floating bar's width", async () => {
		await page.viewport(1440, 800);
		let host = mount(1440, "floating");
		let bar = find(host, '[data-slot="site-header-bar"]');
		let panel = find(host, '[data-slot="site-header-panel"]');

		find(host, '[data-slot="site-header-group-trigger"]').click();
		await frame();

		let barBox = bar.getBoundingClientRect();
		let panelBox = panel.getBoundingClientRect();
		expect(barBox.width).toBeLessThan(1440);
		expect(Math.abs(panelBox.left - barBox.left)).toBeLessThan(1);
		expect(Math.abs(panelBox.width - barBox.width)).toBeLessThan(1);
		expect(panelBox.top).toBeGreaterThan(barBox.bottom);
	});
});

describe("SiteHeader prefetch", () => {
	test("leaves every link unprefetched by default", () => {
		let host = mount(1440);

		expect(host.querySelectorAll("a[data-rmx-prefetch]")).toHaveLength(0);
	});

	test("prefetches every link and action on intent, in the bar, the panels and the sheet", () => {
		let host = document.createElement("div");
		document.body.appendChild(host);
		render(
			<SiteHeader
				prefetch="intent"
				brand={<a href="/">Keel</a>}
				items={[PRODUCT, { label: "Pricing", href: "/pricing" }]}
				actions={[{ label: "Log in", href: "/login" }]}
				cta={{ label: "Start free", href: "/signup" }}
			/>,
			{ container: host },
		);

		let links = [...host.querySelectorAll<HTMLAnchorElement>('a:not([href="/"])')];
		let hrefs = new Set(links.map((link) => link.getAttribute("href")));
		expect(hrefs).toEqual(
			new Set([
				"/uptime",
				"/cron",
				"/on-call",
				"/incidents",
				"/status",
				"/features",
				"/pricing",
				"/login",
				"/signup",
			]),
		);
		for (let link of links) expect(link.dataset.rmxPrefetch, link.href).toBe("intent");
	});
});
