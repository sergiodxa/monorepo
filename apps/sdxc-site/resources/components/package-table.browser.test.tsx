/**
 * Drives the stats page's package table in a real browser: pressing a header re-sorts the
 * rows in place and writes the order into the address, and the header row stays pinned to
 * the bottom of the sticky site header while the page scrolls past the table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import type { PackageRow, StatsQuery } from "~/resources/components/package-table";

import PackageTable from "~/resources/components/package-table";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";

/** The query a plain visit to the page renders with. */
const QUERY: StatsQuery = { range: "90", sort: "week", package: null };

/** A package with the given counts and every other figure filled in plainly. */
function row(directory: string, last7: number, total: number): PackageRow {
	return {
		directory,
		name: `@sdxc/${directory}`,
		trend: [1, 2, 3],
		last7,
		growth7: null,
		last30: last7,
		total,
		latest: "2026.10.30",
		latestShare: 1,
		versions: 1,
		unpackedSize: 1024,
	};
}

/** The package names in the order the table lists them. */
function order(host: HTMLElement): string[] {
	return Array.from(host.querySelectorAll("tbody tr td:first-child a"), (link) => link.textContent);
}

/** Mounts the table with `rows` and returns its host. */
function mount(rows: PackageRow[]): HTMLElement {
	let host = document.createElement("div");
	document.body.appendChild(host);
	render(<PackageTable rows={rows} query={QUERY} />, { container: host });
	return host;
}

beforeEach(async () => {
	await page.viewport(1280, 600);
	history.replaceState(null, "", "/stats");
});

afterEach(() => {
	document.body.replaceChildren();
	window.scrollTo(0, 0);
});

describe("PackageTable", () => {
	test("re-sorts in place and writes the order into the address", async () => {
		let host = mount([row("cache", 9, 10), row("zip", 1, 50)]);
		expect(order(host)).toEqual(["cache", "zip"]);

		let total = Array.from(host.querySelectorAll("th a")).find((link) =>
			link.textContent?.includes("Total"),
		);
		if (!(total instanceof HTMLAnchorElement)) throw new Error("missing the Total header");
		total.click();
		await new Promise((resolve) => requestAnimationFrame(resolve));

		expect(order(host)).toEqual(["zip", "cache"]);
		expect(location.pathname + location.search).toBe("/stats?sort=total");
		expect(total.closest("th")?.getAttribute("aria-sort")).toBe("descending");
		expect(host.querySelector('a[href="/stats?sort=total&package=zip"]')).not.toBeNull();
	});

	test("keeps the header row under the site header while the rows scroll past", async () => {
		let rows = Array.from({ length: 60 }, (_, index) => row(`pkg-${index}`, 60 - index, 1));
		let host = mount(rows);
		let head = host.querySelector("thead");
		if (!head) throw new Error("missing the header row");

		window.scrollTo(0, 800);
		await new Promise((resolve) => requestAnimationFrame(resolve));

		let siteHeader = parseFloat(getComputedStyle(document.documentElement).fontSize) * 4 + 1;
		expect(Math.round(head.getBoundingClientRect().top)).toBe(siteHeader);
	});

	test("scrolls sideways inside its frame on a narrow screen", async () => {
		await page.viewport(480, 600);
		let host = mount([row("cache", 1, 1)]);
		let frame = host.querySelector("table")?.parentElement;
		if (!frame) throw new Error("missing the table frame");

		expect(getComputedStyle(frame).overflowX).toBe("auto");
		expect(frame.scrollWidth).toBeGreaterThan(frame.clientWidth);
	});
});
