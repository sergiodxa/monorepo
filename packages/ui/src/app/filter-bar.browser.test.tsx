/**
 * Drives the filter bar in a real browser: a facet picker opened and applied from the
 * keyboard, counts per value, chips whose remove links drop one parameter, "Clear filters"
 * only once something is applied and on Escape, and layouts that wrap without overflowing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import { AutoRefresh } from "./auto-refresh.js";
import { FilterBar } from "./filter-bar.js";
import { rowNavigation } from "./mixins/row-navigation.js";
import { ViewOptions } from "./view-options.js";

import "@sdxc/u/theme.css";
import "../theme.css";

const LABELS: FilterBar.Labels = {
	toolbar: "Filter monitors",
	tabs: "Monitor states",
	filters: "Filters",
	options: "View",
	apply: "Apply",
	is: "is",
	isAnyOf: "is any of",
	clear: "Clear filters",
	remove: (field, values) => `Remove ${field}: ${values}`,
};

const FACETS: FilterBar.Facet[] = [
	{
		name: "status",
		label: "Status",
		options: [
			{ value: "up", label: "Up", count: 1204 },
			{ value: "degraded", label: "Degraded", count: 7 },
			{ value: "down", label: "Down", count: 2 },
		],
	},
	{
		name: "region",
		label: "Region",
		options: [
			{ value: "fra", label: "Frankfurt", count: 410 },
			{ value: "iad", label: "Virginia", count: 512 },
		],
	},
	{ name: "tag", label: "Tags", options: [{ value: "api", label: "api", count: 33 }] },
];

const TABS: FilterBar.Tab[] = [
	{ label: "Active", count: 1213, href: "/monitors?state=active", current: true },
	{ label: "Paused", count: 41, href: "/monitors?state=paused" },
];

const SORT: FilterBar.Sort = {
	label: "Sort by",
	defaultValue: "name",
	options: [
		{ value: "name", label: "Name" },
		{ value: "-checked", label: "Last checked" },
	],
};

const VIEW_LABELS: ViewOptions.Labels = {
	trigger: "Display",
	layout: "Layout",
	grouping: "Grouping",
	ordering: "Ordering",
	density: "Density",
	properties: "Properties",
	apply: "Apply",
	setDefault: "Set as default",
};

const REFRESH: AutoRefresh.Props = {
	id: "monitors-refresh",
	defaultValue: 30,
	options: [
		{ value: 0, label: "Off" },
		{ value: 30, label: "30s" },
		{ value: 60, label: "1m" },
	],
	refreshedAt: new Date("2026-11-01T12:46:00Z"),
	locale: "en-US",
	timeZone: "UTC",
	labels: { trigger: "Auto-refresh", updated: "Updated {time}" },
};

/** Every bar mounted by the running test, unmounted after it so no listener outlives it. */
let mounted: RenderResult[] = [];

/** Mounts a bar for `url` in a host `width` pixels wide and returns the host. */
function mount(url: string, width = 1024, props: Partial<FilterBar.Props> = {}): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	let result = render(
		<FilterBar
			id="monitors"
			url={url}
			tabs={TABS}
			facets={FACETS}
			search={{ label: "Search monitors", placeholder: "Search…" }}
			sort={SORT}
			locale="en-US"
			labels={LABELS}
			{...props}
		/>,
		{ container: host },
	);
	mounted.push(result);
	return host;
}

/**
 * Mounts a bar with every slot filled the way a busy live list fills it: three count tabs, one
 * of them empty, search, two facets, sort, density and auto-refresh in the View menu, and the
 * last-updated time as status.
 */
function mountFull(url: string, width: number): HTMLElement {
	return mount(url, width, {
		tabs: [
			{ label: "All", count: 3, href: "/monitors", current: true },
			{ label: "Failing", count: 3, href: "/monitors?show=failing" },
			{ label: "Paused", count: 0, href: "/monitors?show=paused" },
		],
		facets: FACETS.slice(0, 2),
		options: (
			<>
				<ViewOptions
					id="monitors-view"
					url={url}
					inline
					density={{
						defaultValue: "compact",
						options: [
							{ value: "compact", label: "Compact" },
							{ value: "comfortable", label: "Comfortable" },
						],
					}}
					labels={VIEW_LABELS}
				/>
				<AutoRefresh {...REFRESH} url={url} show="choices" />
			</>
		),
		status: <AutoRefresh {...REFRESH} url={url} show="status" />,
	});
}

