/**
 * Tests for {@link PageHeader} in a real browser: actions on the title's row with the primary
 * one last, the description kept under the title at any width, the trail or parent link
 * by width, tabs marking the current view, the sticky variant compacting, and wrapping at 320px.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { cdp, page } from "vitest/browser";

import { PageHeader } from "./page-header.js";

let mounted: RenderResult | undefined;

afterEach(async () => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.innerHTML = "";
	await cdp().send("Emulation.setEmulatedMedia", { features: [] });
	await page.viewport(1280, 800);
});

/** The trail to one monitor. */
const CRUMBS: PageHeader.Crumb[] = [
	{ label: "Monitors", href: "#monitors" },
	{ label: "api.acme.dev" },
];

/** Three views of one monitor. */
const TABS: PageHeader.Tab[] = [
	{ href: "#overview", label: "Overview", current: true },
	{ href: "#incidents", label: "Incidents", count: 3 },
	{ href: "#settings", label: "Settings" },
];

/** Mounts a monitor's header inside a box `width` wide. */
function mountHeader(width: string, props: Partial<PageHeader.Props> = {}) {
	mounted = render(
		<div style={`inline-size: ${width}`}>
			<PageHeader
				crumbs={CRUMBS}
				crumbsLabel="Breadcrumb"
				title="api.acme.dev"
				description="HTTPS check every 30 seconds from 6 regions."
				status={<span>Up</span>}
				overflow={<button type="button">More</button>}
				actions={<button type="button">Pause</button>}
				primaryAction={<button type="button">Edit monitor</button>}
				tabs={TABS}
				tabsLabel="Monitor views"
				{...props}
			/>
		</div>,
	);
}

/** Whether the element matching `selector` renders a box. */
function shown(selector: string): boolean {
	return document.querySelector(selector)?.checkVisibility({ visibilityProperty: true }) ?? false;
}

