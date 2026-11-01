/**
 * Lays the settings frame out in a real browser: the nav marks the current section, sits
 * beside the content when wide, and on a narrow container becomes the index page while a
 * section page shows its content with a back link.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { SettingsLayout } from "./settings-layout.js";

const LABELS: SettingsLayout.Labels = { nav: "Settings", back: "Settings" };

const NAV: ReadonlyArray<SettingsLayout.Group> = [
	{
		label: "Workspace",
		items: [
			{ href: "/settings/general", label: "General" },
			{ href: "/settings/monitors", label: "Monitor defaults", current: true },
			{ href: "/settings/billing", label: "Billing" },
		],
	},
	{ label: "Account", items: [{ href: "/settings/profile", label: "Profile" }] },
];

/** Mounts the layout on `page` in a host `width` pixels wide and returns the host. */
function mount(width: number, page: "index" | "section" = "section"): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	render(
		<SettingsLayout sections={NAV} page={page} backHref="/settings" labels={LABELS}>
			<h1>Monitor defaults</h1>
		</SettingsLayout>,
		{ container: host },
	);
	return host;
}

/** Whether `element` takes up space on the page. */
function shown(element: Element | null): boolean {
	return element !== null && element.getBoundingClientRect().height > 0;
}

/** The nav, the content column and the back link in `host`. */
function parts(host: HTMLElement) {
	return {
		nav: host.querySelector("nav"),
		content: host.querySelector('[data-slot="settings-content"]'),
		back: host.querySelector('[data-slot="settings-back"]'),
	};
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("SettingsLayout", () => {
	test("marks only the current section with aria-current", () => {
		let host = mount(1024);
		let current = host.querySelectorAll('[aria-current="page"]');

		expect(current).toHaveLength(1);
		expect(current[0]?.textContent).toBe("Monitor defaults");
		expect(current[0]?.getAttribute("href")).toBe("/settings/monitors");
		expect(host.querySelector("nav")?.getAttribute("aria-label")).toBe("Settings");
	});

	test("puts the nav beside the content and hides the back link when wide", () => {
		let { nav, content, back } = parts(mount(1024));

		expect(shown(nav)).toBe(true);
		expect(shown(back)).toBe(false);
		expect(content!.getBoundingClientRect().left).toBeGreaterThan(
			nav!.getBoundingClientRect().right,
		);
		expect(content!.getBoundingClientRect().width).toBeLessThanOrEqual(42 * 16 + 1);
	});

	test("shows a section page's content and back link alone when narrow", () => {
		let { nav, content, back } = parts(mount(375));

		expect(shown(nav)).toBe(false);
		expect(shown(content)).toBe(true);
		expect(shown(back)).toBe(true);
		expect(back?.getAttribute("href")).toBe("/settings");
		expect(back?.textContent).toBe("Settings");
	});

	test("shows the index page as the nav alone when narrow, with touch-sized rows", () => {
		let host = mount(375, "index");
		let { nav, content, back } = parts(host);

		expect(shown(nav)).toBe(true);
		expect(shown(content)).toBe(false);
		expect(back).toBeNull();
		let row = host.querySelector('[data-slot="settings-nav-item"]')!;
		expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
	});

	test("keeps 32px nav rows when wide", () => {
		let host = mount(1024);
		let row = host.querySelector('[data-slot="settings-nav-item"]')!;

		expect(row.getBoundingClientRect().height).toBe(32);
	});

	test("never scrolls sideways at 320px", () => {
		let host = mount(320);

		expect(host.scrollWidth).toBeLessThanOrEqual(320);
	});
});
