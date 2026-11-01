/**
 * Lays {@link ChangelogStrip} out in a real browser: a phone gets a snapping row that scrolls
 * inside itself, wider columns get a grid whose last row never holds a lone entry, and each
 * dot centres on the rule it sits on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { describe, expect, test } from "vitest";

import { ChangelogStrip } from "./changelog-strip.js";

/** Release titles the mounted strips draw, newest first. */
const RELEASES = [
	"Status pages",
	"Two-region confirmation",
	"Slack escalation",
	"Webhook retries",
	"Maintenance windows",
	"SAML sign-in",
] as const;

/** Mounts a strip of `count` linked entries in a `width`-pixel column attached to the document. */
function mountStrip(width: number, count: number): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	return render(
		<ChangelogStrip title="Changelog" action={<a href="/changelog">View all →</a>}>
			{RELEASES.slice(0, count).map((title, index) => (
				<ChangelogStrip.Entry
					key={title}
					dateTime={`2026-10-${String(28 - index).padStart(2, "0")}`}
					date={`Oct ${28 - index}`}
					title={title}
					href={`/changelog/${index}`}
				>
					A summary long enough to wrap onto a second line and then a third, which the clamp hides
					so every entry keeps the same height.
				</ChangelogStrip.Entry>
			))}
		</ChangelogStrip>,
		{ container: host },
	).container;
}

/** The list element of a mounted strip. */
function list(root: HTMLElement): HTMLElement {
	return root.querySelector<HTMLElement>('[data-slot="changelog-strip-list"]')!;
}

/** Entries per row, in reading order, grouped by their top edge. */
function rows(root: HTMLElement): number[] {
	let counts = new Map<number, number>();
	for (let entry of root.querySelectorAll('[data-slot="changelog-strip-entry"]')) {
		let top = Math.round(entry.getBoundingClientRect().top);
		counts.set(top, (counts.get(top) ?? 0) + 1);
	}
	return [...counts.values()];
}

describe("ChangelogStrip", () => {
	test("scrolls sideways inside its own box on a phone", () => {
		let root = mountStrip(375, 4);
		let row = list(root);
		let strip = root.querySelector<HTMLElement>('[data-slot="changelog-strip"]')!;
		let entry = root.querySelector<HTMLElement>('[data-slot="changelog-strip-entry"]')!;

		expect(getComputedStyle(row).scrollSnapType).toBe("x mandatory");
		expect(row.scrollWidth).toBeGreaterThan(row.clientWidth);
		expect(strip.getBoundingClientRect().width).toBeLessThanOrEqual(375);
		expect(strip.scrollWidth).toBeLessThanOrEqual(strip.clientWidth);
		expect(entry.getBoundingClientRect().width).toBeCloseTo(375 * 0.8, 0);
	});

	test("lays four entries in one row at 1280 and pairs them at 640", () => {
		expect(rows(mountStrip(1280, 4))).toEqual([4]);
		expect(rows(mountStrip(640, 4))).toEqual([2, 2]);
	});

	test("never leaves a lone entry on the last row", () => {
		for (let width of [640, 900, 1280]) {
			for (let count of [3, 5, 6]) {
				let root = mountStrip(width, count);
				let row = list(root);
				let layout = rows(root);
				if (getComputedStyle(row).display === "grid") {
					expect(layout.at(-1), `${count} entries at ${width}px`).toBeGreaterThan(1);
				} else {
					expect(layout, `${count} entries scroll at ${width}px`).toEqual([count]);
				}
			}
		}
		expect(rows(mountStrip(1280, 3))).toEqual([3]);
		expect(rows(mountStrip(1280, 5))).toEqual([5]);
		expect(rows(mountStrip(1280, 6))).toEqual([3, 3]);
	});

	test("centres each dot on its entry's rule", () => {
		let root = mountStrip(1280, 4);
		let entry = root.querySelector<HTMLElement>('[data-slot="changelog-strip-entry"]')!;
		let rule = Number.parseFloat(getComputedStyle(entry).borderTopWidth);
		let dot = getComputedStyle(entry, "::before");
		let dotTop = rule + Number.parseFloat(dot.top);
		let dotCentre = dotTop + Number.parseFloat(dot.height) / 2;

		expect(rule).toBe(1);
		expect(dot.height).toBe("7px");
		expect(dotCentre).toBe(rule / 2);
		expect(entry.getBoundingClientRect().top - list(root).getBoundingClientRect().top).toBe(4);
	});

	test("writes the date to a time element and links the whole entry", () => {
		let root = mountStrip(1280, 4);
		let time = root.querySelector("time")!;
		let link = root.querySelector<HTMLAnchorElement>('[data-slot="changelog-strip-link"]')!;

		expect(time.getAttribute("datetime")).toBe("2026-10-28");
		expect(getComputedStyle(time).fontSize).toBe("12px");
		expect(link.contains(time)).toBe(true);
		expect(root.querySelector("h2, h1, h3")?.textContent).toBe("Changelog");
	});
});
