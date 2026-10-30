/**
 * Lays a {@link SponsorWall} out in a real browser at phone and desktop widths: each tier's
 * column count, rows that always fill the grid's width, no horizontal overflow, and backer
 * circles that stay grayscale until hovered or focused, with a 44px hit area.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";

import { HeadingScope } from "../components/heading-scope.js";

import { SponsorWall } from "./sponsor-wall.js";

import "../reset.css";
import "../theme.css";

/** A mark sized like a real wordmark, drawn in `currentColor`. */
function mark(name: string) {
	return (
		<a href={`https://${name.toLowerCase()}.com`}>
			<svg viewBox="0 0 140 28" role="img" aria-label={name} fill="currentColor">
				<rect width="140" height="28" rx="4" />
			</svg>
		</a>
	);
}

/** `count` marks named after their position. */
function marks(prefix: string, count: number) {
	return Array.from({ length: count }, (_, index) => mark(`${prefix}${index + 1}`));
}

/** Mounts a four-tier wall with backers in a host `width` pixels wide. */
function mount(width: number): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	render(
		<HeadingScope level={2}>
			<SponsorWall actions={<a href="/sponsor">Become a sponsor</a>}>
				<SponsorWall.Tier label="Gold" size="xl">
					{marks("Gold", 3)}
				</SponsorWall.Tier>
				<SponsorWall.Tier label="Silver" size="lg">
					{marks("Silver", 5)}
				</SponsorWall.Tier>
				<SponsorWall.Tier label="Bronze" size="md">
					{marks("Bronze", 7)}
				</SponsorWall.Tier>
				<SponsorWall.Tier label="Backers" size="sm">
					{marks("Backer", 8)}
				</SponsorWall.Tier>
				<SponsorWall.Tier label="Community" size="sm">
					{marks("Community", 12)}
				</SponsorWall.Tier>
				<SponsorWall.Individuals label="Individuals">
					<SponsorWall.Person href="https://example.com/ana" name="Ana Souza" size="sm" />
					<SponsorWall.Person href="https://example.com/bo" name="Bo Lindqvist" size="lg" />
				</SponsorWall.Individuals>
			</SponsorWall>
		</HeadingScope>,
		{ container: host },
	);
	return host;
}

/** The cells of the tier at `index`, grouped into rows by their top edge. */
function rows(host: HTMLElement, index: number): { grid: DOMRect; rows: DOMRect[][] } {
	let grid = host.querySelectorAll<HTMLElement>('[data-slot="sponsor-wall-marks"]')[index]!;
	let byTop = new Map<number, DOMRect[]>();
	for (let cell of grid.children) {
		let rect = cell.getBoundingClientRect();
		let top = Math.round(rect.top);
		byTop.set(top, [...(byTop.get(top) ?? []), rect]);
	}
	return { grid: grid.getBoundingClientRect(), rows: [...byTop.values()] };
}

/** Finishes every running transition, so a computed style reads its settled value. */
function settle(): void {
	for (let animation of document.getAnimations()) animation.finish();
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("SponsorWall", () => {
	test("steps each tier's columns from xl to sm at 1280, balancing rows by count", () => {
		let host = mount(1280);
		expect(rows(host, 0).rows.map((row) => row.length)).toEqual([2, 1]);
		expect(rows(host, 1).rows.map((row) => row.length)).toEqual([3, 2]);
		expect(rows(host, 2).rows.map((row) => row.length)).toEqual([4, 3]);
		expect(rows(host, 3).rows.map((row) => row.length)).toEqual([4, 4]);
		expect(rows(host, 4).rows.map((row) => row.length)).toEqual([6, 6]);

		let gold = rows(host, 0).rows[0]![0]!;
		let backer = rows(host, 3).rows[0]![0]!;
		expect(gold.height).toBe(240);
		expect(backer.height).toBe(80);
	});

	test.each([375, 1280])("fills every row edge to edge with no overflow at %ipx", (width) => {
		let host = mount(width);
		expect(host.scrollWidth).toBeLessThanOrEqual(width);

		for (let index = 0; index < 5; index++) {
			let tier = rows(host, index);
			for (let row of tier.rows) {
				expect(Math.round(row[0]!.left)).toBe(Math.round(tier.grid.left));
				expect(Math.round(row.at(-1)!.right)).toBe(Math.round(tier.grid.right));
			}
		}
	});

	test("uses fewer columns on a phone", () => {
		let host = mount(375);
		expect(rows(host, 0).rows.map((row) => row.length)).toEqual([1, 1, 1]);
		expect(rows(host, 1).rows[0]).toHaveLength(2);
		expect(rows(host, 3).rows[0]).toHaveLength(3);
	});

	test("draws marks in the grid's ink, so they follow the theme", () => {
		let host = mount(1280);
		let grid = host.querySelector<HTMLElement>('[data-slot="sponsor-wall-marks"]')!;
		let svg = grid.querySelector<SVGElement>("svg")!;
		expect(getComputedStyle(svg).color).toBe(getComputedStyle(grid).color);
		expect(getComputedStyle(svg).fill).toBe(getComputedStyle(grid).color);
	});

	test("keeps backers grayscale until hover or focus, each named and 44px to tap", async () => {
		let host = mount(375);
		let [ana, bo] = host.querySelectorAll<HTMLAnchorElement>('[data-slot="sponsor-wall-person"] a');
		expect(ana!.getAttribute("aria-label")).toBe("Ana Souza");
		expect(ana!.textContent).toBe("AS");
		expect(getComputedStyle(ana!).filter).toBe("grayscale(1)");
		expect(ana!.getBoundingClientRect().width).toBe(32);
		expect(bo!.getBoundingClientRect().width).toBe(56);

		let hit = getComputedStyle(ana!, "::after");
		expect(hit.position).toBe("absolute");
		expect(hit.inset).toBe("-6px");

		await userEvent.hover(bo!);
		settle();
		expect(getComputedStyle(bo!).filter).toBe("none");

		await userEvent.tab();
		ana!.focus();
		settle();
		expect(ana!.matches(":focus-visible")).toBe(true);
		expect(getComputedStyle(ana!).filter).toBe("none");
	});

	test("labels each tier with a heading under the ambient level", () => {
		let host = mount(1280);
		let labels = [...host.querySelectorAll('[data-slot="sponsor-wall-label"]')];
		expect(labels.map((label) => label.tagName)).toEqual(["H3", "H3", "H3", "H3", "H3", "H3"]);
	});
});