/** Whether `element` is drawn, which a closed popover's contents are not. */
function drawn(element: Element | null): boolean {
	return element !== null && element.getBoundingClientRect().width > 0;
}

/** Collects what the bar's form would send, cancelling the navigation. */
function captureSubmits(host: HTMLElement): URLSearchParams[] {
	let sent: URLSearchParams[] = [];
	host.querySelector("form")!.addEventListener("submit", (event) => {
		event.preventDefault();
		let form = event.target as HTMLFormElement;
		let submitter = (event as SubmitEvent).submitter;
		sent.push(new URLSearchParams(new FormData(form, submitter) as unknown as string[][]));
	});
	return sent;
}

beforeEach(async () => {
	await page.viewport(1280, 800);
});

afterEach(() => {
	document.documentElement.removeAttribute("style");
	for (let result of mounted) result.cleanup();
	mounted = [];
	document.body.replaceChildren();
});

describe("FilterBar", () => {
	test("prefetches its tab, sort, chip and clear links only when asked", () => {
		let url = "/monitors?state=active&status=down";
		let links = (host: HTMLElement) => [
			...host.querySelectorAll<HTMLAnchorElement>(
				'[data-slot="filter-bar-tabs"] a, [data-slot="filter-bar-sort"] a, [data-slot="remove"], [data-slot="filter-bar-clear"]',
			),
		];

		let plain = mount(url);
		expect(links(plain).length).toBeGreaterThan(3);
		expect(links(plain).every((link) => !link.hasAttribute("data-rmx-prefetch"))).toBe(true);
		plain.remove();

		let eager = mount(url, 1024, { prefetch: "intent" });
		expect(links(eager).length).toBeGreaterThan(3);
		expect(links(eager).every((link) => link.dataset.rmxPrefetch === "intent")).toBe(true);
	});

	test("fills a flex row it sits in, though it measures its own width", () => {
		let host = mount("/monitors");
		host.style.display = "flex";
		let bar = host.querySelector<HTMLElement>('[data-slot="filter-bar"]')!;

		expect(bar.getBoundingClientRect().width).toBeCloseTo(1024, 0);
	});

	test("renders the tabs as links, the current one marked, with formatted counts", () => {
		let host = mount("/monitors?state=active");
		let links = [...host.querySelectorAll<HTMLAnchorElement>('[data-slot="filter-bar-tabs"] a')];

		expect(host.querySelector('[data-slot="filter-bar-tabs"]')?.getAttribute("aria-label")).toBe(
			"Monitor states",
		);
		expect(links.map((link) => link.textContent)).toEqual(["Active1,213", "Paused41"]);
		expect(links[0]?.getAttribute("aria-current")).toBe("page");
		expect(links[1]?.hasAttribute("aria-current")).toBe(false);
	});

	test("opens a facet from the keyboard, lists values with counts, and applies with the rest of the view", async () => {
		let host = mount("/monitors?state=active&region=fra&sort=-checked&page=4");
		let sent = captureSubmits(host);
		let trigger = host.querySelector<HTMLButtonElement>('[data-slot="filter-bar-facet"]')!;
		let popover = document.getElementById("monitors-facet-status")!;

		trigger.focus();
		await userEvent.keyboard("{Enter}");
		expect(popover.matches(":popover-open")).toBe(true);

		let rows = [...popover.querySelectorAll('[data-slot="filter-bar-option"]')];
		expect(rows.map((row) => row.textContent)).toEqual(["Up1,204", "Degraded7", "Down2"]);
		expect(popover.getAttribute("role")).toBe("dialog");
		expect(popover.getAttribute("aria-labelledby")).toBe("monitors-facet-status-legend");

		await userEvent.tab();
		expect(document.activeElement).toBe(popover.querySelector('input[value="up"]'));
		await userEvent.tab();
		await userEvent.tab();
		expect(document.activeElement).toBe(popover.querySelector('input[value="down"]'));
		await userEvent.keyboard("[Space]");
		expect((document.activeElement as HTMLInputElement).checked).toBe(true);
		await userEvent.tab();
		expect(document.activeElement?.textContent).toBe("Apply");
		await userEvent.keyboard("{Enter}");

		expect(sent).toHaveLength(1);
		expect(sent[0]?.getAll("status")).toEqual(["down"]);
		expect(sent[0]?.getAll("region")).toEqual(["fra"]);
		expect(sent[0]?.get("state")).toBe("active");
		expect(sent[0]?.get("sort")).toBe("-checked");
		expect(sent[0]?.has("page")).toBe(false);
	});

	test("closes a facet on Escape without submitting", async () => {
		let host = mount("/monitors");
		let sent = captureSubmits(host);
		let trigger = host.querySelector<HTMLButtonElement>('[data-slot="filter-bar-facet"]')!;
		let popover = document.getElementById("monitors-facet-status")!;

		trigger.focus();
		await userEvent.keyboard("{Enter}");
		await userEvent.keyboard("{Escape}");

		expect(popover.matches(":popover-open")).toBe(false);
		expect(sent).toHaveLength(0);
	});

	test("closes a facet once Apply submits, so a page patched in place shows nothing open", async () => {
		let host = mount("/monitors");
		let sent = captureSubmits(host);
		let popover = document.getElementById("monitors-facet-status")!;
		host.querySelector<HTMLButtonElement>('[data-slot="filter-bar-facet"]')!.click();
		popover.querySelector<HTMLInputElement>('input[value="up"]')!.click();

		await userEvent.click(page.getByRole("button", { name: "Apply" }).first());

		expect(sent[0]?.getAll("status")).toEqual(["up"]);
		expect(popover.matches(":popover-open")).toBe(false);
	});

	test("turns a facet's chevron over while its popover is open, and its icon matches the View icon", async () => {
		let host = mount("/monitors", 1024, {
			facets: [{ ...FACETS[0]!, icon: <svg viewBox="0 0 24 24" width="24" height="24" /> }],
		});
		let trigger = host.querySelector<HTMLButtonElement>('[data-slot="filter-bar-facet"]')!;
		let chevron = trigger.querySelector<SVGElement>('[data-slot="filter-bar-chevron"]')!;
		let icon = trigger.querySelector("svg")!;
		expect(getComputedStyle(chevron).rotate).toBe("none");
		expect(icon.getBoundingClientRect().width).toBe(16);

		trigger.click();

		await expect.poll(() => getComputedStyle(chevron).rotate).toBe("180deg");
	});

	test("loads its form, tabs, chips and clear link into the frame it names", () => {
		let host = mount("/monitors?state=active&status=down", 1024, { target: "monitors" });
		let form = host.querySelector<HTMLFormElement>("form#monitors-form")!;
		let links = [...host.querySelectorAll<HTMLAnchorElement>("a[href]")];

		expect(form.getAttribute("data-rmx-target")).toBe("monitors");
		expect(links.length).toBeGreaterThan(2);
		for (let link of links)
			expect(link.getAttribute("data-rmx-target"), link.href).toBe("monitors");
	});

	test("names the search input after the bar, so a list's / key can focus it", () => {
		let host = mount("/monitors");

		expect(host.querySelector('input[type="search"]')?.id).toBe("monitors-search");
	});

	test("takes the search input's id from search.id when set", () => {
		let host = mount("/monitors", 1024, {
			search: { id: "monitor-search", label: "Search monitors" },
		});

		expect(host.querySelector('input[type="search"]')?.id).toBe("monitor-search");
	});

	test("lets a list's rowNavigation focus the search input on /", async () => {
		let host = mount("/monitors");
		let list = document.createElement("div");
		document.body.appendChild(list);
		mounted.push(
			render(
				<ul
					mix={[
						rowNavigation({
							search: "monitors-search",
							labels: { group: "Monitors", next: "Next", previous: "Previous" },
						}),
					]}
				>
					<li>
						<a href="#api">api.pulse.dev</a>
					</li>
				</ul>,
				{ container: list },
			),
		);
		await userEvent.keyboard("/");

		expect(document.activeElement).toBe(host.querySelector('input[type="search"]'));
	});

	test("submits the search on Enter through the form's default button", async () => {
		let host = mount("/monitors?status=down");
		let sent = captureSubmits(host);
		let input = host.querySelector<HTMLInputElement>('input[type="search"]')!;

		await userEvent.click(input);
		await userEvent.keyboard("checkout{Enter}");

		expect(sent).toHaveLength(1);
		expect(sent[0]?.get("q")).toBe("checkout");
		expect(sent[0]?.getAll("status")).toEqual(["down"]);
	});

	test("draws empty facets with a dashed outline and applied ones solid with a count", () => {
		let host = mount("/monitors?status=down&status=degraded");
		let [status, region] = [
			...host.querySelectorAll<HTMLElement>('[data-slot="filter-bar-facet"]'),
		];

		expect(getComputedStyle(region!).borderStyle).toBe("dashed");
		expect(getComputedStyle(status!).borderStyle).toBe("solid");
		expect(status!.querySelector('[data-slot="count"]')?.textContent).toBe("2");
		expect(region!.querySelector('[data-slot="count"]')).toBeNull();
	});

	test("shows applied filters as segmented chips whose remove link drops that parameter", () => {
		let host = mount("/monitors?state=active&status=down&status=degraded&region=fra&page=2");
		let chips = [...host.querySelectorAll<HTMLElement>('[data-slot="filter-bar-chip"]')];

		expect(chips.map((chip) => chip.getAttribute("aria-label"))).toEqual([
			"Status is any of Down, Degraded",
			"Region is Frankfurt",
		]);
		let remove = chips[0]!.querySelector<HTMLAnchorElement>('[data-slot="remove"]')!;
		expect(remove.getAttribute("href")).toBe("/monitors?state=active&region=fra");
		expect(remove.getAttribute("aria-label")).toBe("Remove Status: Down, Degraded");
		expect(chips[0]!.querySelector('[data-slot="values"]')?.getAttribute("commandfor")).toBe(
			"monitors-facet-status",
		);
	});

	test("shows the search query as a chip", () => {
		let host = mount("/monitors?q=checkout");
		let chip = host.querySelector<HTMLElement>('[data-name="q"]')!;

		expect(chip.getAttribute("aria-label")).toBe("Search monitors is checkout");
		expect(chip.querySelector("a")?.getAttribute("href")).toBe("/monitors");
	});

	test("offers Clear filters only once something is applied", () => {
		let empty = mount("/monitors?state=active&sort=-checked");
		expect(empty.querySelector('[data-slot="filter-bar-clear"]')).toBeNull();
		expect(empty.querySelector('[data-slot="filter-bar-chips"]')).toBeNull();

		let applied = mount("/monitors?state=active&sort=-checked&status=down&q=api");
		let clear = applied.querySelector<HTMLAnchorElement>('[data-slot="filter-bar-clear"]')!;
		expect(clear.getAttribute("href")).toBe("/monitors?state=active&sort=-checked");
		expect(clear.querySelector("kbd")?.textContent).toBe("Esc");
	});

	test("follows Clear filters on Escape unless a field or a popover has the key", async () => {
		let host = mount("/monitors?status=down");
		let clear = host.querySelector<HTMLAnchorElement>('[data-slot="filter-bar-clear"]')!;
		let followed = 0;
		clear.addEventListener("click", (event) => {
			event.preventDefault();
			followed++;
		});

		host.querySelector<HTMLInputElement>('input[type="search"]')!.focus();
		await userEvent.keyboard("{Escape}");
		expect(followed).toBe(0);

		host.querySelector<HTMLButtonElement>('[data-slot="filter-bar-facet"]')!.focus();
		await userEvent.keyboard("{Enter}");
		await userEvent.keyboard("{Escape}");
		expect(followed).toBe(0);

		await userEvent.keyboard("{Escape}");
		expect(followed).toBe(1);
	});

	test("wraps to more lines at 375 with every facet still shown", async () => {
		await page.viewport(375, 800);
		let host = mount("/monitors?status=down", 343);
		let row = host.querySelector<HTMLElement>('[data-slot="filter-bar-row"]')!;

		expect(row.getBoundingClientRect().height).toBeGreaterThan(40);
		for (let trigger of host.querySelectorAll('[data-slot="filter-bar-facet"]')) {
			let box = trigger.getBoundingClientRect();
			expect(box.width).toBeGreaterThan(0);
			expect(box.right).toBeLessThanOrEqual(host.getBoundingClientRect().right + 0.5);
		}
		expect(host.scrollWidth).toBeLessThanOrEqual(343);
	});

	test("never scrolls the page sideways at 320", async () => {
		await page.viewport(320, 700);
		let host = mount("/monitors?status=down&status=degraded&region=fra&q=checkout", 288);

		expect(host.scrollWidth).toBeLessThanOrEqual(288);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320);
	});

	for (let width of [320, 375]) {
		test(`wraps five count tabs inside the page at ${width}`, async () => {
			await page.viewport(width, 800);
			let tabs: FilterBar.Tab[] = ["All", "Published", "Drafts", "Scheduled", "Archived"].map(
				(label, index) => ({ label, count: 120 * (index + 1), href: `/posts?status=${label}` }),
			);
			let host = mount("/posts", width - 32, { tabs, collapse: true });
			let nav = host.querySelector<HTMLElement>('[data-slot="filter-bar-tabs"]')!;

			expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
			expect(nav.scrollWidth).toBeLessThanOrEqual(nav.clientWidth);
			for (let tab of nav.querySelectorAll("a")) {
				expect(tab.getBoundingClientRect().right).toBeLessThanOrEqual(
					host.getBoundingClientRect().right + 0.5,
				);
			}
		});
	}

	test("keeps the bar on one line at 1280", () => {
		let host = mount("/monitors", 1200);
		let row = host.querySelector<HTMLElement>('[data-slot="filter-bar-row"]')!;

		expect(row.getBoundingClientRect().height).toBeLessThanOrEqual(40);
	});

	test("collapses the facets behind Filters in a narrow bar and shows them inline in a wide one", async () => {
		let narrow = mount("/monitors?status=down", 320, { id: "narrow", collapse: true });
		let toggle = narrow.querySelector<HTMLButtonElement>('[data-slot="filter-bar-collapse"]')!;
		let list = document.getElementById("narrow-facets")!;

		expect(toggle.getBoundingClientRect().width).toBeGreaterThan(0);
		expect(toggle.querySelector('[data-slot="count"]')?.textContent).toBe("1");
		expect(list.getBoundingClientRect().width).toBe(0);
		await userEvent.click(toggle);
		expect(list.matches(":popover-open")).toBe(true);
		let facet = list.querySelector<HTMLButtonElement>('[data-slot="filter-bar-facet"]')!;
		await userEvent.click(facet);
		expect(document.getElementById("narrow-facet-status")!.matches(":popover-open")).toBe(true);
		expect(list.matches(":popover-open")).toBe(true);

		let wide = mount("/monitors", 1000, { id: "wide", collapse: true });
		expect(
			wide.querySelector('[data-slot="filter-bar-collapse"]')!.getBoundingClientRect().width,
		).toBe(0);
		expect(document.getElementById("wide-facets")!.getBoundingClientRect().width).toBeGreaterThan(
			0,
		);
	});

	test("sorts through links in the View menu that keep every filter and mark the current order", () => {
		let host = mount("/monitors?status=down&sort=-checked&page=3");
		let menu = document.getElementById("monitors-options")!;
		let items = [...menu.querySelectorAll<HTMLAnchorElement>("#monitors-sort a")];

		expect(items.map((item) => item.getAttribute("href"))).toEqual([
			"/monitors?status=down",
			"/monitors?status=down&sort=-checked",
		]);
		expect(items.map((item) => item.getAttribute("aria-current"))).toEqual([null, "true"]);
		expect(document.getElementById("monitors-sort")?.getAttribute("aria-label")).toBe("Sort by");
		let trigger = host.querySelector('[data-slot="filter-bar-options"]')!;
		expect(trigger.getAttribute("commandfor")).toBe("monitors-options");
		expect(trigger.getAttribute("aria-label")).toBe("View");
	});
});

