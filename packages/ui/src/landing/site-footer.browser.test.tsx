/**
 * Lays a {@link SiteFooter} out in a real browser at phone, tablet and desktop widths:
 * every row of link columns fills the grid, nothing overflows, links stay undecorated
 * with comfortable targets, and the wordmark spans the content hidden from assistive tech.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { describe, expect, test } from "vitest";

import { SiteFooter } from "./site-footer.js";

/** Host widths the footer is checked at: phone, tablet, laptop and desktop. */
const WIDTHS = [375, 768, 1024, 1440] as const;

/** Column counts the no-orphan rule is checked for. */
const COUNTS = [2, 3, 4, 5, 6] as const;

/** Column titles, long enough that a too-narrow track would overflow. */
const TITLES = ["Product", "Developers", "Company", "Resources", "Legal", "Community"];

/** Links the footer itself sizes: column links, social icons and legal links. */
const FOOTER_LINKS =
	'[data-slot="site-footer-column"] a, [data-slot="site-footer-social"] > a, [data-slot="site-footer-legal"] a';

/** Builds `count` columns of four links each, one with a long label. */
function makeColumns(count: number): SiteFooter.Column[] {
	return TITLES.slice(0, count).map((title) => ({
		title,
		links: [
			{ label: "Overview", href: "#" },
			{ label: "Subprocessors", href: "#" },
			{ label: "Changelog", href: "#" },
			{ label: "Status", href: "#" },
		],
	}));
}

/** Mounts a full footer with `count` columns into a host `width` pixels wide. */
function mountFooter(width: number, count: number) {
	let host = document.createElement("div");
	host.style.inlineSize = `${width}px`;
	document.body.appendChild(host);
	let { container } = render(
		<SiteFooter
			brand={<a href="/">Keel</a>}
			tagline="Usage-based billing for API companies."
			columns={makeColumns(count)}
			newsletter={<form aria-label="Newsletter" />}
			social={
				<>
					<a href="/page" aria-label="RSS">
						<svg viewBox="0 0 24 24" />
					</a>
					<a href="/page" aria-label="Email">
						<svg viewBox="0 0 24 24" />
					</a>
				</>
			}
			legal={
				<>
					<p>© 2026 Keel</p>
					<a href="/page">Privacy</a>
					<a href="/page">Terms</a>
				</>
			}
			wordmark={<svg viewBox="0 0 400 100" />}
		/>,
		{ container: host },
	);
	let footer = container.querySelector<HTMLElement>('[data-slot="site-footer"]')!;
	let grid = footer.querySelector<HTMLElement>('[data-slot="site-footer-columns"]')!;
	let columns = [...grid.querySelectorAll<HTMLElement>('[data-slot="site-footer-column"]')];
	return { host, footer, grid, columns };
}

/** The columns grouped by the row they sit on, keyed by their top edge. */
function rows(columns: HTMLElement[]) {
	let byTop = new Map<number, HTMLElement[]>();
	for (let column of columns) {
		let top = Math.round(column.getBoundingClientRect().top);
		byTop.set(top, [...(byTop.get(top) ?? []), column]);
	}
	return [...byTop.values()];
}

