/**
 * Holds the settings area to a way through on a phone: where `SettingsLayout` hides its side
 * nav, the folded phone nav takes its place on every page of the area, a section it links to
 * lands clear of the sticky top bar, and a token stays inside the phone's width.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { SettingsLayout } from "@sdxc/ui/app/settings-layout";
import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import {
	anchoredSections,
	SettingsCode,
	SettingsPhoneNav,
} from "~/resources/components/settings-area";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";

let mounted: RenderResult | undefined;
let host: HTMLElement | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	host?.remove();
	host = undefined;
});

/** The area's groups as a section page draws them, with Filters the page being shown. */
const SECTIONS: ReadonlyArray<SettingsLayout.Group> = [
	{
		label: "Account",
		items: [
			{ href: "/settings#plan", label: "Plan" },
			{ href: "/settings#appearance", label: "Appearance" },
		],
	},
	{
		label: "Reading",
		items: [
			{ href: "/rules", label: "Filters", current: true },
			{ href: "/settings#agents", label: "Agents" },
		],
	},
];

/** A minted token's length, which no phone fits on one line. */
const TOKEN = `rdr_${"eyJzIjoiZGV2LXNlZWQtcmVhZGVyIiwidCI6InRva2Vu".repeat(4)}.GtCwPyrr662OFhIfc6pys3KWHhTh44dDfRNCjhu53Zk`;

/** Mounts a section page of the area in a host `width` pixels wide, as a controller draws it. */
function mount(width: number): HTMLElement {
	host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);

	mounted = render(
		<SettingsLayout
			sections={SECTIONS}
			page="section"
			labels={{ nav: "Settings", back: "Settings" }}
		>
			<SettingsPhoneNav sections={SECTIONS} label="Settings" jump="Jump to a section" />
			<SettingsCode>{TOKEN}</SettingsCode>
		</SettingsLayout>,
		{ container: host },
	);

	return host;
}

/** The element `slot` names inside `root`, which every assertion here expects to exist. */
function slot(root: HTMLElement, name: string): HTMLElement {
	let found = root.querySelector<HTMLElement>(`[data-slot="${name}"]`);
	if (!found) throw new Error(`No [data-slot="${name}"] rendered`);
	return found;
}

describe("SettingsPhoneNav", () => {
	test("stands in for the side nav where a phone hides it", () => {
		let root = mount(375);

		expect(getComputedStyle(slot(root, "settings-nav")).display).toBe("none");
		expect(getComputedStyle(slot(root, "settings-phone-nav")).display).toBe("block");
	});

	test("stays out of the way where the side nav shows", () => {
		let root = mount(1024);

		expect(getComputedStyle(slot(root, "settings-nav")).display).not.toBe("none");
		expect(getComputedStyle(slot(root, "settings-phone-nav")).display).toBe("none");
	});

	test("names the section being shown and links every section, marking that one", () => {
		let nav = slot(mount(375), "settings-phone-nav");
		let links = Array.from(nav.querySelectorAll("a"));

		expect(nav.querySelector("summary")?.textContent).toContain("Filters");
		expect(links.map((link) => link.getAttribute("href"))).toEqual([
			"/settings#plan",
			"/settings#appearance",
			"/rules",
			"/settings#agents",
		]);
		expect(nav.querySelector('a[aria-current="page"]')?.textContent).toBe("Filters");
	});

	test("gives each link a thumb-sized target once open", () => {
		let nav = slot(mount(375), "settings-phone-nav");
		nav.querySelector("details")?.setAttribute("open", "");

		for (let link of nav.querySelectorAll("a")) {
			expect(link.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
		}
	});
});

describe("SettingsCode", () => {
	test("breaks a long token inside a phone's width", () => {
		let root = mount(375);
		let code = slot(root, "settings-code");

		expect(code.getBoundingClientRect().right).toBeLessThanOrEqual(
			root.getBoundingClientRect().right,
		);
		expect(code.scrollWidth).toBeLessThanOrEqual(code.clientWidth);
	});
});

describe("anchoredSections", () => {
	test("lands a linked section below the sticky top bar", () => {
		host = document.createElement("div");
		host.style.setProperty("--ui-app-sticky-top", "56px");
		document.body.appendChild(host);

		mounted = render(
			<SettingsLayout labels={{ back: "Settings" }} mix={[anchoredSections()]}>
				<section id="agents">Agents</section>
			</SettingsLayout>,
			{ container: host },
		);

		let section = host.querySelector<HTMLElement>("#agents");
		expect(section && getComputedStyle(section).scrollMarginTop).toBe("72px");
	});
});
