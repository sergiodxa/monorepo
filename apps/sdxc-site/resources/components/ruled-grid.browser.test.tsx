/**
 * Lays a ruled index out in a real browser at the widths a catalogue meets on a phone and a
 * tablet: a name wider than its column breaks inside its cell, so the grid never reaches past
 * the column it sits in and the page never scrolls sideways.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import RuledGrid, { RuledCell } from "~/resources/components/ruled-grid";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";

/** Names as long as the longest the catalogues list, which overflowed two-column rows. */
const NAMES = [
	"marketingFoundationsTokens",
	"ui/marketing-foundations",
	"Badge",
	"AnnouncementChip",
];

/** Column widths a catalogue gets between a small phone and a tablet with the tree docked. */
const WIDTHS = [280, 335, 374, 560, 580];

let cleanups: Array<() => void> = [];

afterEach(() => {
	for (let cleanup of cleanups) cleanup();
	cleanups = [];
	document.body.replaceChildren();
});

/** Mounts the catalogue's grid in a column `width` pixels wide. */
function mount(width: number): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	let { cleanup } = render(
		<RuledGrid min="11rem">
			{NAMES.map((name) => (
				<RuledCell key={name} href={`/api/ui/${name}`} name={name} />
			))}
		</RuledGrid>,
		{ container: host },
	);
	cleanups.push(cleanup);
	return host;
}

describe("RuledGrid", () => {
	test.each(WIDTHS)("keeps every name inside a %ipx column", (width) => {
		let host = mount(width);

		expect(host.scrollWidth).toBeLessThanOrEqual(width);
		for (let cell of host.querySelectorAll("li")) {
			expect(cell.scrollWidth).toBeLessThanOrEqual(cell.clientWidth);
		}
	});
});