describe("FilterBar layout", () => {
	test("keeps every slot on one row at 1280, with sort, display and auto-refresh in the View menu", async () => {
		let host = mountFull("/monitors", 1248);
		let row = host.querySelector<HTMLElement>('[data-slot="filter-bar-row"]')!;
		let menu = document.getElementById("monitors-options")!;

		expect(row.getBoundingClientRect().height).toBeLessThanOrEqual(36);
		expect(menu.contains(menu.querySelector('[data-slot="view-options"]'))).toBe(true);
		expect(menu.querySelector('[data-slot="auto-refresh"]')).not.toBeNull();
		expect(menu.querySelector("#monitors-sort")).not.toBeNull();
		let topLevel = [
			...row.querySelectorAll(
				'[data-slot="filter-bar-sort"], [data-slot="view-options-trigger"], [data-slot="auto-refresh-trigger"]',
			),
		].filter(drawn);
		expect(topLevel).toHaveLength(0);
		let trigger = row.querySelector('[data-slot="filter-bar-options"]');
		expect(drawn(trigger)).toBe(true);
		expect(drawn(row.querySelector('[data-slot="filter-bar-status"]'))).toBe(true);

		await userEvent.click(trigger!);
		expect(menu.matches(":popover-open")).toBe(true);
		expect(drawn(menu.querySelector('[data-slot="auto-refresh-choices"]'))).toBe(true);
	});

	test("orders the row tabs, search, facets, then status and the View menu at the end", () => {
		let host = mountFull("/monitors", 1248);
		let left = (selector: string) => host.querySelector(selector)!.getBoundingClientRect().left;

		expect(left('[data-slot="filter-bar-tabs"]')).toBeLessThan(left('input[type="search"]'));
		expect(left('input[type="search"]')).toBeLessThan(left('[data-slot="filter-bar-facet"]'));
		expect(left('[data-slot="filter-bar-facet"]')).toBeLessThan(
			left('[data-slot="filter-bar-status"]'),
		);
		expect(left('[data-slot="filter-bar-status"]')).toBeLessThan(
			left('[data-slot="filter-bar-options"]'),
		);
		expect(
			host.querySelector('[data-slot="filter-bar-options"]')!.getBoundingClientRect().right,
		).toBeCloseTo(1248, 0);
	});

	test("draws the status quieter than the controls", () => {
		let host = mountFull("/monitors", 1248);
		let status = host.querySelector<HTMLElement>('[data-slot="filter-bar-status"]')!;
		let tab = host.querySelector<HTMLElement>('[data-slot="filter-bar-tabs"] a')!;

		expect(parseFloat(getComputedStyle(status).fontSize)).toBeLessThan(
			parseFloat(getComputedStyle(tab).fontSize),
		);
	});

	test("caps the search width so it leaves the row to the other controls", () => {
		let host = mountFull("/monitors", 1248);
		let width = host.querySelector('[data-slot="search-field"]')!.getBoundingClientRect().width;

		expect(width).toBeLessThanOrEqual(320);
		expect(width).toBeGreaterThanOrEqual(160);
	});

	test("fits two rows at 768 and drops the status first", async () => {
		await page.viewport(768, 800);
		let host = mountFull("/monitors", 736);
		let row = host.querySelector<HTMLElement>('[data-slot="filter-bar-row"]')!;

		expect(row.getBoundingClientRect().height).toBeLessThanOrEqual(76);
		expect(drawn(row.querySelector('[data-slot="filter-bar-status"]'))).toBe(false);
		expect(drawn(row.querySelector('[data-slot="filter-bar-options"]'))).toBe(true);
		for (let facet of row.querySelectorAll('[data-slot="filter-bar-facet"]')) {
			expect(drawn(facet)).toBe(true);
		}
	});

	test("never scrolls the page sideways at 375 with every slot filled", async () => {
		await page.viewport(375, 800);
		let host = mountFull("/monitors?status=down&q=checkout", 343);

		expect(host.scrollWidth).toBeLessThanOrEqual(343);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
		expect(drawn(host.querySelector('[data-slot="filter-bar-options"]'))).toBe(true);
	});

	test("draws a tab with nothing in it quieter, and keeps it", () => {
		for (let [step, lightness] of [
			50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
		].entries()) {
			document.documentElement.style.setProperty(
				`--ui-color-neutral-${lightness}`,
				`oklch(${0.98 - step * 0.08} 0 0)`,
			);
		}
		let host = mountFull("/monitors", 1248);
		let [, failing, paused] = [
			...host.querySelectorAll<HTMLElement>('[data-slot="filter-bar-tabs"] [data-slot="count"]'),
		];

		expect(paused!.textContent).toBe("0");
		expect(getComputedStyle(paused!).backgroundColor).toBe("rgba(0, 0, 0, 0)");
		expect(getComputedStyle(failing!).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
		expect(getComputedStyle(paused!).color).not.toBe(getComputedStyle(failing!).color);
	});
});
