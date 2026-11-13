/**
 * Lays a {@link ContributorWall} out in a real browser: its column steps by container width,
 * square tiles that fill every row, named links with initials, a stable tint per name, and
 * the closing tile counting everyone the wall leaves out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";

import { ContributorWall } from "./contributor-wall.js";

import "../reset.css";
import "../theme.css";

/** Thirty-five names, so with the closing tile the wall holds 36: rows of 6, 9 and 12. */
const NAMES = Array.from(
	{ length: 35 },
	(_, index) => `Person ${String.fromCharCode(65 + (index % 26))}${index}`,
);

/** The tokens the tiles read, which an app's palette would otherwise supply. */
const TOKENS = {
	"--ui-neutral-fg-emphasis": "rgb(20, 20, 20)",
	"--ui-neutral-fg-muted": "rgb(90, 90, 90)",
	"--ui-landing-hairline": "rgba(20, 20, 20, 0.1)",
	"--ui-brand-bg-solid": "rgb(190, 240, 40)",
	"--ui-brand-fg-on-solid": "rgb(10, 10, 10)",
};

/** Mounts a wall of {@link NAMES} plus the closing tile in a host `width` pixels wide. */
function mount(width: number): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	for (let [name, value] of Object.entries(TOKENS)) host.style.setProperty(name, value);
	document.body.appendChild(host);
	render(
		<ContributorWall aria-label="Contributors">
			{NAMES.map((name) => (
				<ContributorWall.Person key={name} href={`https://example.com/${name}`} name={name} />
			))}
			<ContributorWall.More
				href="https://example.com/all"
				count="+179"
				aria-label="All 214 contributors"
			/>
		</ContributorWall>,
		{ container: host },
	);
	return host;
}

/** The tiles grouped into rows by their top edge. */
function rows(host: HTMLElement): DOMRect[][] {
	let byTop = new Map<number, DOMRect[]>();
	for (let tile of host.querySelectorAll('[data-slot="contributor-wall-tiles"] > li')) {
		let rect = tile.getBoundingClientRect();
		let top = Math.round(rect.top);
		byTop.set(top, [...(byTop.get(top) ?? []), rect]);
	}
	return [...byTop.values()];
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("ContributorWall", () => {
	test.each([
		[340, 6],
		[640, 9],
		[960, 12],
	])("lays %ipx out in full rows of %i square tiles", (width, columns) => {
		let host = mount(width);
		let lines = rows(host);
		expect(lines.every((line) => line.length === columns)).toBe(true);
		expect(lines).toHaveLength(36 / columns);

		let first = lines[0]![0]!;
		expect(Math.abs(first.width - first.height)).toBeLessThan(1);
		expect(host.scrollWidth).toBeLessThanOrEqual(width);
	});

	test("names each tile and shows the person's initials", () => {
		let host = mount(640);
		let link = host.querySelector<HTMLAnchorElement>('[data-slot="contributor-wall-person"] a')!;
		expect(link.getAttribute("aria-label")).toBe("Person A0");
		expect(link.getAttribute("title")).toBe("Person A0");
		expect(link.textContent).toBe("PA");
		expect(host.querySelector("ul")!.getAttribute("aria-label")).toBe("Contributors");
	});

	test("gives a name the same tint on every render", () => {
		let first = mount(640).querySelector<HTMLElement>('[data-slot="contributor-wall-person"] a')!;
		let tint = getComputedStyle(first).backgroundColor;
		document.body.replaceChildren();
		let again = mount(640).querySelector<HTMLElement>('[data-slot="contributor-wall-person"] a')!;
		expect(getComputedStyle(again).backgroundColor).toBe(tint);
	});

	test("ends on an outlined tile that links to everyone", () => {
		let host = mount(640);
		let more = host.querySelector<HTMLAnchorElement>('[data-slot="contributor-wall-more"] a')!;
		expect(more.getAttribute("aria-label")).toBe("All 214 contributors");
		expect(more.getAttribute("href")).toBe("https://example.com/all");
		expect(more.textContent).toBe("+179");
		expect(getComputedStyle(more).boxShadow).toContain("inset");
	});

	test("fills a tile with the brand on focus without changing its size", async () => {
		let host = mount(640);
		let link = host.querySelector<HTMLAnchorElement>('[data-slot="contributor-wall-person"] a')!;
		let before = link.getBoundingClientRect();
		await userEvent.tab();
		for (let animation of document.getAnimations()) animation.finish();
		expect(document.activeElement).toBe(link);
		expect(getComputedStyle(link).backgroundColor).toBe(TOKENS["--ui-brand-bg-solid"]);
		expect(getComputedStyle(link).color).toBe(TOKENS["--ui-brand-fg-on-solid"]);
		expect(link.getBoundingClientRect()).toEqual(before);
	});
});
