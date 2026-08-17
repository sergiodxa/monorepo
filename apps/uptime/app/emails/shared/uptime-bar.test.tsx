/**
 * Tests the email-safe bar as markup: one cell per segment, each filled with the
 * colour its status maps to, and every rule an inline style rather than a class, so a
 * client that drops the stylesheet still shows the bar it was sent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "@pkg/mail";
import { describe, expect, test } from "vitest";

import type { UptimeBar as Bar } from "~/app/emails/shared/uptime-bar";

import { UptimeBar } from "~/app/emails/shared/uptime-bar";

/** Fill of a passing period; `--ui-color-success-600`. */
let UP = "#107f04";

/** Fill of a degraded period; `--ui-color-warning-600`. */
let DEGRADED = "#925d00";

/** Fill of a failing period; `--ui-color-danger-600`. */
let DOWN = "#ba2b2e";

/** Fill of a period with no check; `--ui-color-neutral-200`. */
let NO_DATA = "#dde2e6";

/** Labels a caller supplies; the bar owns no copy, so these are literals rather than keys. */
let labels: Bar.Labels = {
	start: "24 hours ago",
	end: "Now",
	uptime: "99.5% uptime",
	legend: { up: "Up", degraded: "Degraded", down: "Down", noData: "No data" },
};

/** How many times a colour appears, which is one per segment plus one legend swatch. */
function countOf(html: string, color: string): number {
	return html.split(color).length - 1;
}

/** Renders the bar for `segments` with the default labels unless they are overridden. */
async function renderBar(segments: Bar.Status[], overrides: Partial<Bar.Labels> = {}) {
	return await render(<UptimeBar segments={segments} labels={{ ...labels, ...overrides }} />);
}

describe("UptimeBar", () => {
	test("fills every segment with its no-data colour when nothing was checked", async () => {
		let { html } = await renderBar(Array.from({ length: 24 }, () => null));

		expect(countOf(html, NO_DATA)).toBe(25);
		expect(countOf(html, UP)).toBe(1);
		expect(countOf(html, DOWN)).toBe(1);
	});

	test("fills every segment with the success colour when everything passed", async () => {
		let { html } = await renderBar(Array.from({ length: 24 }, () => "up" as const));

		expect(countOf(html, UP)).toBe(25);
		expect(countOf(html, DOWN)).toBe(1);
		expect(countOf(html, NO_DATA)).toBe(1);
	});

	test("gives each status in a mixed range its own colour", async () => {
		let { html } = await renderBar(["up", "up", "degraded", "down", null]);

		expect(countOf(html, UP)).toBe(3);
		expect(countOf(html, DEGRADED)).toBe(2);
		expect(countOf(html, DOWN)).toBe(2);
		expect(countOf(html, NO_DATA)).toBe(2);
	});

	test("renders one cell per segment, however many there are", async () => {
		let week = await renderBar(Array.from({ length: 7 }, () => "up" as const));
		let day = await renderBar(Array.from({ length: 24 }, () => "up" as const));

		expect(countOf(week.html, UP)).toBe(8);
		expect(countOf(day.html, UP)).toBe(25);
	});

	test("omits the bar row entirely when there is nothing to plot", async () => {
		let { html } = await renderBar([]);

		expect(html).not.toContain("table-layout:fixed");
		expect(html).toContain("24 hours ago");
	});

	test("shows the caption and the legend it was given", async () => {
		let { text } = await renderBar(["up"]);

		expect(text).toContain("24 hours ago");
		expect(text).toContain("99.5% uptime");
		expect(text).toContain("Now");
		expect(text).toContain("No data");
	});

	test("leaves the uptime caption out when nothing was measured", async () => {
		let { text } = await renderBar(["up"], { uptime: null });

		expect(text).not.toContain("uptime");
	});

	test("carries every rule inline, since mail clients drop the stylesheet", async () => {
		let { html } = await renderBar(["up", "down"]);

		expect(html).not.toContain("<style");
		expect(html).toContain(`background-color:${UP}`);
	});

	test("names each fill so the layout's dark block can reach it", async () => {
		let { html } = await renderBar(["up", "down", null]);

		expect(html).toContain('class="uptime-fill-up"');
		expect(html).toContain('class="uptime-fill-down"');
		expect(html).toContain('class="uptime-fill-none"');
		expect(html).toContain('class="mail-muted"');
	});
});
