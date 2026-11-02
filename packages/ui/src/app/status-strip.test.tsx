/**
 * Weighs the status strip's server markup: a page draws hundreds of bars at once, so each bar
 * carries only its status, its Tab order and its accessible name, while every rule that paints
 * and positions it lives once on the strip.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { renderToString } from "remix/component/server";
import { describe, expect, test } from "vitest";

import { StatusStrip } from "./status-strip.js";

/** Ninety days of a monitor's uptime, oldest first, named the way an uptime page names them. */
const DAYS: StatusStrip.Period[] = Array.from({ length: 90 }, (_, index) => ({
	status: index < 7 ? "no-data" : "up",
	label: `Oct ${(index % 28) + 1}`,
	value: index < 7 ? "No data" : "99.98%",
}));

/** Every bar's markup, from its opening tag to its closing one. */
function barMarkup(html: string): string[] {
	return html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? [];
}

describe("StatusStrip markup", () => {
	test("draws 90 bars in under 15 KB, under 150 bytes a bar", async () => {
		let html = await renderToString(
			<StatusStrip
				label="Uptime, last 90 days"
				summary="99.95% uptime"
				start="90 days ago"
				end="Today"
				periods={DAYS}
			/>,
		);
		let bars = barMarkup(html);
		let barBytes = bars.reduce((total, bar) => total + bar.length, 0);

		expect(bars).toHaveLength(90);
		expect(barBytes / bars.length).toBeLessThan(150);
		expect(html.length).toBeLessThan(15_000);
	});

	test("names each bar by its date and value, with no class list or wrapper of its own", async () => {
		let html = await renderToString(<StatusStrip label="Uptime" periods={DAYS} />);
		let bars = barMarkup(html);

		expect(bars[0]).toContain('aria-label="Oct 1, No data"');
		expect(bars[0]).toContain('data-status="no-data"');
		for (let bar of bars) expect(bar).not.toMatch(/\bclass=|<span/);
	});
});