/** Holds the test until the browser has painted twice, after a scroll or style change. */
async function frames() {
	await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

describe("PageHeader", () => {
	test("fills a flex row it sits in, though it measures its own width", () => {
		mounted = render(
			<div style="display: flex; inline-size: 40rem">
				<PageHeader title="api.acme.dev" />
			</div>,
		);
		let header = document.querySelector<HTMLElement>('[data-slot="page-header"]')!;

		expect(header.getBoundingClientRect().width).toBeCloseTo(640, 0);
	});

	test("draws the overflow, then secondary actions, then the primary action last", () => {
		mountHeader("60rem");
		let buttons = [...document.querySelectorAll('[data-slot="page-header-actions"] button')];
		expect(buttons.map((button) => button.textContent)).toEqual(["More", "Pause", "Edit monitor"]);
		let [more, pause, edit] = buttons.map((button) => button.getBoundingClientRect());
		expect(more!.right).toBeLessThanOrEqual(pause!.left);
		expect(pause!.right).toBeLessThanOrEqual(edit!.left);
		let header = document.querySelector('[data-slot="page-header"]')!.getBoundingClientRect();
		expect(Math.round(header.right - edit!.right)).toBe(0);
	});

	test("keeps the actions at the end of the title's row, the description under both", async () => {
		await page.viewport(1280, 800);
		mountHeader("100%", { tabs: [] });
		let header = document.querySelector('[data-slot="page-header"]')!.getBoundingClientRect();
		let title = document.querySelector("h1")!.getBoundingClientRect();
		let actions = document
			.querySelector('[data-slot="page-header-actions"]')!
			.getBoundingClientRect();
		let description = document
			.querySelector('[data-slot="page-header-description"]')!
			.getBoundingClientRect();
		expect(
			Math.abs(actions.top + actions.height / 2 - (title.top + title.height / 2)),
		).toBeLessThan(4);
		expect(Math.round(header.right - actions.right)).toBe(0);
		expect(description.top).toBeGreaterThanOrEqual(Math.max(title.bottom, actions.bottom) - 1);
	});

	for (let width of [320, 360, 480]) {
		test(`never sets the primary action between the title and the description at ${width}px`, () => {
			mountHeader(`${width}px`, {
				title: "Articles",
				description: "Everything published on the blog, newest first.",
				actions: undefined,
				overflow: undefined,
				primaryAction: (
					<button type="button" style="padding: 0.5rem 1rem">
						New article
					</button>
				),
				tabs: [],
			});
			let title = document.querySelector("h1")!.getBoundingClientRect();
			let description = document
				.querySelector('[data-slot="page-header-description"]')!
				.getBoundingClientRect();
			let action = document
				.querySelector('[data-slot="page-header-primary"] button')!
				.getBoundingClientRect();
			let besideTitle = action.top < title.bottom && action.bottom > title.top;
			let afterDescription = action.top >= description.bottom;
			expect(besideTitle || afterDescription).toBe(true);
			expect(description.top).toBeLessThan(title.bottom + 16);
		});
	}

	test("shows the trail on a wide pane and the parent link only on a narrow one", () => {
		mountHeader("60rem");
		expect(shown('[data-slot="page-header-crumbs"]')).toBe(true);
		expect(shown('[data-slot="page-header-parent"]')).toBe(false);
		mounted?.cleanup();

		mountHeader("30rem");
		expect(shown('[data-slot="page-header-crumbs"]')).toBe(false);
		let parent = document.querySelector<HTMLAnchorElement>('[data-slot="page-header-parent"]')!;
		expect(parent.checkVisibility()).toBe(true);
		expect(parent.getAttribute("href")).toBe("#monitors");
		expect(parent.textContent).toBe("Monitors");
	});

	test("takes an explicit parent link", () => {
		mountHeader("20rem", { crumbs: [], parent: { href: "#all", label: "All monitors" } });
		let parent = document.querySelector<HTMLAnchorElement>('[data-slot="page-header-parent"]')!;
		expect(parent.getAttribute("href")).toBe("#all");
		expect(parent.checkVisibility()).toBe(true);
	});

	test("marks the current tab and counts the others", async () => {
		mountHeader("60rem");
		await expect
			.element(page.getByRole("navigation", { name: "Monitor views" }))
			.toBeInTheDocument();
		let links = [
			...document.querySelectorAll<HTMLAnchorElement>('[data-slot="page-header-tabs"] a'),
		];
		expect(links.map((link) => link.getAttribute("aria-current"))).toEqual(["page", null, null]);
		expect(links[1]!.querySelector('[data-slot="page-header-tab-count"]')!.textContent).toBe("3");
		expect(getComputedStyle(links[0]!, "::after").blockSize).toBe("2px");
		expect(document.querySelector("h1")!.textContent).toBe("api.acme.dev");
	});

	test("wraps at 320px without scrolling sideways", async () => {
		await page.viewport(320, 640);
		mountHeader("100%", {
			title: "checkout-service-production-eu-west-1.internal.acme.dev",
			tabs: [...TABS, { href: "#alerts", label: "Alert rules", count: 12 }],
		});
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320);
		let header = document.querySelector('[data-slot="page-header"]')!.getBoundingClientRect();
		let title = document.querySelector("h1")!.getBoundingClientRect();
		let actions = document
			.querySelector('[data-slot="page-header-actions"]')!
			.getBoundingClientRect();
		expect(title.right).toBeLessThanOrEqual(header.right);
		expect(actions.top).toBeGreaterThanOrEqual(title.bottom);
		let tabs = document.querySelector<HTMLElement>('[data-slot="page-header-tabs"]')!;
		expect(tabs.getBoundingClientRect().right).toBeLessThanOrEqual(320);
	});

	test("the sticky variant sticks under the top bar and compacts once stuck", async () => {
		await page.viewport(800, 600);
		mounted = render(
			<div
				id="scroller"
				style="block-size: 600px; overflow-y: auto; --ui-app-sticky-top: 56px; --ui-app-gutter: 24px; padding: 0 24px"
			>
				<div style="block-size: 56px">Top bar</div>
				<PageHeader
					sticky
					crumbs={CRUMBS}
					crumbsLabel="Breadcrumb"
					title="api.acme.dev"
					description="HTTPS check every 30 seconds."
					primaryAction={<button type="button">Edit monitor</button>}
				/>
				<div style="block-size: 2000px">Body</div>
			</div>,
		);
		let scroller = document.getElementById("scroller")!;
		let header = document.querySelector<HTMLElement>('[data-slot="page-header"]')!;
		let title = document.querySelector("h1")!;
		let fullHeight = header.getBoundingClientRect().height;
		expect(getComputedStyle(title).fontSize).toBe("24px");
		expect(Math.round(header.getBoundingClientRect().width)).toBe(800);

		scroller.scrollTop = 400;
		await frames();
		expect(Math.round(header.getBoundingClientRect().top)).toBe(56);
		await new Promise((resolve) => setTimeout(resolve, 300));
		expect(getComputedStyle(title).fontSize).toBe("16px");
		expect(header.getBoundingClientRect().height).toBeLessThan(fullHeight);
		expect(shown('[data-slot="page-header-description"]')).toBe(false);

		scroller.scrollTop = 0;
		await frames();
		await new Promise((resolve) => setTimeout(resolve, 300));
		expect(getComputedStyle(title).fontSize).toBe("24px");
	});

	test("under reduced motion the sticky header sticks at full size", async () => {
		await cdp().send("Emulation.setEmulatedMedia", {
			features: [{ name: "prefers-reduced-motion", value: "reduce" }],
		});
		mounted = render(
			<div id="scroller" style="block-size: 600px; overflow-y: auto">
				<PageHeader sticky title="api.acme.dev" description="HTTPS check every 30 seconds." />
				<div style="block-size: 2000px">Body</div>
			</div>,
		);
		document.getElementById("scroller")!.scrollTop = 400;
		await frames();
		let header = document.querySelector<HTMLElement>('[data-slot="page-header"]')!;
		expect(Math.round(header.getBoundingClientRect().top)).toBe(0);
		expect(getComputedStyle(document.querySelector("h1")!).fontSize).toBe("24px");
		expect(shown('[data-slot="page-header-description"]')).toBe(true);
	});
});
