/**
 * Lays a card bento out in a real browser and checks the gaps between cards
 * and the larger outer corners at the one-column step, which only a live
 * layout with container queries resolves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { describe, expect, test } from "vitest";

import { Bento } from "./bento.js";

/** Mounts a three-cell card bento inside a host of the given inline size. */
function mountBento(width: string) {
	let host = document.createElement("div");
	host.style.inlineSize = width;
	document.body.appendChild(host);
	let { container } = render(
		<Bento columns={3}>
			<Bento.Cell>
				<Bento.Title>Monitors</Bento.Title>
			</Bento.Cell>
			<Bento.Cell>
				<Bento.Title>Incidents</Bento.Title>
			</Bento.Cell>
			<Bento.Cell>
				<Bento.Title>Status pages</Bento.Title>
			</Bento.Cell>
		</Bento>,
		{ container: host },
	);
	let cells = [...container.querySelectorAll<HTMLElement>('[data-slot="bento-cell"]')];
	return { cells, grid: cells[0]!.parentElement! };
}

describe("Bento cards", () => {
	test("separates cards with a gap", () => {
		let { cells, grid } = mountBento("20rem");

		expect(Number.parseFloat(getComputedStyle(grid).rowGap)).toBeGreaterThan(0);
		expect(cells[1]!.getBoundingClientRect().top).toBeGreaterThan(
			cells[0]!.getBoundingClientRect().bottom,
		);
	});

	test("rounds the first card's outer top corner more than its inner bottom corner at one column", () => {
		let { cells } = mountBento("20rem");
		let first = getComputedStyle(cells[0]!);

		expect(Number.parseFloat(first.borderStartStartRadius)).toBeGreaterThan(
			Number.parseFloat(first.borderEndEndRadius),
		);
		expect(Number.parseFloat(first.borderStartEndRadius)).toBeGreaterThan(
			Number.parseFloat(first.borderEndStartRadius),
		);
	});

	test("puts the requested columns on one row at the lg container", () => {
		let { cells } = mountBento("60rem");
		let tops = cells.map((cell) => cell.getBoundingClientRect().top);

		expect(new Set(tops).size).toBe(1);
		expect(Number.parseFloat(getComputedStyle(cells[1]!).borderStartStartRadius)).toBe(8);
	});
});

/** Mounts a bento at a desktop width whose cells lead with media of the given heights. */
function mountWithMedia(heights: ReadonlyArray<number | null>, titles?: ReadonlyArray<string>) {
	let host = document.createElement("div");
	host.style.inlineSize = "72rem";
	document.body.appendChild(host);
	let { container } = render(
		<Bento columns={3}>
			{heights.map((height, index) => (
				<Bento.Cell key={index}>
					{height === null ? null : (
						<Bento.Media>
							<div style={{ blockSize: `${height}px` }} />
						</Bento.Media>
					)}
					<Bento.Title>{titles?.[index] ?? `Cell ${index}`}</Bento.Title>
					<Bento.Body>Supporting copy for the cell.</Bento.Body>
				</Bento.Cell>
			))}
		</Bento>,
		{ container: host },
	);
	let tops = (slot: string) =>
		[...container.querySelectorAll(`[data-slot="${slot}"]`)].map(
			(element) => element.getBoundingClientRect().top,
		);
	return {
		container,
		titles: tops("bento-title"),
		bodies: tops("bento-body"),
		cells: tops("bento-cell"),
	};
}

describe("Bento cell tracks", () => {
	test("lines up a row's titles and bodies whatever height each cell's media is", () => {
		let { bodies, titles } = mountWithMedia(
			[80, 140, 60, 40, 120, null],
			["Short", "A title long enough to wrap onto a second line", "Short", "One", "Two", "Three"],
		);

		for (let row of [titles.slice(0, 3), titles.slice(3, 6)]) {
			expect(Math.max(...row) - Math.min(...row)).toBeLessThanOrEqual(1);
		}
		expect(Math.max(...bodies.slice(0, 3)) - Math.min(...bodies.slice(0, 3))).toBeLessThanOrEqual(
			1,
		);
	});

	test("keeps a cell without media opening on its title at the cell padding", () => {
		let { cells, titles } = mountWithMedia([null, null, null]);

		expect(titles[0]! - cells[0]!).toBe(40);
	});

	test("draws titles at 1.5rem, weight 500 and balanced from the md container", () => {
		let { container } = mountWithMedia([null]);
		let title = container.querySelector('[data-slot="bento-title"]')!;
		let style = getComputedStyle(title);

		expect(style.fontSize).toBe("24px");
		expect(style.lineHeight).toBe("32px");
		expect(style.fontWeight).toBe("500");
		expect(style.textWrap).toContain("balance");
	});
});
