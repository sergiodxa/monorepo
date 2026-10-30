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