describe("SiteFooter layout", () => {
	for (let width of WIDTHS) {
		for (let count of COUNTS) {
			test(`fills every row of ${count} columns at ${width}px without overflow`, () => {
				let { host, footer, grid, columns } = mountFooter(width, count);
				let gridBox = grid.getBoundingClientRect();

				for (let row of rows(columns)) {
					let right = Math.max(...row.map((column) => column.getBoundingClientRect().right));
					expect(right).toBeGreaterThan(gridBox.right - 1);
				}

				expect(footer.scrollWidth).toBeLessThanOrEqual(footer.clientWidth);
				for (let link of footer.querySelectorAll<HTMLElement>("a")) {
					expect(link.getBoundingClientRect().right).toBeLessThanOrEqual(
						footer.getBoundingClientRect().right,
					);
				}
				host.remove();
			});
		}
	}

	test("sets two columns per row on a phone and every column on one row from 768px", () => {
		let phone = mountFooter(375, 4);
		expect(rows(phone.columns).map((row) => row.length)).toEqual([2, 2]);
		phone.host.remove();

		for (let width of [768, 1024, 1440]) {
			for (let count of [3, 4, 5]) {
				let wide = mountFooter(width, count);
				expect(rows(wide.columns)).toHaveLength(1);
				wide.host.remove();
			}
		}
	});

	test("puts the brand block above the columns on a tablet and beside them on a desktop", () => {
		let tablet = mountFooter(768, 4);
		let tabletBrand = tablet.footer.querySelector('[data-slot="site-footer-brand"]')!;
		expect(tablet.grid.getBoundingClientRect().top).toBeGreaterThan(
			tabletBrand.getBoundingClientRect().bottom,
		);
		tablet.host.remove();

		let desktop = mountFooter(1440, 5);
		let desktopBrand = desktop.footer.querySelector('[data-slot="site-footer-brand"]')!;
		expect(desktop.grid.getBoundingClientRect().left).toBeGreaterThan(
			desktopBrand.getBoundingClientRect().right,
		);
		desktop.host.remove();
	});
});

describe("SiteFooter links", () => {
	test("draws links without an underline and with 44px targets on a phone", () => {
		let { host, footer } = mountFooter(375, 4);
		let links = footer.querySelectorAll<HTMLElement>(FOOTER_LINKS);

		for (let link of links) {
			expect(getComputedStyle(link).textDecorationLine).toBe("none");
			expect(link.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
		}
		let icon = footer.querySelector<SVGElement>('[data-slot="site-footer-social"] svg')!;
		expect(icon.getBoundingClientRect().width).toBe(20);
		host.remove();
	});

	test("keeps desktop targets at least 24px tall", () => {
		let { host, footer } = mountFooter(1440, 4);

		for (let link of footer.querySelectorAll<HTMLElement>(FOOTER_LINKS)) {
			expect(link.getBoundingClientRect().height).toBeGreaterThanOrEqual(24);
		}
		host.remove();
	});

	test("titles columns one heading level below a visually hidden footer heading", () => {
		let { host, footer } = mountFooter(1440, 3);

		expect(footer.querySelector("h2")?.textContent).toBe("Footer");
		expect([...footer.querySelectorAll("h3")].map((h) => h.textContent)).toEqual(
			TITLES.slice(0, 3),
		);
		host.remove();
	});
});

describe("SiteFooter wordmark", () => {
	test("spans the content width at the very bottom, hidden from assistive technology", () => {
		let { host, footer, grid } = mountFooter(1440, 4);
		let wordmark = footer.querySelector<HTMLElement>('[data-slot="site-footer-wordmark"]')!;
		let svg = wordmark.querySelector("svg")!;

		expect(wordmark.getAttribute("aria-hidden")).toBe("true");
		expect(svg.getBoundingClientRect().width).toBeCloseTo(grid.parentElement!.clientWidth, 0);
		expect(wordmark.getBoundingClientRect().bottom).toBeGreaterThanOrEqual(
			footer.getBoundingClientRect().bottom,
		);
		host.remove();
	});
});

describe("SiteFooter prefetch", () => {
	test("leaves column links unprefetched by default", () => {
		let { host, footer } = mountFooter(1440, 2);

		expect(footer.querySelectorAll("a[data-rmx-prefetch]")).toHaveLength(0);
		host.remove();
	});

	test("prefetches every column link on intent", () => {
		let host = document.createElement("div");
		document.body.appendChild(host);
		let { container } = render(<SiteFooter prefetch="intent" columns={makeColumns(3)} />, {
			container: host,
		});
		let links = container.querySelectorAll<HTMLAnchorElement>('[data-slot="site-footer-column"] a');

		expect(links).toHaveLength(12);
		for (let link of links) expect(link.dataset.rmxPrefetch).toBe("intent");
		host.remove();
	});
});
